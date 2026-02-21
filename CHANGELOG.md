# Changelog

All notable changes to Morpheus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
