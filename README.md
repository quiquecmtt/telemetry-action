# Workflow Telemetry Action

A GitHub Action that captures CPU and memory usage metrics during workflow execution.

## Features

- Monitors CPU and memory usage at configurable intervals
- Works on Linux, macOS, and Windows runners
- **ASCII charts** for visual resource usage over time in job summary
- **System information** reporting (CPU cores/model, memory, platform)
- Outputs metrics to job summary, JSON/CSV artifacts, or both
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
    # Uploads: build-metrics.json (summary) and build-metrics.csv (samples)
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
   - Generates ASCII charts for visualization
   - Outputs summary with system info to job summary
   - Optionally uploads JSON summary and CSV samples as artifacts

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

When `output_format` is `summary` or `both`, a detailed summary is added to the GitHub Actions job summary including:

- **System Information**: CPU cores, model, total memory, and platform
- **ASCII Charts**: Visual representation of CPU and memory usage over time
- **Statistics Table**: Peak and average values for CPU and memory

Example output:

```
## Workflow Telemetry

### System Information
| Resource | Value |
|----------|-------|
| CPU | 4 cores (Intel Xeon E5-2673 v4) |
| Memory | 16.0 GB |
| Platform | linux (x64) |

### Resource Usage
100% │                    █                              │
     │                    █                              │
     │                   ██                              │
     │                   ██                              │
     │                  ███                              │
     │                  ███ █                            │
     │          █      ████ █                            │
     │         ██      █████ █                           │
     │        ███     ██████ ██                          │
  0% │▄▄▄▄▄▄▄████▄▄▄▄▄███████████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄│
     └──────────────────────────────────────────────────┘
                          CPU Usage

| Metric | Peak | Average |
|--------|------|---------|
| CPU Usage | 85.2% | 45.3% |
| Memory Usage | 72.1% | 58.4% |
```

### Artifact Files

When `artifact_name` is set, two files are uploaded as an artifact:

**1. `{artifact_name}.json`** - Summary and system information:

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
  "system": {
    "cpu_cores": 4,
    "cpu_model": "Intel Xeon E5-2673 v4",
    "total_memory_mb": 16384,
    "platform": "linux",
    "arch": "x64"
  }
}
```

**2. `{artifact_name}.csv`** - Raw samples for further analysis:

```csv
timestamp,cpu_percent,memory_used_mb,memory_total_mb,memory_percent
2024-01-15T10:30:00.000Z,25.5,2048,7168,28.6
2024-01-15T10:30:01.000Z,32.1,2100,7168,29.3
...
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
