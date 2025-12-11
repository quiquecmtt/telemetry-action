# Workflow Telemetry Action

A GitHub Action that captures CPU and memory usage metrics during workflow execution.

## Features

- Monitors CPU and memory usage at configurable intervals
- Works on Linux, macOS, and Windows runners
- Outputs metrics to job summary, JSON artifacts, or both
- Provides peak and average statistics
- Uses post-job hook to automatically collect metrics after all steps complete

## Usage

### Basic Usage

```yaml
name: Build with Telemetry
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start Telemetry
        uses: quiquecmtt/telemetry-action@v1

      # Your build steps here - telemetry runs in background
      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run tests
        run: npm test

      # Telemetry automatically stops and reports after all steps complete
```

### With Artifact Upload

```yaml
- name: Start Telemetry
  uses: quiquecmtt/telemetry-action@v1
  with:
    sampling_interval: '2'
    output_format: 'both'
    artifact_name: 'build-metrics'
```

### Using Outputs

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start Telemetry
        id: telemetry
        uses: quiquecmtt/telemetry-action@v1

      - name: Build
        run: npm ci && npm run build

      # Note: Outputs are available in subsequent jobs or via artifacts
      # The post step runs after all steps, so outputs aren't available
      # in the same job's steps
```

## How It Works

1. When the action runs, it starts a background monitoring process
2. The monitor collects CPU and memory metrics at the specified interval
3. Your workflow steps execute normally while monitoring continues
4. After **all** workflow steps complete, the action's `post` hook:
   - Stops the monitoring process
   - Calculates statistics (peak, average)
   - Generates output (summary table, JSON file)
   - Optionally uploads metrics as an artifact

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `sampling_interval` | Interval in seconds between metric samples | No | `1` |
| `output_format` | Output format: `summary`, `json`, or `both` | No | `summary` |
| `artifact_name` | Name for the metrics artifact (empty = no upload) | No | `''` |

## Outputs

| Output | Description |
|--------|-------------|
| `peak_cpu` | Peak CPU usage percentage |
| `peak_memory` | Peak memory usage percentage |
| `avg_cpu` | Average CPU usage percentage |
| `avg_memory` | Average memory usage percentage |
| `metrics_file` | Path to the metrics JSON file |

> **Note:** Outputs are set during the post-job phase, so they're available in subsequent jobs (with `needs`) but not in later steps of the same job.

## Output Formats

### Summary (Job Summary)

When `output_format` is `summary` or `both`, a table is added to the GitHub Actions job summary:

| Metric | Peak | Average |
|--------|------|---------|
| CPU Usage | 85.2% | 45.3% |
| Memory Usage | 72.1% | 58.4% |

### JSON (Artifact)

When `artifact_name` is set, a JSON file is uploaded as an artifact:

```json
{
  "summary": {
    "peak_cpu_percent": 85.2,
    "peak_memory_percent": 72.1,
    "avg_cpu_percent": 45.3,
    "avg_memory_percent": 58.4,
    "sample_count": 120,
    "start_time": "2024-01-15T10:30:00.000Z",
    "end_time": "2024-01-15T10:32:00.000Z"
  },
  "samples": [
    {
      "timestamp": "2024-01-15T10:30:00.000Z",
      "cpu_percent": 25.5,
      "memory_used_mb": 2048,
      "memory_total_mb": 7168,
      "memory_percent": 28.6
    }
  ]
}
```

## Platform Support

| Platform | Status |
|----------|--------|
| `ubuntu-latest` | Supported |
| `ubuntu-24.04` | Supported |
| `ubuntu-22.04` | Supported |
| `macos-latest` | Supported |
| `macos-14` | Supported |
| `macos-13` | Supported |
| `windows-latest` | Supported |
| `windows-2022` | Supported |

## Development

```bash
# Install dependencies
npm install

# Build the action
npm run build

# Type check
npm run typecheck
```

## License

MIT
