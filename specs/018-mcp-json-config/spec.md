# Feature Specification: MCP JSON Configuration

**Feature Branch**: `018-mcp-json-config`  
**Created**: February 1, 2026  
**Status**: Draft  
**Input**: User description: "Mudar a forma de inserir os mcpsServers: ao rodar o init deve ter um arquivo mcp.json em que o usuário poderá cadastrar os seus MCPs, e será carregado na factory. Se o arquivo já existir não precisa criar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-Time Setup with MCP Template (Priority: P1)

A new user runs `morpheus init` for the first time. The system creates an `mcps.json` file in the Morpheus configuration directory (`~/.morpheus/mcps.json`) with a documented template structure. This file serves as the central place for users to register their MCP servers.

**Why this priority**: This is the core entry point - users need a clear file to configure their MCPs, replacing hardcoded server definitions.

**Independent Test**: Can be tested by running `morpheus init` on a fresh installation and verifying the `mcps.json` file is created with valid template structure.

**Acceptance Scenarios**:

1. **Given** Morpheus is not yet configured (no `~/.morpheus` folder or no `mcps.json`), **When** user runs `morpheus init`, **Then** system creates `~/.morpheus/mcps.json` with a documented template structure containing example MCP entries.

2. **Given** `mcps.json` already exists with user configurations, **When** user runs `morpheus init` again, **Then** system preserves the existing `mcps.json` file without modifications.

3. **Given** `mcps.json` template is created, **When** user opens the file, **Then** user sees clear comments/examples explaining how to add new MCP servers (command, args, env, transport type).

---

### User Story 2 - Loading MCPs from Configuration File (Priority: P1)

When the agent starts, the ToolsFactory reads MCP server definitions from `~/.morpheus/mcps.json` instead of hardcoded values. This enables users to add, remove, or modify MCP servers without changing source code.

**Why this priority**: Equally critical - the file must be consumed by the runtime for the feature to have any value.

**Independent Test**: Can be tested by creating a valid `mcps.json` with test MCP servers and verifying they load correctly when the agent starts.

**Acceptance Scenarios**:

1. **Given** `mcps.json` contains valid MCP server definitions, **When** `morpheus start` is executed, **Then** ToolsFactory loads all configured MCP servers and their tools become available to the agent.

2. **Given** `mcps.json` is empty or contains only the template/comments, **When** `morpheus start` is executed, **Then** agent starts successfully with zero MCP tools loaded (graceful handling).

3. **Given** `mcps.json` contains an MCP server with environment variables, **When** `morpheus start` is executed, **Then** those environment variables are passed to the MCP server process.

---

### User Story 3 - Adding a New MCP Server (Priority: P2)

A user wants to add a new MCP server to their Morpheus agent. They edit the `mcps.json` file directly, adding the new server configuration following the template structure. On next agent restart, the new MCP server is loaded.

**Why this priority**: This is the primary workflow users will follow after initial setup.

**Independent Test**: Can be tested by manually editing `mcps.json` to add a new MCP entry and restarting the agent.

**Acceptance Scenarios**:

1. **Given** user adds a new MCP server entry to `mcps.json`, **When** user restarts morpheus, **Then** the new MCP server is connected and its tools are available.

2. **Given** user removes an MCP server entry from `mcps.json`, **When** user restarts morpheus, **Then** that MCP server is no longer loaded.

3. **Given** user modifies MCP server arguments or environment in `mcps.json`, **When** user restarts morpheus, **Then** the MCP server uses the updated configuration.

---

### User Story 4 - Automatic File Verification on Any CLI Command (Priority: P2)

Whenever the user runs any Morpheus CLI command (not just `init`), the system automatically verifies that essential configuration files exist. If `config.yaml` or `mcps.json` are missing, they are created with default/template content.

**Why this priority**: Ensures a consistent and resilient user experience - users won't encounter "file not found" errors regardless of which command they run first.

**Independent Test**: Can be tested by deleting `mcps.json`, running any command like `morpheus doctor` or `morpheus start`, and verifying the file is recreated.

**Acceptance Scenarios**:

1. **Given** `mcps.json` does not exist, **When** user runs any CLI command (e.g., `morpheus start`, `morpheus doctor`), **Then** system creates `mcps.json` with template structure before proceeding with the command.

