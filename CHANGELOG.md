# Changelog

All notable changes to Morpheus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Smith — Remote Agent System**: Remote DevKit execution on isolated machines (Docker, VMs, cloud) via WebSocket
  - `SmithRegistry` singleton manages all Smith connections with non-blocking startup
  - `SmithConnection` WebSocket client per Smith instance with token-based auth handshake
  - `SmithDelegator` creates LangChain ReactAgent with **proxy tools** — local DevKit tools built for schema extraction, filtered by Smith capabilities, wrapped in proxies that forward execution to remote Smith via WebSocket
  - Oracle delegates via `smith_delegate` tool (sync or async, like other subagents)
  - New `smiths` config section in `zaion.yaml`: `enabled`, `execution_mode`, `heartbeat_interval_ms`, `connection_timeout_ms`, `task_timeout_ms`, `entries[]` (name, host, port, auth_token)
  - **Hot-reload:** `SmithRegistry.reload()` diffs config vs runtime — connects new entries, disconnects removed ones. Triggered by `PUT /api/smiths/config` and `smith_manage` tool
  - **Resilience:** Max 3 reconnect attempts, 401 auth failures stop retries immediately (`_authFailed` flag), non-blocking startup (connection failures don't block daemon boot)
  - LLM management tools: `smith_list` (list all Smiths with state/capabilities), `smith_manage` (add/remove/ping/enable/disable)
  - REST API router (`src/http/routers/smiths.ts`): `GET /api/smiths`, `GET/PUT /api/smiths/config`, `GET/DELETE /api/smiths/:name`, `POST /api/smiths/:name/ping`, `POST /api/smiths/register`
  - `TaskWorker` routes `agent = 'smith'` tasks to SmithDelegator
  - Smiths tab in Settings UI for configuration management
  - Environment variables: `MORPHEUS_SMITHS_ENABLED`, `MORPHEUS_SMITHS_EXECUTION_MODE`

## [0.7.7] - 2026-02-26

### Added
- **MCP Tool Cache**: Optimized MCP tool loading with in-memory caching
  - Tools are loaded once at startup and cached in `MCPToolCache` singleton
  - `Construtor.create()` returns cached tools instantly (fast path)
  - `Construtor.reload()` forces cache refresh from MCP servers (slow path)
  - Cache statistics available via `Construtor.getStats()` (total tools, per-server counts)
  - New endpoint `GET /api/mcp/stats` returns cache statistics for UI display
  - MCPManager UI now shows tool counts per server
  - Fixes repeated MCP reloads when multiple subagents request tools

- **Discord MCP Commands**: Full MCP management support in Discord
  - `/mcps` — List MCP servers with tool counts
  - `/mcpreload` — Reload MCP connections and display cache stats
  - `/mcp_enable name:` — Enable an MCP server
  - `/mcp_disable name:` — Disable an MCP server
  - Parity with existing Telegram MCP commands

- **Telegram MCP Reload Stats**: `/mcpreload` now displays tool count after reload

- **DevKit Security Sandboxing**: Shared security configuration for all DevKit consumers (Apoc & Keymaker)
  - New `devkit` config section in `zaion.yaml` with sandbox, readonly, category toggles, and shell allowlist
  - **Sandbox enforcement:** `guardPath()` confines ALL file operations (reads AND writes) to `sandbox_dir` (default: CWD)
  - **Shell sandbox:** `run_command` validates `cwd` parameter against `sandbox_dir`
  - **Git sandbox:** `git_clone` and `git_worktree_add` validate destination paths against sandbox
  - **Network sandbox:** `download_file` validates destination path against sandbox
  - **Readonly mode:** Blocks destructive filesystem operations (write, delete, move, copy)
  - **Category toggles:** `enable_filesystem`, `enable_shell`, `enable_git`, `enable_network` to disable entire tool categories
  - **Shell command allowlist:** `allowed_shell_commands` restricts which commands can be executed (empty = allow all)
  - **Auto-migration:** `apoc.working_dir` automatically migrates to `devkit.sandbox_dir`
  - Environment variables: `MORPHEUS_DEVKIT_SANDBOX_DIR`, `MORPHEUS_DEVKIT_READONLY_MODE`, etc.
  - New "DevKit" tab in Settings UI with Security, Tool Categories, and Shell Allowlist sections
  - `apoc.working_dir` deprecated in favor of `devkit.sandbox_dir`
- **Subagent Execution Mode**: Neo, Apoc, and Trinity can now be configured to run synchronously or asynchronously
  - `execution_mode: 'sync' | 'async'` in `zaion.yaml` (under `neo`, `apoc`, `trinity` sections)
  - Environment variables: `MORPHEUS_NEO_EXECUTION_MODE`, `MORPHEUS_APOC_EXECUTION_MODE`, `MORPHEUS_TRINITY_EXECUTION_MODE`
  - **Sync mode**: Oracle executes the subagent inline — result returned directly in the same response turn (no task created)
  - **Async mode** (default): Creates a background task in the queue, delivered via originating channel on completion
  - New "Execution Mode" dropdown in Settings UI for each subagent
- **Verbose Mode**: Real-time tool execution notifications on messaging channels
  - `verbose_mode: true` (default) in `zaion.yaml` — sends `🔧 executing: <tool_name>` to the originating channel (Telegram, Discord) whenever any agent runs a tool
  - Environment variable: `MORPHEUS_VERBOSE_MODE`
  - Channels `api` and `ui` are excluded (they have their own loading states)
  - New "Verbose Mode" toggle in Settings UI → General tab
- **Sync Execution Channel Notification**: When a subagent runs in sync mode, the originating channel receives `⏳ <Agent> is executing your request...` before execution begins

### Fixed
- **Sync Mode Error Propagation**: When subagents (Apoc/Neo/Trinity) fail in sync mode, error messages are now properly returned to the user instead of generic "Task enqueue could not be confirmed" message

## [0.6.8] - 2026-02-25

### Added
- **Agent API Key Encryption**: AES-256-GCM encryption for all agent API keys (Oracle, Sati, Neo, Apoc, Trinity, Audio/Telephonist)
  - Uses same encryption module as Trinity database passwords (`src/runtime/trinity-crypto.ts`)
  - Automatic encryption on save when `MORPHEUS_SECRET` is set
  - Automatic decryption on config load (fail-open: plaintext keys remain usable)
  - New endpoint `GET /api/config/encryption-status` — returns encryption status for all agents
  - UI badges showing encryption status: 🔒 Encrypted, ⚠️ Plaintext, ⚠️ Re-save to encrypt
  - Backward compatible: systems without `MORPHEUS_SECRET` continue working with plaintext keys
  - Warning logged when saving API keys without encryption enabled

- **Environment Variable Override Detection**: UI now detects and blocks fields controlled by environment variables
  - Blue badge "🔒 Env Var" indicates field is managed by environment variable
  - Fields are disabled (read-only) when overridden by env vars
  - Applies to all agent configurations (Oracle, Sati, Neo, Apoc, Trinity, Audio)
  - New endpoint `GET /api/config/env-overrides` returns active overrides

- **ConfigUpdateTool Protection**: Tool now blocks updates to fields overridden by environment variables
  - Throws clear error: `BLOCKED_BY_ENV: Cannot update <fields> because these fields are controlled by environment variables`
  - Prevents Oracle/agents from accidentally overriding env-managed config
  - Guides users to edit `.env` file instead

- **DiagnosticTool Enhancement**: Now checks for `MORPHEUS_SECRET` configuration
  - Warning status if `MORPHEUS_SECRET` is not set
  - Clear message: "API keys and database passwords will be stored in plaintext"
  - Visual indicator: `morpheusSecret: "configured ✓"` or `"NOT SET ⚠️"`

- **Chronos Timezone Fixes**:
  - `ChronosPreview` component now displays next run in selected timezone (not browser local time)
  - `time_verifier` tool returns ISO timestamps with timezone offset (e.g., `2026-02-25T17:25:00-03:00`)
  - Fixes issue where scheduled jobs ran at wrong time on servers with different timezone

### Changed
- `README.md` — updated `MORPHEUS_SECRET` description and added to all Docker examples
- `REPOSITORY.md` — moved `MORPHEUS_SECRET` to required env vars, added generation tip
- `.env.example` — added `MORPHEUS_SECRET` to Security section
- `DOCUMENTATION.md` — added `/api/config/encryption-status` endpoint documentation
- `src/config/manager.ts` — removed auto-decrypt on load (keys stay encrypted in memory)
- `src/config/precedence.ts` — added `getActiveEnvOverrides()`, `isEnvVarSet()`, `isOverriddenByEnv()`
- `src/runtime/trinity-crypto.ts` — added `getUsableApiKey()` for on-demand decryption
- `src/runtime/providers/factory.ts` — uses `getUsableApiKey()` for LLM API calls
- `src/channels/telegram.ts` — uses `getUsableApiKey()` for audio transcription
- `src/channels/discord.ts` — uses `getUsableApiKey()` for audio transcription
- `src/runtime/tools/time-verify-tools.ts` — added `formatDateWithTimezone()` helper

## [0.5.6] - 2026-02-22

### Added
- **Chronos — Temporal Scheduler**: New subsystem for scheduling recurring and one-time Oracle executions
  - Natural-language schedule parser: `"every 30 minutes"`, `"every sunday at 9am"`, `"every weekday"`, `"in 5 minutes"`, `"tomorrow at 9am"`, `"every monday and friday at 8am"`
  - Three schedule types: `once` (auto-disabled after execution), `interval` (natural language → cron), `cron` (raw 5-field expression)
  - Executions run in the user's currently active Oracle session — no dedicated session is created per job
  - Execution context injected as an AI message before each run to provide job metadata without an extra LLM call
  - Delegated tasks spawned during Chronos execution carry `origin_channel: 'telegram'` when a notify function is registered, ensuring proper notification delivery
  - `ChronosWorker.isExecuting` flag blocks management tools (`chronos_schedule`, `chronos_cancel`) during active execution to prevent self-modification
- **Chronos API Endpoints** (Protected):
  - `GET /api/chronos` — list all jobs
  - `POST /api/chronos` — create a new scheduled job
  - `GET /api/chronos/:id` — job details with recent execution preview
  - `PUT /api/chronos/:id` — update job prompt or schedule
  - `DELETE /api/chronos/:id` — delete a job
  - `PATCH /api/chronos/:id/enable` — re-enable a disabled job (recomputes next run)
  - `PATCH /api/chronos/:id/disable` — pause a job without deleting it
  - `GET /api/chronos/:id/executions` — full execution history for a job
  - `POST /api/chronos/preview` — preview next N run timestamps for a schedule expression
  - `GET/POST/DELETE /api/config/chronos` — Chronos worker configuration (poll interval, default timezone)
- **Chronos Telegram Commands**:
  - `/chronos <prompt> @ <schedule>` — create a new scheduled job
  - `/chronos_list` — list all jobs (active and disabled) with 🟢/🔴 status indicators
  - `/chronos_view <id>` — view job details and last 5 executions
  - `/chronos_enable <id>` — re-enable a disabled job
  - `/chronos_disable <id>` — pause a job
  - `/chronos_delete <id>` — delete a job with confirmation prompt
- **Oracle Chronos Tools**: `chronos_schedule`, `chronos_list`, `chronos_cancel`, `chronos_preview` — Oracle can schedule, list, cancel, and preview jobs on behalf of the user
- **Chronos UI Page** (`/chronos`): full management interface with job table, create/edit modal, execution history drawer, and enable/disable/delete actions with confirmation

## [0.5.1] - 2026-02-21

### Added
- **MCP Reload**: `POST /api/mcp/reload` hot-reloads MCP tool connections without restarting the daemon
  - Telegram command `/mcpreload` triggers reload via bot
  - UI button in MCP Manager page
- **Morpheus Tools Consolidation**: configuration, diagnostics, analytics, and task management tools merged into the `morpheus-tools` module for cleaner internal tooling

## [0.5.0] - 2026-02-19

### Added
- **Trinity Subagent**: New database specialist agent, invoked by Oracle via `trinity_delegate`
  - Supports PostgreSQL (`pg`), MySQL (`mysql2`), SQLite (`better-sqlite3`), MongoDB (`mongodb`)
  - Schema introspection and caching
  - Per-database permission flags: `allow_read`, `allow_insert`, `allow_update`, `allow_delete`, `allow_ddl`
  - Database passwords encrypted at rest with AES-256-GCM (`MORPHEUS_SECRET`)
  - Singleton pattern with `Trinity.getInstance()`
  - Independently configurable LLM provider/model/temperature
  - New `trinity` config section in `~/.morpheus/zaion.yaml` (optional, falls back to Oracle config)
  - New `trinity.db` registry database at `~/.morpheus/memory/trinity.db`
- **Trinity API Endpoints**:
  - `GET/POST/PUT/DELETE /api/trinity/databases` — CRUD for registered databases
  - `GET /api/trinity/databases/:id` — database details
  - `POST /api/trinity/databases/:id/test` — test connection
  - `POST /api/trinity/databases/:id/refresh-schema` — re-introspect schema
  - `GET/POST/DELETE /api/config/trinity` — Trinity agent configuration
- **Trinity Telegram Commands**:
  - `/trinity` — list registered databases with inline test/refresh/delete actions
  - `/zaion` now shows Trinity agent config
- **TrinityDatabases UI Page** (`/trinity-databases`): register and manage databases, test connections, refresh schema, configure permissions
- **Agents Settings — Trinity tab**: dedicated sub-tab for Trinity LLM config (provider, model, temperature, API key)
- **Task Worker Trinity support**: `TaskWorker` routes tasks with `agent = 'trinit'` to Trinity agent

### Changed
- **Multi-agent table**: Oracle now delegates to `trinity_delegate` in addition to `neo_delegate` and `apoc_delegate`

## [0.4.0] - 2026-02-18

### Added
- **Apoc DevTools Subagent**: New specialized subagent for developer operations, invoked by Oracle
  - Oracle automatically delegates to Apoc via `apoc_delegate` tool when user requests file, shell, git, network, package, process, or system operations
  - DevKit tool set: `read_file`, `write_file`, `append_file`, `delete_file`, `run_command`, git ops, npm ops, process listing, ping, curl, system info, and more
  - Singleton pattern with `Apoc.getInstance()` — one instance per daemon lifecycle
  - Independently configurable LLM provider, model, temperature, working directory, and timeout
  - New `apoc` config section in `~/.morpheus/zaion.yaml` (optional, falls back to Oracle config)
  - API endpoints: `GET/POST/DELETE /api/config/apoc`
  - Env vars: `MORPHEUS_APOC_PROVIDER`, `MORPHEUS_APOC_MODEL`, `MORPHEUS_APOC_TEMPERATURE`, `MORPHEUS_APOC_API_KEY`, `MORPHEUS_APOC_WORKING_DIR`, `MORPHEUS_APOC_TIMEOUT_MS`

- **`ProviderFactory.createBare()`**: New method for creating clean ReactAgent instances without Oracle's internal tools — used by Apoc and future subagents

- **Neo agent config endpoints**: `GET/POST/DELETE /api/config/neo` — independently configure Neo's LLM settings

- **Settings UI — Agents tab**: Renamed "LLM" tab to "Agents" with four sub-tabs
  - **Oracle** sub-tab: provider, model, temperature, max tokens, context window, API key
  - **Sati** sub-tab: memory-specific LLM config + memory limit + archived sessions toggle
  - **Neo** sub-tab: provider, model, temperature, API key, base URL, context window
  - **Apoc** sub-tab: provider, model, temperature, API key, working directory, timeout

## [0.3.1] - 2026-02-14

### Fixed
- **Telegram `/restart` infinite loop**: The `/restart` command was causing a restart loop in production. Telegraf stores the polling offset (update_id) only in memory; when the process exited before acknowledging the current update to Telegram, the `/restart` message was re-delivered on the next startup and processed again indefinitely. Fixed by calling `getUpdates` with `offset = update_id + 1` before restarting, explicitly confirming to Telegram that the update was processed.

### Added
- **Sati Agent UI Configuration**: Added dedicated UI section for configuring the Sati memory agent independently from Oracle
  - New "Sati Agent" section in Settings page (LLM tab) below "Oracle Agent"
  - Toggle to use same configuration as Oracle Agent for easy setup
  - Separate LLM provider, model, API key, and context window settings for Sati
  - API endpoints: GET/POST/DELETE `/api/config/sati` for managing Sati configuration
  - Sati config persists to `santi` key in config file, falls back to Oracle config when not set
- **Restart Command**: Added restart functionality across all interfaces
  - CLI command: `morpheus restart` to restart the agent
  - Web UI: Restart button in the sidebar above the logout button with confirmation modal
  - Telegram: `/restart` command to restart the agent with user notification after restart
  - API endpoint: POST `/api/restart` to trigger agent restart
  - The restart mechanism properly shuts down all services before restarting

### Changed
- **BREAKING**: Renamed `memory.limit` configuration to `llm.context_window` for semantic clarity
  - This field controls how many messages from history are sent to the LLM, not memory storage limits
  - Automatic migration runs on startup - existing configs are migrated seamlessly
  - Backward compatibility maintained: old `memory.limit` field still works via fallback
  - Web UI updated: field moved to "LLM Configuration" section with label "Context Window (Messages)"
  - Init command now prompts for "Context Window Size" instead of "Memory Limit"
  - Doctor command validates `llm.context_window` and detects deprecated `memory.limit` usage
- Renamed "LLM Configuration" to "Oracle Agent" in UI for clarity

### Migration Guide
If you're upgrading from a previous version:
1. **Automatic**: On first start after upgrade, your config will auto-migrate
2. **Manual** (optional): Edit `~/.morpheus/config.yaml` and move `memory.limit` to `llm.context_window` under the `llm` section
3. **Rollback**: If needed, a backup is created at `~/.morpheus/config.yaml.backup-<timestamp>`

Example:
```yaml
# Before (deprecated)
memory:
  limit: 100

# After (recommended)
llm:
  context_window: 100
```
