# Research: CLI Structure

## Decisions & Rationale

### 1. Execution Mode (`morpheus start`)

- **Decision**: **Blocking (Foreground) by default**.
- **Rationale**: 
    - **DX**: Matches standard developer tools (Vite, Next.js).
    - **Visibility**: Immediate access to logs (stdout/stderr) without looking for log files.
    - **Control**: Easy to stop via `Ctrl+C`.
- **Alternatives Considered**: 
    - *Background Daemon*: Detaches immediately. Rejected as default because it hides startup errors and makes debugging harder for a developer tool. Can be added later as a `--detach` flag.

### 2. Configuration Interaction (`morpheus config`)

- **Decision**: **"View" by default, "Edit" via flag/subcommand**.
- **Rationale**: 
    - `morpheus config`: Prints path and current values (safe, read-only).
    - `morpheus config --edit` (or `edit`): Uses system default editor.
- **Key Libraries**: [`open`](https://www.npmjs.com/package/open) for cross-platform editor launching.

### 3. Process Management (Status/Stop)

- **Decision**: **PID File in Global Directory**.
- **Location**: `~/.morpheus/morpheus.pid`.
- **Logic**:
    - **Start**: Check if PID file exists. If yes, check if process is alive (signal 0). If alive, abort. If dead (stale), overwrite.
    - **Stop**: Read PID file, send `SIGTERM`.
    - **Status**: Read PID file, check if process is alive.
- **Key Libraries**: Node.js `process` API (no heavy external deps needed for basic PID handling).

## Tech Stack Recommendations

| Component | Choice | Reason |
|-----------|--------|--------|
| **CLI Framework** | `commander` or `yargs` | Standard, robust parsing. `commander` is very popular in TS ecosystem. |
| **Config Loader** | `cosmiconfig` or `dotenv` + `yaml` | Need YAML support. `js-yaml` + `fs` is sufficient given fixed path `~/.morpheus/config.yaml`. |
| **Output/Colors** | `chalk` | Industry standard for readable terminal output. |
| **Spinners** | `ora` | Good DX for long-running operations like startup. |
