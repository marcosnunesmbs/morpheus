# DevKit Specification

## Purpose
DevKit is the tool execution layer used by Apoc. It provides filesystem, shell, git, network, packages, processes, system, and browser operations from the external `morpheus-devkit` npm package, wrapped with a security sandbox.

## Scope
Included:
- Security sandbox: `sandbox_dir` path confinement for all file/shell operations
- Readonly mode: blocks destructive filesystem operations
- Category toggles: enable/disable tool categories
- Shell command allowlist
- Tool execution timeout
- DevKit instrument wrapper: emits audit events per tool call
- Auto-migration from deprecated `apoc.working_dir` to `devkit.sandbox_dir`

Out of scope:
- Apoc agent execution (covered in `subagents` spec)
- Browser tool implementation (provided by `morpheus-devkit` package)

## Requirements

### Requirement: Sandbox confinement
The system SHALL confine ALL filesystem operations (reads and writes), shell working directory, git clone destinations, and network downloads to `devkit.sandbox_dir` via `guardPath()`.

#### Scenario: Write outside sandbox blocked
- GIVEN `devkit.sandbox_dir` is `/home/user/projects`
- WHEN Apoc attempts to write to `/etc/passwd`
- THEN the operation is rejected with a sandbox violation error

#### Scenario: Read within sandbox allowed
- GIVEN `devkit.sandbox_dir` is `/home/user/projects`
- WHEN Apoc reads `/home/user/projects/src/index.ts`
- THEN the file contents are returned normally

#### Scenario: Default sandbox is CWD
- GIVEN `devkit.sandbox_dir` is not configured
- WHEN DevKit initializes
- THEN `sandbox_dir` defaults to the current working directory

### Requirement: Readonly mode
The system SHALL block destructive filesystem operations (write, delete, move, copy) when `devkit.readonly_mode` is true.

#### Scenario: Write blocked in readonly mode
- GIVEN `devkit.readonly_mode` is true
- WHEN Apoc calls the filesystem write tool
- THEN an error is returned: "readonly mode is enabled"

#### Scenario: Read allowed in readonly mode
- GIVEN `devkit.readonly_mode` is true
- WHEN Apoc reads a file
- THEN the operation succeeds normally

### Requirement: Category toggles
The system SHALL enable or disable entire DevKit tool categories based on config flags:
- `enable_filesystem` (default: true)
- `enable_shell` (default: true)
- `enable_git` (default: true)
- `enable_network` (default: true)

Non-toggleable categories (processes, packages, system, browser) are always loaded.

#### Scenario: Shell tools disabled
- GIVEN `devkit.enable_shell` is false
- WHEN DevKit builds the tool list
- THEN no shell tools are included and Apoc cannot execute shell commands

#### Scenario: Disabled category tool called
- GIVEN `devkit.enable_network` is false
- WHEN Apoc attempts to call a network tool
- THEN the tool is not available in the agent's tool set

### Requirement: Shell command allowlist
The system SHALL restrict shell commands to a configured allowlist when `devkit.allowed_shell_commands` is non-empty.

#### Scenario: Allowed command executes
- GIVEN `allowed_shell_commands: ['git', 'npm']`
- WHEN Apoc calls `execShell "git status"`
- THEN the command runs normally

#### Scenario: Disallowed command blocked
- GIVEN `allowed_shell_commands: ['git', 'npm']`
- WHEN Apoc calls `execShell "rm -rf ."`
- THEN the command is rejected with an allowlist violation error

#### Scenario: Empty allowlist allows all
- GIVEN `allowed_shell_commands: []`
- WHEN any shell command is called
- THEN it is permitted (no allowlist restriction)

### Requirement: Execution timeout
The system SHALL enforce a maximum execution time for DevKit tool calls (default: 30,000ms).

#### Scenario: Long-running command times out
- GIVEN `devkit.timeout_ms` is 30000
- WHEN a shell command runs for more than 30 seconds
- THEN the operation is terminated and an error is returned

### Requirement: Audit instrumentation
The system SHALL wrap every DevKit tool call with `DevKitInstrument` to emit `tool_call` audit events with tool name, duration, and status.

#### Scenario: Tool call audit event emitted
- GIVEN Apoc calls `readFile` on a valid path
- WHEN the tool completes
- THEN a `tool_call` audit event is inserted with `tool_name = 'readFile'`, `status = 'success'`, and `duration_ms`

#### Scenario: Failed tool call audited
- GIVEN Apoc calls a tool that throws an error
- WHEN the exception is caught
- THEN a `tool_call` audit event with `status = 'error'` is inserted

### Requirement: Config migration
The system SHALL auto-migrate `apoc.working_dir` to `devkit.sandbox_dir` if `devkit.sandbox_dir` is not explicitly set.

#### Scenario: Legacy config migrated
- GIVEN `zaion.yaml` has `apoc.working_dir: /home/user/work` but no `devkit.sandbox_dir`
- WHEN the daemon reads config
- THEN `devkit.sandbox_dir` is set to `/home/user/work` for this session
