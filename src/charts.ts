import { MetricSample } from './types';

interface ChartOptions {
  width: number;
  height: number;
  padding: number;
  lineColor: string;
  fillColor: string;
  gridColor: string;
  textColor: string;
  title: string;
  yAxisLabel: string;
}

const defaultOptions: ChartOptions = {
  width: 600,
  height: 200,
  padding: 50,
  lineColor: '#2563eb',
  fillColor: 'rgba(37, 99, 235, 0.1)',
  gridColor: '#e5e7eb',
  textColor: '#374151',
  title: '',
  yAxisLabel: '%',
};

export function generateSvgChart(
  data: number[],
  options: Partial<ChartOptions> = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const { width, height, padding } = opts;

  if (data.length === 0) {
    return createEmptyChart(opts);
  }

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxValue = Math.max(100, Math.ceil(Math.max(...data) / 10) * 10);
  const minValue = 0;

  // Generate points for the line
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
    return `${x},${y}`;
  });

  // Generate area fill path
  const areaPath = [
    `M ${padding},${padding + chartHeight}`,
    `L ${points[0]}`,
    ...points.slice(1).map((p) => `L ${p}`),
    `L ${padding + chartWidth},${padding + chartHeight}`,
    'Z',
  ].join(' ');

  // Generate grid lines
  const gridLines: string[] = [];
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = padding + (i / ySteps) * chartHeight;
    const value = Math.round(maxValue - (i / ySteps) * (maxValue - minValue));
    gridLines.push(
      `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="${opts.gridColor}" stroke-dasharray="4,4" />`
    );
    gridLines.push(
      `<text x="${padding - 10}" y="${y + 4}" text-anchor="end" fill="${opts.textColor}" font-size="11">${value}${opts.yAxisLabel}</text>`
    );
  }

  // Time labels (start, middle, end)
  const timeLabels = [
    `<text x="${padding}" y="${height - 10}" text-anchor="start" fill="${opts.textColor}" font-size="11">Start</text>`,
    `<text x="${width / 2}" y="${height - 10}" text-anchor="middle" fill="${opts.textColor}" font-size="11">Time</text>`,
    `<text x="${width - padding}" y="${height - 10}" text-anchor="end" fill="${opts.textColor}" font-size="11">End</text>`,
  ];

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .chart-title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; }
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white" rx="8" />

  <!-- Title -->
  ${opts.title ? `<text x="${width / 2}" y="25" text-anchor="middle" fill="${opts.textColor}" font-size="14" class="chart-title">${opts.title}</text>` : ''}

  <!-- Grid -->
  ${gridLines.join('\n  ')}

  <!-- Area fill -->
  <path d="${areaPath}" fill="${opts.fillColor}" />

  <!-- Line -->
  <polyline points="${points.join(' ')}" fill="none" stroke="${opts.lineColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Data points -->
  ${data.length <= 50 ? points.map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="${opts.lineColor}" />`).join('\n  ') : ''}

  <!-- Time labels -->
  ${timeLabels.join('\n  ')}
</svg>`;
}

function createEmptyChart(opts: ChartOptions): string {
  return `<svg viewBox="0 0 ${opts.width} ${opts.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${opts.width}" height="${opts.height}" fill="white" rx="8" />
  <text x="${opts.width / 2}" y="${opts.height / 2}" text-anchor="middle" fill="${opts.textColor}" font-size="14">No data available</text>
</svg>`;
}

export function generateCpuChart(samples: MetricSample[]): string {
  const data = samples.map((s) => s.cpu_percent);
  return generateSvgChart(data, {
    title: 'CPU Usage Over Time',
    lineColor: '#2563eb',
    fillColor: 'rgba(37, 99, 235, 0.1)',
  });
}

export function generateMemoryChart(samples: MetricSample[]): string {
  const data = samples.map((s) => s.memory_percent);
  return generateSvgChart(data, {
    title: 'Memory Usage Over Time',
    lineColor: '#16a34a',
    fillColor: 'rgba(22, 163, 74, 0.1)',
  });
}

export function generateCombinedChart(samples: MetricSample[]): string {
  if (samples.length === 0) {
    return createEmptyChart(defaultOptions);
  }

  const width = 700;
  const height = 250;
  const padding = 50;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const cpuData = samples.map((s) => s.cpu_percent);
  const memData = samples.map((s) => s.memory_percent);

  const maxValue = 100;
  const minValue = 0;

  const toPoints = (data: number[]): string[] =>
    data.map((value, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
      const y = padding + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
      return `${x},${y}`;
    });

  const cpuPoints = toPoints(cpuData);
  const memPoints = toPoints(memData);

  // Grid lines
  const gridLines: string[] = [];
  for (let i = 0; i <= 5; i++) {
    const y = padding + (i / 5) * chartHeight;
    const value = 100 - i * 20;
    gridLines.push(
      `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="4,4" />`
    );
    gridLines.push(
      `<text x="${padding - 10}" y="${y + 4}" text-anchor="end" fill="#374151" font-size="11">${value}%</text>`
    );
  }

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .chart-title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; }
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white" rx="8" />

  <!-- Title -->
  <text x="${width / 2}" y="25" text-anchor="middle" fill="#374151" font-size="14" class="chart-title">CPU &amp; Memory Usage Over Time</text>

  <!-- Grid -->
  ${gridLines.join('\n  ')}

  <!-- CPU Line -->
  <polyline points="${cpuPoints.join(' ')}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Memory Line -->
  <polyline points="${memPoints.join(' ')}" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Legend -->
  <rect x="${width - 140}" y="10" width="12" height="12" fill="#2563eb" rx="2" />
  <text x="${width - 122}" y="20" fill="#374151" font-size="11">CPU</text>
  <rect x="${width - 80}" y="10" width="12" height="12" fill="#16a34a" rx="2" />
  <text x="${width - 62}" y="20" fill="#374151" font-size="11">Memory</text>

  <!-- Time labels -->
  <text x="${padding}" y="${height - 10}" text-anchor="start" fill="#374151" font-size="11">Start</text>
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" fill="#374151" font-size="11">Time</text>
  <text x="${width - padding}" y="${height - 10}" text-anchor="end" fill="#374151" font-size="11">End</text>
</svg>`;
}
