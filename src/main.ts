import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { MonitorState } from './types';

async function run(): Promise<void> {
  try {
    const samplingInterval = core.getInput('sampling_interval') || '1';
    const runnerTemp = process.env.RUNNER_TEMP || '/tmp';
    const metricsDir = path.join(runnerTemp, 'telemetry-metrics');

    // Create metrics directory
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }

    core.info(`Starting telemetry monitoring (interval: ${samplingInterval}s)`);
    core.info(`Metrics directory: ${metricsDir}`);

    // Start the monitor as a detached subprocess
    const monitorScript = path.join(__dirname, '..', 'src', 'monitor.ts');
    const monitorJs = path.join(__dirname, 'monitor-subprocess.js');

    // Write a simple monitoring script that can run standalone
    const monitorCode = `
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const interval = ${parseInt(samplingInterval, 10) * 1000};
const metricsDir = '${metricsDir.replace(/\\/g, '\\\\')}';
const filePath = path.join(metricsDir, 'raw_metrics.jsonl');

// Store previous CPU stats for delta calculation
let prevCpuStats = null;

function parseCpuStats() {
  const stat = fs.readFileSync('/proc/stat', 'utf8');
  const cpuLine = stat.split('\\n').find(line => line.startsWith('cpu '));
  if (!cpuLine) return null;
  const parts = cpuLine.split(/\\s+/).slice(1).map(Number);
  const idle = parts[3] + (parts[4] || 0); // idle + iowait
  const total = parts.reduce((a, b) => a + b, 0);
  return { idle, total };
}

function getCpuUsage() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      const output = execSync('top -l 1 -n 0 2>/dev/null | grep "CPU usage"', { encoding: 'utf8', timeout: 5000 });
      const userMatch = output.match(/(\\d+\\.?\\d*)%\\s*user/);
      const sysMatch = output.match(/(\\d+\\.?\\d*)%\\s*sys/);
      const user = userMatch ? parseFloat(userMatch[1]) : 0;
      const sys = sysMatch ? parseFloat(sysMatch[1]) : 0;
      return Math.round((user + sys) * 10) / 10;
    } else if (platform === 'linux') {
      const currentStats = parseCpuStats();
      if (!currentStats) return 0;

      if (prevCpuStats) {
        const idleDelta = currentStats.idle - prevCpuStats.idle;
        const totalDelta = currentStats.total - prevCpuStats.total;
        prevCpuStats = currentStats;

        if (totalDelta > 0) {
          const usage = ((totalDelta - idleDelta) / totalDelta) * 100;
          return Math.round(usage * 10) / 10;
        }
      }

      prevCpuStats = currentStats;
      return 0; // First reading, no delta yet
    } else if (platform === 'win32') {
      const output = execSync('wmic cpu get loadpercentage /value 2>nul', { encoding: 'utf8', timeout: 5000 });
      const match = output.match(/LoadPercentage=(\\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  } catch (e) {}
  const loadAvg = os.loadavg()[0];
  const cpuCount = os.cpus().length;
  return Math.round((loadAvg / cpuCount) * 1000) / 10;
}

function getMemoryUsage() {
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMb = Math.round(os.freemem() / 1024 / 1024);
  const usedMb = totalMb - freeMb;
  const percent = Math.round((usedMb / totalMb) * 1000) / 10;
  return { usedMb, totalMb, percent };
}

function collect() {
  try {
    const cpu = getCpuUsage();
    const memory = getMemoryUsage();
    const sample = {
      timestamp: new Date().toISOString(),
      cpu_percent: cpu,
      memory_used_mb: memory.usedMb,
      memory_total_mb: memory.totalMb,
      memory_percent: memory.percent
    };
    fs.appendFileSync(filePath, JSON.stringify(sample) + '\\n');
  } catch (e) {
    console.error('Error collecting sample:', e);
  }
}

collect();
setInterval(collect, interval);

// Keep running
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
`;

    fs.writeFileSync(monitorJs, monitorCode);

    // Spawn detached process
    const child = spawn('node', [monitorJs], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });

    child.unref();

    const monitorPid = child.pid || 0;
    core.info(`Monitor started with PID: ${monitorPid}`);

    // Save state for post step
    const state: MonitorState = {
      metricsDir,
      monitorPid,
      startTime: new Date().toISOString(),
    };

    core.saveState('telemetry_state', JSON.stringify(state));

    // Also save to a file as backup
    const stateFile = path.join(metricsDir, 'state.json');
    fs.writeFileSync(stateFile, JSON.stringify(state));

    core.info('Telemetry monitoring active - metrics will be collected during workflow execution');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Failed to start telemetry monitoring: ${error.message}`);
    } else {
      core.setFailed('Failed to start telemetry monitoring');
    }
  }
}

run();
