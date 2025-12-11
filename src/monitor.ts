import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { MetricSample } from './types';

export function getCpuUsage(): number {
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      // macOS: use top command
      const output = execSync('top -l 1 -n 0 2>/dev/null | grep "CPU usage"', {
        encoding: 'utf8',
        timeout: 5000,
      });
      const match = output.match(/(\d+\.?\d*)%\s*user/);
      if (match) {
        // Add user + system for total CPU
        const userMatch = output.match(/(\d+\.?\d*)%\s*user/);
        const sysMatch = output.match(/(\d+\.?\d*)%\s*sys/);
        const user = userMatch ? parseFloat(userMatch[1]) : 0;
        const sys = sysMatch ? parseFloat(sysMatch[1]) : 0;
        return Math.round((user + sys) * 10) / 10;
      }
    } else if (platform === 'linux') {
      // Linux: read /proc/stat
      const stat1 = fs.readFileSync('/proc/stat', 'utf8');
      const cpu1 = parseCpuStat(stat1);

      // Wait a bit and read again
      execSync('sleep 0.1');

      const stat2 = fs.readFileSync('/proc/stat', 'utf8');
      const cpu2 = parseCpuStat(stat2);

      const totalDiff = cpu2.total - cpu1.total;
      const idleDiff = cpu2.idle - cpu1.idle;

      if (totalDiff > 0) {
        return Math.round(((totalDiff - idleDiff) / totalDiff) * 1000) / 10;
      }
    } else if (platform === 'win32') {
      // Windows: use wmic
      const output = execSync(
        'wmic cpu get loadpercentage /value 2>nul',
        { encoding: 'utf8', timeout: 5000 }
      );
      const match = output.match(/LoadPercentage=(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  } catch {
    // Fallback: use os.loadavg (less accurate but cross-platform)
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    return Math.round((loadAvg / cpuCount) * 1000) / 10;
  }

  return 0;
}

function parseCpuStat(stat: string): { total: number; idle: number } {
  const lines = stat.split('\n');
  const cpuLine = lines.find((line) => line.startsWith('cpu '));
  if (!cpuLine) {
    return { total: 0, idle: 0 };
  }

  const parts = cpuLine.split(/\s+/).slice(1).map(Number);
  const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = parts;

  const total = user + nice + system + idle + iowait + irq + softirq + steal;
  return { total, idle };
}

export function getMemoryUsage(): { usedMb: number; totalMb: number; percent: number } {
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMb = Math.round(os.freemem() / 1024 / 1024);
  const usedMb = totalMb - freeMb;
  const percent = Math.round((usedMb / totalMb) * 1000) / 10;

  return { usedMb, totalMb, percent };
}

export function collectSample(): MetricSample {
  const cpu = getCpuUsage();
  const memory = getMemoryUsage();

  return {
    timestamp: new Date().toISOString(),
    cpu_percent: cpu,
    memory_used_mb: memory.usedMb,
    memory_total_mb: memory.totalMb,
    memory_percent: memory.percent,
  };
}

export function saveSample(metricsDir: string, sample: MetricSample): void {
  const filePath = path.join(metricsDir, 'raw_metrics.jsonl');
  fs.appendFileSync(filePath, JSON.stringify(sample) + '\n');
}

export function loadSamples(metricsDir: string): MetricSample[] {
  const filePath = path.join(metricsDir, 'raw_metrics.jsonl');

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);

  return lines.map((line) => JSON.parse(line) as MetricSample);
}

// Main monitoring loop (for subprocess)
if (require.main === module) {
  const args = process.argv.slice(2);
  const interval = parseInt(args[0] || '1', 10) * 1000;
  const metricsDir = args[1] || '/tmp/telemetry-metrics';

  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }

  console.log(`Starting monitor: interval=${interval}ms, dir=${metricsDir}`);

  const collect = (): void => {
    try {
      const sample = collectSample();
      saveSample(metricsDir, sample);
    } catch (error) {
      console.error('Error collecting sample:', error);
    }
  };

  // Collect immediately
  collect();

  // Then collect at intervals
  setInterval(collect, interval);
}
