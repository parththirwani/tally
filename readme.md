# Tally

A simple, no-nonsense CLI tool for tracking daily work hours.

## Overview

Tally is a lightweight command-line time tracking application that helps you monitor your work sessions. It features session management with pause/resume capabilities, project and tag organization, and comprehensive reporting options.

## Features

- Start, stop, pause, and resume work sessions
- Organize sessions by project, tag, and notes
- Real-time session status with live timer
- Generate reports for different time periods
- Export data to JSON or CSV formats
- Automatic detection and handling of incomplete sessions
- Cross-platform support (Windows, macOS, Linux)

## Installation

```bash
npm install -g tally-time
```

## Requirements

- Node.js >= 14.0.0

## Usage

### Start a Session

```bash
# Start a basic session
tally start

# Start with a project name
tally start myproject

# Start with project, tag, and note
tally start -p myproject -t feature -n "Working on authentication"
```

### Stop a Session

```bash
# Stop the current session
tally stop

# Stop and add a note
tally stop -n "Completed task"
```

### Pause and Resume

```bash
# Pause the current session
tally pause

# Resume a paused session
tally resume
```

### Check Status

```bash
# Show current session status
tally status

# Show live updating timer
tally status --live
```

### Generate Reports

```bash
# Today's report (default)
tally report

# Yesterday's report
tally report yesterday

# Weekly report
tally report week

# Monthly report
tally report month

# Specific date
tally report 2024-01-15

# Detailed breakdown
tally report --detailed

# Export to JSON
tally report week --export json

# Export to CSV
tally report month --export csv
```

## Commands

| Command | Description | Options |
|---------|-------------|---------|
| `start [project]` | Start a new work session | `-p, --project <name>` Project name<br>`-t, --tag <tag>` Tag for the session<br>`-n, --note <note>` Note or description |
| `stop` | Stop the current work session | `-n, --note <note>` Add a note when stopping |
| `pause` | Pause the current work session | None |
| `resume` | Resume a paused work session | None |
| `status` | Show current session status | `-l, --live` Show live updating timer |
| `report [period]` | Generate work reports | `-d, --detailed` Show detailed session breakdown<br>`--export <format>` Export format: json or csv |

## Data Storage

Tally stores all session data locally in a SQLite database:

- **Windows**: `%LOCALAPPDATA%\tally\tally.db`
- **macOS**: `~/Library/Application Support/tally/tally.db`
- **Linux**: `~/.local/share/tally/tally.db`

## Contributing

Contributions are welcome. Please feel free to submit issues or pull requests to improve Tally.

## License

MIT