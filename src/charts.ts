import { MetricSample } from './types';

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

function toSparkline(data: number[], maxVal = 100): string {
  if (data.length === 0) return '';

  // Downsample if too many points (max ~60 chars wide)
  const maxPoints = 60;
  let samples = data;
  if (data.length > maxPoints) {
    const step = data.length / maxPoints;
    samples = [];
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.floor(i * step);
      samples.push(data[idx]);
    }
  }

  return samples
    .map((val) => {
      const normalized = Math.max(0, Math.min(val, maxVal)) / maxVal;
      const index = Math.min(Math.floor(normalized * BLOCKS.length), BLOCKS.length - 1);
      return BLOCKS[index];
    })
    .join('');
}

function toAsciiChart(data: number[], label: string, maxVal = 100, height = 8): string[] {
  if (data.length === 0) return ['No data'];

  // Downsample if needed
  const maxPoints = 50;
  let samples = data;
  if (data.length > maxPoints) {
    const step = data.length / maxPoints;
    samples = [];
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.floor(i * step);
      samples.push(data[idx]);
    }
  }

  const lines: string[] = [];
  const width = samples.length;

  for (let row = height - 1; row >= 0; row--) {
    const threshold = (row / (height - 1)) * maxVal;
    const nextThreshold = ((row + 1) / (height - 1)) * maxVal;

    let line = '';
    for (const val of samples) {
      if (val >= nextThreshold) {
        line += '█';
      } else if (val >= threshold) {
        line += '▄';
      } else {
        line += ' ';
      }
    }

    // Add Y-axis label on first and last row
    if (row === height - 1) {
      lines.push(`${maxVal.toString().padStart(3)}% │${line}│`);
    } else if (row === 0) {
      lines.push(`  0% │${line}│`);
    } else {
      lines.push(`     │${line}│`);
    }
  }

  // Add bottom border
  lines.push(`     └${'─'.repeat(width)}┘`);
  lines.push(`      ${label.padStart(Math.floor((width + label.length) / 2))}`);

  return lines;
}

export function generateCombinedChart(samples: MetricSample[]): string {
  if (samples.length === 0) {
    return '*No telemetry data collected*';
  }

  const cpuData = samples.map((s) => s.cpu_percent);
  const memData = samples.map((s) => s.memory_percent);

  const cpuSparkline = toSparkline(cpuData);
  const memSparkline = toSparkline(memData);

  const cpuMin = Math.min(...cpuData).toFixed(1);
  const cpuMax = Math.max(...cpuData).toFixed(1);
  const cpuAvg = (cpuData.reduce((a, b) => a + b, 0) / cpuData.length).toFixed(1);

  const memMin = Math.min(...memData).toFixed(1);
  const memMax = Math.max(...memData).toFixed(1);
  const memAvg = (memData.reduce((a, b) => a + b, 0) / memData.length).toFixed(1);

  return `
\`\`\`
CPU Usage (min: ${cpuMin}% | avg: ${cpuAvg}% | max: ${cpuMax}%)
${cpuSparkline}

Memory Usage (min: ${memMin}% | avg: ${memAvg}% | max: ${memMax}%)
${memSparkline}
\`\`\`
`.trim();
}

// Keep for potential future use or artifact generation
export function generateDetailedAsciiChart(samples: MetricSample[]): string {
  if (samples.length === 0) {
    return 'No telemetry data collected';
  }

  const cpuData = samples.map((s) => s.cpu_percent);
  const memData = samples.map((s) => s.memory_percent);

  const cpuChart = toAsciiChart(cpuData, 'CPU Usage Over Time', 100, 6);
  const memChart = toAsciiChart(memData, 'Memory Usage Over Time', 100, 6);

  return `
\`\`\`
${cpuChart.join('\n')}

${memChart.join('\n')}
\`\`\`
`.trim();
}
