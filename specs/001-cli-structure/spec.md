# Feature Specification: CLI Structure

**Feature Branch**: `001-cli-structure`
**Created**: 2026-01-29
**Status**: Draft
**Input**: User description: "implement the cli structure"

## User Scenarios & Testing

### User Story 1 - CLI Installation and Lifecycle (Priority: P1)

As a developer, I want to install Morpheus globally and manage its lifecycle so that I can use the agent in my daily workflow.

**Why this priority**: Fundamental entry point for the application.

**Independent Test**: Can be installed via npm link/install, and `start`/`stop` commands function as expected.

**Acceptance Scenarios**:

1. **Given** a fresh environment, **When** installed globally, **Then** the `morpheus` command is available in PATH.
2. **Given** installed CLI, **When** running `morpheus start`, **Then** the local runtime initiates and the `.morpheus` global directory structure is created if missing.
3. **Given** running agent, **When** running `morpheus stop`, **Then** the agent process terminates gracefully.
4. **Given** any state, **When** running `morpheus status`, **Then** it reports whether the agent is active or inactive.

### User Story 2 - Configuration Management (Priority: P2)

As a user, I want to easily access the configuration so that I can customize the agent's behavior.

**Why this priority**: Essential for setting up API keys and preferences early on.

**Independent Test**: Run `morpheus config` and verify it provides access/path to `config.yaml`.

**Acceptance Scenarios**:

1. **Given** installed CLI, **When** running `morpheus config`, **Then** the system interacts with the `config.yaml` file (displays path or content).

### User Story 3 - Environment Health Check (Priority: P3)

As a user, I want to diagnose issues with my setup so that I can fix environment problems.

**Why this priority**: Helps in troubleshooting installation issues.

**Independent Test**: Run `morpheus doctor` and verify it checks for required dependencies (Node.js, etc).

**Acceptance Scenarios**:

1. **Given** installed CLI, **When** running `morpheus doctor`, **Then** it outputs the status of the Node.js environment and configuration validity.

### Edge Cases

- **Multiple Instances**: attempting to `start` when already running.
- **Missing Config**: `start` runs with no `.morpheus` folder (should auto-create).
- **Port Conflict**: `start` when port 3333 (default) is in use.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide an executable named `morpheus` when installed.
- **FR-002**: `morpheus start` MUST initialize the full `.morpheus` directory structure in the user's home directory if it does not exist, ensuring `commands`, `memory`, `logs`, and `cache` folders are created (even if empty), along with default `config.yaml` and `mcps.json`.
- **FR-003**: `morpheus start` MUST accept flags `--ui` (default true), `--no-ui`, and `--port <number>` to control the web panel.
- **FR-004**: `morpheus start` MUST run as a blocking foreground process by default.
- **FR-005**: `morpheus stop` MUST be able to identify and terminate the running agent process.
- **FR-006**: `morpheus status` MUST detect if the agent is currently running.
- **FR-007**: `morpheus config` MUST print the configuration path and content by default, and support an `--edit` flag to open the default system editor.
- **FR-008**: `morpheus doctor` MUST check for Node.js version >= 18 and validity of `config.yaml`.

### Key Entities

- **Runtime Configuration**: Accesses `~/.morpheus/config.yaml`.
- **Global Directory**: `~/.morpheus` containing subdirectories for operation.
- **Process Lock/PID**: Mechanism to track running state (implied by start/stop/status requirements).

## Success Criteria

### Measurable Outcomes

- **SC-001**: `morpheus --help` returns exit code 0 and lists all 5 subcommands within 200ms.
- **SC-002**: `morpheus start` successfully scaffolds the full `.morpheus` directory tree on first run.
- **SC-003**: `morpheus doctor` correctly identifies a valid vs invalid environment (e.g. Node version check).
