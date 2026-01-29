# CLI Command Interface

## Global Commands

### `morpheus --help`
Displays list of available commands.

### `morpheus --version`
Displays current version.

## Subcommands

### `start`
Initializes and runs the agent.
- **Flags**:
    - `--ui` (boolean, default: true): Enable web panel.
    - `--no-ui`: Disable web panel.
    - `--port <number>` (number, default: 3333): Port for web panel.
- **Behavior**: Blocking process. Writes PID to `~/.morpheus/morpheus.pid`.

### `stop`
Terminates the running agent.
- **Behavior**: Reads PID from `~/.morpheus/morpheus.pid`, sends SIGTERM, removes PID file.
- **Output**: Success message or "Agent not running".

### `status`
Checks agent health.
- **Behavior**: Checks existence of PID file and process liveness.
- **Output**: 
    - "Running (PID: 12345)"
    - "Stopped"
    - "Stale PID detected (cleaned)"

### `config`
View or edit configuration.
- **Flags**:
    - `--edit`, `-e`: Open `config.yaml` in system default editor.
- **Behavior (Default)**: Prints path to config file and pretty-prints content to stdout.

### `doctor`
Diagnose environment.
- **Checks**:
    - Node.js version >= 18.
    - Config file validity (YAML syntax).
    - Permissions on `~/.morpheus`.
