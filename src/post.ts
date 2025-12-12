import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DefaultArtifactClient } from '@actions/artifact';
import { MetricSample, MetricsOutput, MetricsSummary, MonitorState } from './types';
import { generateCombinedChart } from './charts';

interface SystemInfo {
  cpuCores: number;
  cpuModel: string;
  totalMemoryMb: number;
  platform: string;
  arch: string;
}

function getSystemInfo(): SystemInfo {
  const cpus = os.cpus();
  return {
    cpuCores: cpus.length,
    cpuModel: cpus[0]?.model || 'Unknown',
    totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
    platform: os.platform(),
    arch: os.arch(),
  };
}

async function run(): Promise<void> {
  try {
    // Get state from main step
    const stateJson = core.getState('telemetry_state');
    let state: MonitorState;

    if (stateJson) {
      state = JSON.parse(stateJson);
    } else {
      // Fallback: try to read from file
      const runnerTemp = process.env.RUNNER_TEMP || '/tmp';
      const metricsDir = path.join(runnerTemp, 'telemetry-metrics');
      const stateFile = path.join(metricsDir, 'state.json');

      if (fs.existsSync(stateFile)) {
        state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      } else {
        core.warning('No telemetry state found - monitoring may not have started correctly');
        return;
      }
    }

    core.info('Stopping telemetry monitoring...');

    // Stop the monitor process
    if (state.monitorPid) {
      try {
        process.kill(state.monitorPid, 'SIGTERM');
        core.info(`Stopped monitor process (PID: ${state.monitorPid})`);
      } catch {
        // Process may have already exited
        core.debug('Monitor process already stopped');
      }
    }

    // Give it a moment to flush any pending writes
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Load and process samples
    const samples = loadSamples(state.metricsDir);

    if (samples.length === 0) {
      core.warning('No metric samples collected');
      setEmptyOutputs();
      return;
    }

    core.info(`Collected ${samples.length} metric samples`);

    // Calculate statistics
    const summary = calculateSummary(samples);
    const sysInfo = getSystemInfo();

    // Generate output based on format
    const outputFormat = core.getInput('output_format') || 'summary';
    const artifactName = core.getInput('artifact_name');

    // Use artifact name for file prefix, or default to 'metrics'
    const filePrefix = artifactName || 'metrics';

    // Save summary to JSON file (without samples)
    const jsonOutput = {
      summary,
      system: {
        cpu_cores: sysInfo.cpuCores,
        cpu_model: sysInfo.cpuModel.trim(),
        total_memory_mb: sysInfo.totalMemoryMb,
        platform: sysInfo.platform,
        arch: sysInfo.arch,
      },
    };
    const metricsFile = path.join(state.metricsDir, `${filePrefix}.json`);
    fs.writeFileSync(metricsFile, JSON.stringify(jsonOutput, null, 2));

    // Save samples to CSV file
    const csvHeader = 'timestamp,cpu_percent,memory_used_mb,memory_total_mb,memory_percent';
    const csvRows = samples.map(
      (s) => `${s.timestamp},${s.cpu_percent},${s.memory_used_mb},${s.memory_total_mb},${s.memory_percent}`
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');
    const csvFile = path.join(state.metricsDir, `${filePrefix}.csv`);
    fs.writeFileSync(csvFile, csvContent);

    // Set outputs
    core.setOutput('peak_cpu', summary.peak_cpu_percent.toString());
    core.setOutput('peak_memory', summary.peak_memory_percent.toString());
    core.setOutput('avg_cpu', summary.avg_cpu_percent.toString());
    core.setOutput('avg_memory', summary.avg_memory_percent.toString());
    core.setOutput('metrics_file', metricsFile);

    if (outputFormat === 'summary' || outputFormat === 'both') {
      writeSummary(summary, samples);
    }

    // Upload artifact if requested
    if (artifactName) {
      try {
        const artifact = new DefaultArtifactClient();
        await artifact.uploadArtifact(artifactName, [metricsFile, csvFile], state.metricsDir, {
          retentionDays: 30,
        });
        core.info(`Uploaded metrics artifact: ${artifactName}`);
        core.info(`  - ${filePrefix}.json (summary + system info)`);
        core.info(`  - ${filePrefix}.csv (${samples.length} samples)`);
      } catch (error) {
        core.warning(`Failed to upload artifact: ${error}`);
      }
    }

    // Log summary to console
    core.info('');
    core.info('=== Telemetry Summary ===');
    core.info(`Peak CPU:     ${summary.peak_cpu_percent}%`);
    core.info(`Peak Memory:  ${summary.peak_memory_percent}%`);
    core.info(`Avg CPU:      ${summary.avg_cpu_percent}%`);
    core.info(`Avg Memory:   ${summary.avg_memory_percent}%`);
    core.info(`Samples:      ${summary.sample_count}`);
    core.info(`Duration:     ${summary.start_time} to ${summary.end_time}`);
    core.info('=========================');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Failed to collect telemetry: ${error.message}`);
    } else {
      core.setFailed('Failed to collect telemetry');
    }
  }
}

function loadSamples(metricsDir: string): MetricSample[] {
  const filePath = path.join(metricsDir, 'raw_metrics.jsonl');

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);

  return lines.map((line) => JSON.parse(line) as MetricSample);
}

function calculateSummary(samples: MetricSample[]): MetricsSummary {
  let cpuSum = 0;
  let memSum = 0;
  let cpuMax = 0;
  let memMax = 0;

  for (const sample of samples) {
    cpuSum += sample.cpu_percent;
    memSum += sample.memory_percent;

    if (sample.cpu_percent > cpuMax) cpuMax = sample.cpu_percent;
    if (sample.memory_percent > memMax) memMax = sample.memory_percent;
  }

  const count = samples.length;

  return {
    peak_cpu_percent: Math.round(cpuMax * 10) / 10,
    peak_memory_percent: Math.round(memMax * 10) / 10,
    avg_cpu_percent: Math.round((cpuSum / count) * 10) / 10,
    avg_memory_percent: Math.round((memSum / count) * 10) / 10,
    sample_count: count,
    start_time: samples[0].timestamp,
    end_time: samples[samples.length - 1].timestamp,
  };
}

function writeSummary(summary: MetricsSummary, samples: MetricSample[]): void {
  const chart = generateCombinedChart(samples);
  const sysInfo = getSystemInfo();
  const totalMemoryGb = (sysInfo.totalMemoryMb / 1024).toFixed(1);

  const summaryContent = `
## Workflow Telemetry

### System Information
| Resource | Value |
|----------|-------|
| CPU | ${sysInfo.cpuCores} cores (${sysInfo.cpuModel.trim()}) |
| Memory | ${totalMemoryGb} GB |
| Platform | ${sysInfo.platform} (${sysInfo.arch}) |

### Resource Usage
${chart}

| Metric | Peak | Average |
|--------|------|---------|
| CPU Usage | ${summary.peak_cpu_percent}% | ${summary.avg_cpu_percent}% |
| Memory Usage | ${summary.peak_memory_percent}% | ${summary.avg_memory_percent}% |

**Samples collected:** ${summary.sample_count}
**Monitoring period:** ${summary.start_time} to ${summary.end_time}
`;

  core.summary.addRaw(summaryContent);
  core.summary.write();
}

function setEmptyOutputs(): void {
  core.setOutput('peak_cpu', '0');
  core.setOutput('peak_memory', '0');
  core.setOutput('avg_cpu', '0');
  core.setOutput('avg_memory', '0');
  core.setOutput('metrics_file', '');
}

run();