2. **Given** `config.yaml` does not exist, **When** user runs any CLI command, **Then** system creates `config.yaml` with default values before proceeding.

3. **Given** both files already exist, **When** user runs any CLI command, **Then** system proceeds normally without modifying existing files.

4. **Given** `~/.morpheus` directory does not exist, **When** user runs any CLI command, **Then** system creates the directory structure and all required files.

---

### User Story 5 - Error Handling for Invalid Configuration (Priority: P2)

If the `mcps.json` file has invalid JSON syntax or malformed entries, the system handles errors gracefully and provides clear feedback to the user.

**Why this priority**: Important for user experience but not blocking core functionality.

**Independent Test**: Can be tested by creating intentionally malformed `mcps.json` files and verifying error handling.

**Acceptance Scenarios**:

1. **Given** `mcps.json` contains invalid JSON syntax, **When** `morpheus start` is executed, **Then** system logs a clear error message indicating the JSON parsing failed and starts without MCP tools.

2. **Given** `mcps.json` contains a server entry missing required fields, **When** `morpheus start` is executed, **Then** system logs a warning for the invalid entry, skips it, and continues loading valid entries.

---

### Edge Cases

- What happens when `mcps.json` has correct syntax but an MCP server fails to connect? → System should use existing `onConnectionError: "ignore"` behavior and log the error.
- What happens when user has read-only permissions on `~/.morpheus`? → System should log a warning and continue with existing files or fail gracefully if files are essential.
- What happens when `mcps.json` is an empty file (0 bytes)? → Should be treated as empty configuration, agent starts with no MCP tools.
- What happens when scaffold runs concurrently (multiple CLI commands)? → File operations should be idempotent and safe for concurrent execution.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create `~/.morpheus/mcps.json` file during `morpheus init` if it does not already exist.
- **FR-002**: System MUST NOT overwrite existing `mcps.json` file when running `morpheus init` or any other command.
- **FR-003**: System MUST provide a template structure in newly created `mcps.json` with documented examples showing how to configure MCP servers.
- **FR-004**: ToolsFactory MUST read MCP server configurations from `mcps.json` instead of hardcoded values.
- **FR-005**: System MUST support MCP server configurations with: name (key), transport type, command, arguments array, and optional environment variables.
- **FR-006**: System MUST automatically verify and create essential configuration files (`config.yaml`, `mcps.json`) when ANY CLI command is executed.
- **FR-007**: System MUST gracefully handle invalid JSON in `mcps.json` by logging an error and starting without MCP tools.
- **FR-008**: System MUST validate individual MCP server entries and skip invalid entries while loading valid ones.
- **FR-009**: System MUST log which MCP servers were successfully loaded and which failed during startup.
- **FR-010**: The scaffold/verification process MUST be idempotent - running multiple times produces the same result without duplicating or corrupting files.

### Key Entities

- **MCP Server Configuration**: Represents a single MCP server to connect to. Contains: unique identifier (name/key), transport type (stdio/sse), command to execute, command arguments, and optional environment variables.
- **MCP Configuration File**: The `mcps.json` file containing a collection of MCP server configurations as a key-value object where keys are server names.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure MCP servers without modifying source code, using only the `mcps.json` file.
- **SC-002**: First-time users can understand how to add MCP servers within 2 minutes by reading the template file.
- **SC-003**: Agent startup succeeds 100% of the time regardless of `mcps.json` state (missing, empty, invalid, or valid).
- **SC-004**: All previously hardcoded MCP servers can be represented in the new JSON format with identical functionality.
- **SC-005**: Users receive clear feedback during startup about which MCP servers loaded successfully and which failed.
- **SC-006**: Any CLI command can be run as the first command (not requiring `morpheus init` first) and essential files will be auto-created.

## Assumptions

- Users are comfortable editing JSON files directly (no UI for MCP configuration in this feature).
- The existing MCP server connection logic and schema sanitization remain unchanged.
- The `PATHS.mcps` constant already exists pointing to `~/.morpheus/mcps.json`.
- Only `stdio` transport type is needed initially (matching current implementation), but the schema should support future transport types like `sse`.
