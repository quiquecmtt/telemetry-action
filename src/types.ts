export interface MetricSample {
  timestamp: string;
  cpu_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_percent: number;
}

export interface MetricsSummary {
  peak_cpu_percent: number;
  peak_memory_percent: number;
  avg_cpu_percent: number;
  avg_memory_percent: number;
  sample_count: number;
  start_time: string;
  end_time: string;
}

export interface MetricsOutput {
  summary: MetricsSummary;
  samples: MetricSample[];
}

export interface MonitorState {
  metricsDir: string;
  monitorPid: number;
  startTime: string;
}
