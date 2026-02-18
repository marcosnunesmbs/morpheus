
<div align="center">
  <img src="./assets/logo.png" alt="Morpheus Logo" width="220" />
</div>

# Morpheus

## 🚀 Overview

**Morpheus** is a *local-first* AI operator that acts as a smart bridge between the developer and their systems. Inspired by the "matrix operator" concept, it runs as a persistent background daemon, orchestrating interactions between **Large Language Models (LLMs)**, **local tools**, and **multiple communication channels**.

The project solves the problem of fragmentation and lack of agency in current AI tools. Unlike a stateless browser chat, Morpheus lives on your machine, maintains long-term memory (Sati), and has real execution capability through MCPs (Model Context Protocol).

### Key Differentiators
*   **Data Sovereignty**: Local database and logs. Nothing leaves your machine without permission.
*   **Sati Memory**: Dual-layer memory system (short/long term) that organically learns preferences and facts.
*   **Pluggable Architecture**: Native integration with standard MCP tools.
*   **Omnichannel Presence**: Interact via Terminal, Web UI, or Telegram (with audio).

---

## ✨ Features

*   **Persistent Agent**: Node.js daemon that maintains state and context across restarts.
*   **Multi-LLM Support**: Agnostic integration with OpenAI, OpenRouter, Anthropic, Google Gemini, and Ollama.
*   **Multi-Agent Architecture**: Three specialized agents with independent LLM configurations:
    *   **Oracle** — main orchestrator, handles all user-facing conversation and reasoning.
    *   **Sati** — background memory agent, extracts and consolidates long-term facts after each conversation.
    *   **Apoc** — DevTools executor, runs file/shell/git/network operations delegated by Oracle.
*   **Apoc DevTools Subagent**:
    *   Oracle automatically delegates dev operations to Apoc via the `apoc_delegate` tool.
    *   DevKit capabilities: read/write/delete files, run shell commands, git operations, network (curl/ping/DNS), package management (npm/yarn), process inspection, system info.
    *   Independently configurable LLM provider, model, working directory, and timeout.
*   **Sati Memory (Mindfulness)**:
    *   Middleware that intercepts conversations to extract and store important facts in `sati-memory.db`.
    *   Independent configuration (allows using a smarter/cheaper model just for memory management).
*   **MCP Protocol**: Dynamic tool loading via the `~/.morpheus/mcps.json` file.
*   **Matrix Web Interface**: Local dashboard for monitoring, configuration, and **interactive chat**, password-protected (`THE_ARCHITECT_PASS`).
    *   **Web Chat**: Full-featured chat interface accessible from the browser with session management (create, archive, delete, rename).
    *   **Cross-Channel Sessions**: View and interact with sessions started on any channel (Telegram, Web, etc.).
    *   **Agents Settings**: Configure Oracle, Sati, and Apoc independently via dedicated sub-tabs under the "Agents" settings section.
*   **Telegram/Discord Chatbot**: Mobile interface with voice transcription support via Google GenAI and session management commands.
*   **Hot-Reload Configuration**: APIs for dynamic agent parameter adjustment without restarting the process.
*   **Usage Analytics**: Granular monitoring of token consumption by provider and model.
*   **Webhook System**: External triggers that queue Oracle agent executions and deliver results as notifications.
    *   Each webhook has a unique slug (URL identifier) and an independent `api_key` (validated via `x-api-key` header).
    *   Fire-and-forget execution: the HTTP endpoint responds `202 Accepted` immediately; Oracle runs asynchronously.
    *   Notification channels: **UI** (inbox with unread badge, 5s polling) and/or **Telegram** (proactive push).
    *   Full CRUD management via Web UI and REST API.

---

## 🤖 Telegram Commands

The Morpheus Telegram bot supports several commands for interacting with the agent:

- `/start` - Show welcome message and available commands
- `/status` - Check the status of the Morpheus agent
- `/doctor` - Diagnose environment and configuration issues
- `/stats` - Show token usage statistics
- `/help` - Show available commands
- `/zaion` - Show system configurations
- `/sati <qnt>` - Show specific memories
- `/newsession` - Archive current session and start fresh
- `/sessions` - List all sessions with options to switch, archive, or delete
- `/restart` - Restart the Morpheus agent
- `/mcp` or `/mcps` - List registered MCP servers

---

## 🧠 Architecture

Morpheus uses a **Modular Monolith** architecture with a middleware-based control flow.

### High-Level Diagram

```mermaid
graph TD
    User(["User"]) -->|Chat/Voice| Channel["Channel Adapters<br/>(Telegram/Discord/UI)"]
    Channel -->|Normalized Event| Oracle["Oracle Agent<br/>(Runtime Core)"]

    External(["External Service<br/>(CI/CD, GitHub Actions)"]) -->|POST /api/webhooks/trigger/:name<br/>x-api-key header| WebhookRouter["Webhook Router<br/>(Express)"]
    WebhookRouter -->|202 Accepted| External
    WebhookRouter -->|async dispatch| Dispatcher["WebhookDispatcher"]
    Dispatcher -->|oracle.chat(prompt + payload)| Oracle

    subgraph "Cognitive Cycle"
        Oracle -->|1. Retrieval| Sati["Sati Middleware<br/>(Long-Term Memory)"]
        Sati <-->|Query| GraphDB[("Sati DB")]

        Oracle -->|2. Context| ShortMem[("Session DB")]

        Oracle -->|3. Inference| LLM["LLM Provider<br/>(OpenAI/Ollama/etc)"]

        Oracle -->|4a. MCP Action| ToolManager["Tool Manager"]
        ToolManager <-->|Execution| MCP["MCP Servers"]

        Oracle -->|4b. Dev Operation| Apoc["Apoc Subagent<br/>(DevTools)"]
        Apoc <-->|DevKit Tools| DevKit["Filesystem / Shell<br/>Git / Network / Packages<br/>Processes / System"]

        Oracle -->|5. Consolidation| Sati
    end

    Oracle -->|Response| Channel
    Dispatcher -->|Save result| NotifDB[("Notifications<br/>short-memory.db")]
    Dispatcher -->|Push message| TelegramBot["Telegram Bot<br/>(optional)"]
```

### Multi-Agent Architecture

Morpheus implements a **two-tier multi-agent pattern** where each agent has a specific role and can use a different LLM:

| Agent | Role | Tools |
|-------|------|-------|
| **Oracle** | Orchestrator — handles all user-facing conversation, reasoning, and delegation | MCP servers, internal tools, `apoc_delegate` |
| **Sati** | Background evaluator — consolidates long-term memories after each conversation | LLM only (no tools) |
| **Apoc** | DevTools executor — runs file/shell/git/network ops on Oracle's behalf | DevKit (filesystem, shell, git, network, packages, processes, system) |

Each agent can independently use a different LLM provider/model, configured under `llm`, `sati`, and `apoc` sections in `config.yaml`.

### Apoc DevKit Tools

| Category | Tools |
|----------|-------|
| **Filesystem** | `read_file`, `write_file`, `append_file`, `delete_file`, `list_directory`, `create_directory` |
| **Shell** | `run_command` (with configurable timeout and working directory) |
| **Git** | `git_status`, `git_log`, `git_diff`, `git_clone`, `git_commit`, `git_checkout`, and more |
| **Network** | `curl`, `ping`, `dns_lookup` |
| **Packages** | `npm_install`, `npm_run`, `yarn_add`, `yarn_run` |
| **Processes** | `list_processes`, `kill_process` |
| **System** | `system_info`, `disk_usage`, `env_vars` |

### Architectural Decisions
*   **Oracle**: The orchestrator core that implements the thinking interface. It is agnostic to the AI provider.
*   **Apoc**: A singleton subagent (`Apoc.getInstance()`) created once per daemon lifecycle. Oracle calls it via the `apoc_delegate` tool, passing a natural language task description. Apoc uses `ProviderFactory.createBare()` for a clean agent context with only DevKit tools — no Oracle internal tools.
*   **Sati Middleware**: An independent "sub-agent" that runs before and after the main cycle to manage memory without polluting business logic.
*   **Isolated Channels**: Each channel (Telegram, CLI, HTTP) is an isolated module that only emits and receives standardized events.

---

## 📂 Folder Structure

```
/src
  /channels     # Input/output adapters (Telegram, Discord)
  /cli          # Terminal commands and daemon process management
  /config       # Schema definitions (Zod) and YAML loading
  /devkit       # DevKit tool factories (filesystem, shell, git, network, packages, processes, system)
  /http         # Express API server and REST routes
    api.ts                # Main auth-guarded API router
    server.ts             # HttpServer (mounts all routers)
    webhooks-router.ts    # Webhook trigger + management endpoints
  /runtime      # Core business logic
    /memory     # Storage implementations (SQLite, Sati)
    /providers  # Factory for LLM clients — create() and createBare()
    /tools      # MCP client, local tools, and apoc-tool.ts (apoc_delegate)
    /webhooks   # Webhook subsystem
      types.ts        # Webhook & WebhookNotification interfaces
      repository.ts   # SQLite CRUD (webhooks + webhook_notifications tables)
      dispatcher.ts   # Async orchestration — Oracle call, notification update, channel dispatch
    apoc.ts     # Apoc DevTools subagent (singleton, uses DevKit)
    oracle.ts   # Oracle main agent (ReactAgent + apoc_delegate tool)
  /types        # Shared TypeScript interfaces (MorpheusConfig, ApocConfig, etc.)
  /ui           # Frontend source code (React/Vite)
    /pages
      WebhookManager.tsx   # CRUD page for managing webhooks
      Notifications.tsx    # Notification inbox with unread badge
    /services
      webhooks.ts          # API client for webhook endpoints
```

---

## ⚙️ Installation

### Prerequisites
*   **Node.js**: v18.0.0 or higher (Requires ESM and native fetch support).
*   **NPM**: v9.0.0 or higher.
*   **Python/Build Tools**: Required on some OSes to compile `better-sqlite3`.

### Global Installation
For use as a system tool:

```bash
npm install -g morpheus-cli
```

### Environment Variables
Create a `.env` file at the root or configure in your shell.

| Variable | Description | Required |
| -------- | ----------- | -------- |
| `OPENAI_API_KEY` | OpenAI API key (if using GPT) | No |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using Claude) | No |
| `GOOGLE_API_KEY` | Google AI key (for Gemini and Audio) | Yes (for Voice) |
| `OPENROUTER_API_KEY` | OpenRouter API key (if using OpenRouter) | No |
| `THE_ARCHITECT_PASS` | Web Dashboard access password | Recommended |
| `TELEGRAM_BOT_TOKEN` | BotFather token | No |

The system also supports generic environment variables that apply to all providers:

| Variable | Description | Applies To |
|----------|-------------|------------|
| `MORPHEUS_AGENT_NAME` | Name of the agent | agent.name |
| `MORPHEUS_AGENT_PERSONALITY` | Personality of the agent | agent.personality |
| `MORPHEUS_LLM_PROVIDER` | LLM provider to use | llm.provider |
| `MORPHEUS_LLM_MODEL` | Model name for LLM | llm.model |
| `MORPHEUS_LLM_TEMPERATURE` | Temperature setting for LLM | llm.temperature |
| `MORPHEUS_LLM_MAX_TOKENS` | Maximum tokens for LLM | llm.max_tokens |
| `MORPHEUS_LLM_CONTEXT_WINDOW` | Context window size for LLM | llm.context_window |
| `MORPHEUS_LLM_API_KEY` | Generic API key for LLM (lower precedence than provider-specific keys) | llm.api_key |
| `MORPHEUS_SATI_PROVIDER` | Sati provider to use | santi.provider |
| `MORPHEUS_SATI_MODEL` | Model name for Sati | santi.model |
| `MORPHEUS_SATI_TEMPERATURE` | Temperature setting for Sati | santi.temperature |
| `MORPHEUS_SATI_MAX_TOKENS` | Maximum tokens for Sati | santi.max_tokens |
| `MORPHEUS_SATI_CONTEXT_WINDOW` | Context window size for Sati | santi.context_window |
| `MORPHEUS_SATI_API_KEY` | Generic API key for Sati (lower precedence than provider-specific keys) | santi.api_key |
| `MORPHEUS_SATI_MEMORY_LIMIT` | Memory retrieval limit for Sati | santi.memory_limit |
| `MORPHEUS_SATI_ENABLED_ARCHIVED_SESSIONS`| Enable/disable retrieval of archived sessions in Sati | santi.enableArchivedSessions |
| `MORPHEUS_APOC_PROVIDER` | LLM provider for Apoc subagent | apoc.provider |
| `MORPHEUS_APOC_MODEL` | Model name for Apoc subagent | apoc.model |
| `MORPHEUS_APOC_TEMPERATURE` | Temperature setting for Apoc | apoc.temperature |
| `MORPHEUS_APOC_API_KEY` | API key for Apoc (falls back to provider-specific key) | apoc.api_key |
| `MORPHEUS_APOC_WORKING_DIR` | Working directory for Apoc shell/file operations | apoc.working_dir |
| `MORPHEUS_APOC_TIMEOUT_MS` | Timeout in milliseconds for Apoc tool execution | apoc.timeout_ms |
| `MORPHEUS_AUDIO_MODEL` | Model name for audio processing | audio.model |
| `MORPHEUS_AUDIO_ENABLED` | Enable/disable audio processing | audio.enabled |
| `MORPHEUS_AUDIO_API_KEY` | Generic API key for audio (lower precedence than provider-specific keys) | audio.apiKey |
| `MORPHEUS_AUDIO_MAX_DURATION` | Max duration for audio processing | audio.maxDurationSeconds |
| `MORPHEUS_TELEGRAM_ENABLED` | Enable/disable Telegram channel | channels.telegram.enabled |
| `MORPHEUS_TELEGRAM_TOKEN` | Telegram bot token | channels.telegram.token |
| `MORPHEUS_TELEGRAM_ALLOWED_USERS` | Comma-separated list of allowed Telegram user IDs | channels.telegram.allowedUsers |
| `MORPHEUS_UI_ENABLED` | Enable/disable Web UI | ui.enabled |
| `MORPHEUS_UI_PORT` | Port for Web UI | ui.port |
| `MORPHEUS_LOGGING_ENABLED` | Enable/disable logging | logging.enabled |
| `MORPHEUS_LOGGING_LEVEL` | Logging level | logging.level |
| `MORPHEUS_LOGGING_RETENTION` | Log retention period | logging.retention |

**Precedence Order**: The system follows this order of precedence when resolving configuration values:
1. Provider-specific environment variable (e.g., `OPENAI_API_KEY`) - Highest priority
2. Generic environment variable (e.g., `MORPHEUS_LLM_API_KEY`) - Medium priority
3. Configuration file value (e.g., `config.llm.api_key`) - Lower priority
4. Default value - Lowest priority

> **Note**: If `THE_ARCHITECT_PASS` is not set, the system will use the default password `iamthearchitect`. This is less secure and it's recommended to set your own password in production environments.

---

## ▶️ How to Run

### Initial Setup
Before running for the first time, generate the configuration files:

```bash
morpheus init
```
This will create the `~/.morpheus` folder containing `config.yaml` (general config) and `mcps.json` (tools).

### Configuration File Reference

Full example of `~/.morpheus/config.yaml` with all three agents configured:

```yaml
agent:
  name: Morpheus
  personality: "Stoic, precise, and helpful AI operator."

llm:                          # Oracle agent (main orchestrator)
  provider: openai
  model: gpt-4o
  temperature: 0.7
  max_tokens: 4096
  context_window: 100         # Number of recent messages sent to LLM
  api_key: env:OPENAI_API_KEY

sati:                         # Sati memory agent (optional, falls back to llm)
  provider: openai
  model: gpt-4o-mini
  temperature: 0.3
  memory_limit: 1000
  enableArchivedSessions: false

apoc:                         # Apoc DevTools subagent (optional, falls back to llm)
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  temperature: 0.2
  api_key: env:ANTHROPIC_API_KEY
  working_dir: /home/user/projects   # Constrain filesystem operations to this path
  timeout_ms: 30000                  # Max time for shell command execution

channels:
  telegram:
    enabled: true
    token: env:TELEGRAM_BOT_TOKEN
    allowedUsers:
      - "123456789"

ui:
  enabled: true
  port: 3333

audio:
  enabled: true
  provider: gemini
  apiKey: env:GOOGLE_API_KEY
  maxDurationSeconds: 300

logging:
  enabled: true
  level: info
  retention: 7d
```

### Production (Daemon)
Starts the agent in the background and frees the terminal.

```bash
morpheus start
```

If an existing instance is running, you'll be prompted to stop it and start a new one. To automatically agree and restart without prompting:

```bash
morpheus start -y
```

*   **Dashboard**: `http://localhost:3333`
*   **Status**: Use `morpheus status` to see the PID.
*   **Logs**: Use `morpheus logs` (if implemented) or check `~/.morpheus/logs`.

### Development
To contribute to the code:

```bash
# Terminal 1: Backend in watch mode
npm run dev:cli

# Terminal 2: Frontend (UI)
npm run dev:ui
```

---

## 🧪 Tests

Tests are written using **Vitest** and follow a unit and integration testing strategy focused on features.

```bash
# Run full suite
npm test

# Run tests for a specific file
npm test oracle
```

**Structure**: Tests are located in `__tests__` folders near the code they test (co-location).

---

## 🔌 Integrations / MCPs

Morpheus adopts the **Model Context Protocol (MCP)** standard for tools.

### Registering MCPs
Edit `~/.morpheus/mcps.json` to add servers. The system supports `stdio` (local execution) and `http` (remote) transports.

**Example (`mcps.json`):**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "e:/projetos"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_..." }
    }
  }
}
```

---

## 🧩 How It Works Internally

The flow of an interaction follows these steps:

1.  **Reception**: The `TelegramAdapter` receives a webhook, validates the `chat_id` against the allowlist defined in the configuration.
2.  **Pre-Processing (Middleware)**:
    *   The Sati `beforeAgent` endpoint is triggered.
    *   It searches `santi-memory.db` for facts semantically relevant to the current input.
    *   Found facts are injected as `SystemMessage` in the message array.
3.  **Deliberation (Oracle — ReAct Loop)**:
    *   Oracle queries the configured LLM with the assembled prompt.
    *   If the LLM requests an MCP tool (e.g., GitHub, database), Oracle executes it via the MCP client.
    *   If the LLM requests a **dev operation** (file, shell, git, network, process, or system), Oracle calls the `apoc_delegate` tool.
4.  **Delegation (Apoc)**:
    *   Apoc receives the delegated task (natural language description + optional context).
    *   Apoc runs its own ReAct loop using only **DevKit tools** (no Oracle internal tools).
    *   Apoc returns the result to Oracle, which integrates it and continues its own ReAct loop.
5.  **Post-Processing (Middleware)**:
    *   The Sati `afterAgent` endpoint is triggered with the full interaction history.
    *   A parallel (fire-and-forget) process analyzes the conversation to extract new facts.
    *   New facts are saved in the long-term database.
6.  **Delivery**: The final response is sent to the user via the Telegram adapter.

---

## 📡 API

The REST API runs on port 3333 (configurable) and serves both the UI and local integrations.

### Health Check Endpoints

#### GET `/health`
Public health check endpoint without authentication.

*   **Response:**
    ```json
    {
      "status": "healthy",
      "timestamp": "2026-02-05T21:30:00.000Z",
      "uptime": 123.45
    }
    ```

#### GET `/api/health`
Health check endpoint for the API (requires authentication).

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "status": "healthy",
      "timestamp": "2026-02-05T21:30:00.000Z",
      "uptime": 123.45
    }
    ```

### Status Endpoint

#### GET `/api/status`
Get the current status of the Morpheus agent.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "status": "online",
      "uptimeSeconds": 1234.56,
      "pid": 12345,
      "projectVersion": "1.0.0",
      "nodeVersion": "v18.17.0",
      "agentName": "Morpheus",
      "llmProvider": "openai",
      "llmModel": "gpt-4-turbo"
    }
    ```

### Configuration Endpoints

#### GET `/api/config`
Retrieve the current configuration.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "agent": {
        "name": "Morpheus",
        "personality": "stoic, wise, and helpful"
      },
      "llm": {
        "provider": "openai",
        "model": "gpt-4-turbo",
        "temperature": 0.7,
        "context_window": 100,
        "api_key": "***"
      },
      "santi": {
        "provider": "openai",
        "model": "gpt-4o",
        "memory_limit": 1000
      },
      "channels": {
        "telegram": {
          "enabled": true,
          "token": "***",
          "allowedUsers": ["123456789"]
        },
        "discord": {
          "enabled": false
        }
      },
      "ui": {
        "enabled": true,
        "port": 3333
      },
      "audio": {
        "enabled": true,
        "apiKey": "***",
        "maxDurationSeconds": 300
      }
    }
    ```

#### POST `/api/config`
Update the configuration.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Body:** Complete configuration object (same structure as GET response).
*   **Response:**
    ```json
    {
      "agent": {
        "name": "Morpheus",
        "personality": "stoic, wise, and helpful"
      },
      "llm": {
        "provider": "openai",
        "model": "gpt-4-turbo",
        "temperature": 0.7,
        "context_window": 100,
        "api_key": "***"
      },
      "santi": {
        "provider": "openai",
        "model": "gpt-4o",
        "memory_limit": 1000
      },
      "channels": {
        "telegram": {
          "enabled": true,
          "token": "***",
          "allowedUsers": ["123456789"]
        },
        "discord": {
          "enabled": false
        }
      },
      "ui": {
        "enabled": true,
        "port": 3333
      },
      "audio": {
        "enabled": true,
        "apiKey": "***",
        "maxDurationSeconds": 300
      }
    }
    ```

#### GET `/api/config/sati`
Retrieve the Sati (long-term memory) configuration.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "provider": "openai",
      "model": "gpt-4o",
      "memory_limit": 1000
    }
    ```

#### POST `/api/config/sati`
Update the Sati (long-term memory) configuration.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Body:**
    ```json
    {
      "provider": "openai",
      "model": "gpt-4o",
      "memory_limit": 1000
    }
    ```
*   **Response:**
    ```json
    {
      "success": true
    }
    ```

#### DELETE `/api/config/sati`
Remove the Sati (long-term memory) configuration (falls back to Oracle config).

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "success": true
    }
    ```

#### GET `/api/config/apoc`
Retrieve the Apoc (DevTools subagent) configuration.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "provider": "openai",
      "model": "gpt-4o",
      "temperature": 0.2,
      "api_key": "***",
      "working_dir": "/home/user/projects",
      "timeout_ms": 30000
    }
    ```
*   **Note:** If no dedicated Apoc config exists, this endpoint returns the Oracle (`llm`) config values as fallback, with Apoc-specific defaults for `temperature` (0.2) and `timeout_ms` (30000).

#### POST `/api/config/apoc`
Update the Apoc (DevTools subagent) configuration.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Body:**
    ```json
    {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "temperature": 0.1,
      "api_key": "sk-ant-...",
      "working_dir": "/home/user/projects",
      "timeout_ms": 60000
    }
    ```
*   **Response:**
    ```json
    {
      "success": true
    }
    ```

#### DELETE `/api/config/apoc`
Remove the Apoc configuration (falls back to Oracle config).

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "success": true
    }
    ```

### Statistics Endpoints

#### GET `/api/stats/usage`
Get global token usage statistics.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "totalInputTokens": 12345,
      "totalOutputTokens": 6789,
      "totalTokens": 19134
    }
    ```

#### GET `/api/stats/usage/grouped`
Get token usage statistics grouped by provider and model.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    [
      {
        "provider": "openai",
        "model": "gpt-4-turbo",
        "totalTokens": 12345,
        "inputTokens": 10000,
        "outputTokens": 2345,
        "messageCount": 100
      },
      {
        "provider": "anthropic",
        "model": "claude-3-opus",
        "totalTokens": 6789,
        "inputTokens": 5000,
        "outputTokens": 1789,
        "messageCount": 50
      }
    ]
    ```

### Sati Memories Endpoints

#### GET `/api/sati/memories`
Retrieve all memories stored by the Sati agent (long-term memory).

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    [
      {
        "id": "unique-id",
        "category": "work",
        "importance": "high",
        "summary": "Memory summary",
        "details": "Additional details of the memory",
        "hash": "unique-hash",
        "source": "source",
        "created_at": "2023-01-01T00:00:00.000Z",
        "updated_at": "2023-01-01T00:00:00.000Z",
        "last_accessed_at": "2023-01-01T00:00:00.000Z",
        "access_count": 5,
        "version": 1,
        "archived": false
      }
    ]
    ```

#### DELETE `/api/sati/memories/:id`
Archive (soft delete) a specific memory from the Sati agent.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Parameters:** `id` - ID of the memory to archive.
*   **Response:**
    ```json
    {
      "success": true,
      "message": "Memory archived successfully"
    }
    ```

#### POST `/api/sati/memories/bulk-delete`
Archive (soft delete) multiple memories from the Sati agent at once.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Body:**
    ```json
    {
      "ids": ["id1", "id2", "id3"]
    }
    ```
*   **Response:**
    ```json
    {
      "success": true,
      "message": "X memories archived successfully",
      "deletedCount": X
    }
    ```

### MCP Server Endpoints

#### GET `/api/mcp/servers`
List all registered MCP servers.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "servers": [
        {
          "name": "coolify",
          "config": {
            "transport": "stdio",
            "command": "npx",
            "args": ["-y", "@coolify/mcp-server"],
            "env": {
              "COOLIFY_URL": "https://app.coolify.io",
              "COOLIFY_TOKEN": "your-token"
            }
          },
          "enabled": true
        },
        {
          "name": "coingecko",
          "config": {
            "transport": "http",
            "url": "https://mcps.mnunes.xyz/coingecko/mcp"
          },
          "enabled": false
        }
      ]
    }
    ```

#### POST `/api/mcp/servers`
Add a new MCP server.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Body:**
    ```json
    {
      "name": "new-server",
      "config": {
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@new-mcp-server"],
        "env": {
          "NEW_SERVER_URL": "https://example.com",
          "NEW_SERVER_TOKEN": "your-token"
        }
      }
    }
    ```
*   **Response:**
    ```json
    {
      "ok": true
    }
    ```

#### PUT `/api/mcp/servers/:name`
Update an existing MCP server.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Parameters:** `name` - Name of the server to update.
*   **Body:**
    ```json
    {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@updated-mcp-server"],
      "env": {
        "UPDATED_SERVER_URL": "https://example.com",
        "UPDATED_SERVER_TOKEN": "your-updated-token"
      }
    }
    ```
*   **Response:**
    ```json
    {
      "ok": true
    }
    ```

#### DELETE `/api/mcp/servers/:name`
Delete an MCP server.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Parameters:** `name` - Name of the server to delete.
*   **Response:**
    ```json
    {
      "ok": true
    }
    ```

#### PATCH `/api/mcp/servers/:name/toggle`
Enable or disable an MCP server.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Parameters:** `name` - Name of the server to toggle.
*   **Body:**
    ```json
    {
      "enabled": true
    }
    ```
*   **Response:**
    ```json
    {
      "ok": true
    }
    ```

### Logging Endpoints

#### GET `/api/logs`
List all log files.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    [
      {
        "name": "morpheus.log",
        "size": 10240,
        "modified": "2026-02-05T21:30:00.000Z"
      },
      {
        "name": "morpheus-2026-02-04.log",
        "size": 20480,
        "modified": "2026-02-04T21:30:00.000Z"
      }
    ]
    ```

#### GET `/api/logs/:filename`
Get the last lines of a specific log file.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Parameters:** `filename` - Name of the log file to read.
*   **Query Parameters:** `limit` - Number of lines to return (default: 50).
*   **Response:**
    ```json
    {
      "lines": [
        "2026-02-05T21:30:00.000Z INFO: Starting Morpheus agent...",
        "2026-02-05T21:30:01.000Z DEBUG: Connected to OpenAI API",
        "2026-02-05T21:30:02.000Z INFO: Telegram bot initialized"
      ]
    }
    ```

### Control Endpoints

#### POST `/api/restart`
Restart the Morpheus agent.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "success": true,
      "message": "Restart initiated. Process will shut down and restart shortly."
    }
    ```

### Session Management Endpoints

#### GET `/api/sessions`
List all active and paused sessions.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    [
      {
        "id": "session-uuid",
        "title": "Session Title",
        "status": "active",
        "started_at": 1707168000000
      }
    ]
    ```

#### POST `/api/sessions`
Create a new session.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Response:**
    ```json
    {
      "success": true,
      "id": "new-session-uuid",
      "message": "New session started"
    }
    ```

#### DELETE `/api/sessions/:id`
Delete a specific session.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Parameters:** `id` - Session ID to delete.
*   **Response:**
    ```json
    {
      "success": true,
      "message": "Session deleted"
    }
    ```

#### POST `/api/sessions/:id/archive`
Archive a specific session.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Parameters:** `id` - Session ID to archive.
*   **Response:**
    ```json
    {
      "success": true,
      "message": "Session archived"
    }
    ```

#### PATCH `/api/sessions/:id/title`
Rename a specific session.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Parameters:** `id` - Session ID to rename.
*   **Body:**
    ```json
    {
      "title": "New Session Title"
    }
    ```
*   **Response:**
    ```json
    {
      "success": true,
      "message": "Session renamed"
    }
    ```

#### GET `/api/sessions/:id/messages`
Get all messages from a specific session.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Parameters:** `id` - Session ID.
*   **Response:**
    ```json
    [
      {
        "type": "human",
        "content": "Hello"
      },
      {
        "type": "ai",
        "content": "Hi! How can I help you?"
      }
    ]
    ```

### Chat Endpoints

#### POST `/api/chat`
Send a message to the agent and get a response.

*   **Authentication:** Requires `Authorization` header with the password set in `THE_ARCHITECT_PASS`.
*   **Body:**
    ```json
    {
      "sessionId": "session-uuid",
      "message": "What is the weather today?"
    }
    ```
*   **Response:**
    ```json
    {
      "response": "I don't have access to real-time weather data..."
    }
    ```

---

### Webhook Endpoints

The Webhook System allows external services to trigger Oracle agent executions asynchronously. Each webhook has a unique slug (URL identifier) and its own `api_key`.

**Authentication model:**
- **Trigger endpoint**: public — authenticated only via `x-api-key` header (no `x-architect-pass` needed).
- **Management + notification endpoints**: protected via standard `x-architect-pass` middleware.

#### POST `/api/webhooks/trigger/:webhook_name`
Trigger a webhook. Responds immediately with `202 Accepted`; Oracle runs asynchronously in the background.

*   **Authentication:** `x-api-key: <webhook_api_key>` header.
*   **Parameters:** `webhook_name` — slug of the target webhook.
*   **Body:** Any JSON payload — forwarded to Oracle as context alongside the webhook's prompt.
*   **Response (202):**
    ```json
    { "accepted": true, "notification_id": "uuid-..." }
    ```
*   **Errors:** `401` for missing/invalid api_key; `404` for webhook not found or disabled.

**Example (GitHub Actions):**
```yaml
- name: Notify Morpheus
  run: |
    curl -s -X POST https://your-host/api/webhooks/trigger/deploy-done \
      -H "x-api-key: ${{ secrets.MORPHEUS_WEBHOOK_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{"workflow":"${{ github.workflow }}","status":"success","ref":"${{ github.ref }}"}'
```

#### GET `/api/webhooks`
List all configured webhooks (includes `api_key`, trigger stats).

*   **Authentication:** `x-architect-pass` header.

#### POST `/api/webhooks`
Create a new webhook. Returns the complete object including the generated `api_key`.

*   **Authentication:** `x-architect-pass` header.
*   **Body:**
    ```json
    {
      "name": "deploy-done",
      "prompt": "A deployment just finished. Summarize the result and flag any failures.",
      "notification_channels": ["ui", "telegram"],
      "enabled": true
    }
    ```
*   **Response (201):** Complete webhook object with `api_key`.
*   **Note:** `name` must be unique and URL-safe (lowercase, hyphens). Returns `409 Conflict` if already taken.

#### PUT `/api/webhooks/:id`
Update prompt, channels, or enabled status. The `name` (slug) and `api_key` are immutable.

*   **Authentication:** `x-architect-pass` header.

#### DELETE `/api/webhooks/:id`
Delete a webhook and all associated notifications (cascade).

*   **Authentication:** `x-architect-pass` header.

#### GET `/api/webhooks/notifications`
List webhook execution notifications.

*   **Authentication:** `x-architect-pass` header.
*   **Query Parameters:** `unreadOnly=true` to filter unread entries only.
*   **Response:**
    ```json
    [
      {
        "id": "uuid",
        "webhook_id": "uuid",
        "webhook_name": "deploy-done",
        "status": "completed",
        "payload": "{\"ref\":\"main\",\"status\":\"success\"}",
        "result": "Deployment of main to production completed successfully...",
        "read": false,
        "created_at": 1700001000000,
        "completed_at": 1700001008000
      }
    ]
    ```

#### POST `/api/webhooks/notifications/read`
Mark one or more notifications as read.

*   **Authentication:** `x-architect-pass` header.
*   **Body:** `{ "ids": ["uuid1", "uuid2"] }`

#### GET `/api/webhooks/notifications/unread-count`
Return the count of unread notifications (used by the sidebar badge in the Web UI).

*   **Authentication:** `x-architect-pass` header.
*   **Response:** `{ "count": 3 }`

---

## 🏗 Patterns and Technical Decisions

*   **Spec-Driven Development**: No code is written without an approved `spec` in the `specs/` folder. This ensures traceability and architectural clarity.
*   **Fail-Open**: Failures in non-critical subsystems (like Sati Memory) do not bring down the main process. An error log is generated, but chat continues.
*   **Zero-Config Defaults**: The `init` command generates a functional default configuration to minimize initial friction.
*   **Typescript Strict**: Strict typing for contracts between modules (Frontend <-> Backend <-> Config).

---

## 🤝 Contribution

1.  Check the [Roadmap](ROADMAP.md) or open Issues.
2.  For new features, create a proposal in the `specs/` folder (see `001-cli-structure` as an example).
3.  Follow the code style (ESLint + Prettier).
4.  Open a PR with a detailed description and link to the Spec.

## 🗺 Roadmap

*   [x] MVP with basic LLM support.
*   [x] Telegram integration.
*   [x] Web UI Dashboard.
*   [x] Long-Term Memory (Sati).
*   [x] Apoc DevTools Subagent (filesystem, shell, git, network, packages, processes, system).
*   [x] Multi-Agent Architecture (Oracle + Sati + Apoc with independent LLM configs).
*   [x] Webhook System — external triggers with Oracle execution, UI inbox, and Telegram notifications.
*   [ ] Discord support.
*   [ ] Plugin system for dynamic channel/tool loading.
*   [ ] Webhook retry logic with exponential backoff.

---

## 🕵️ Privacy Protection

The Web UI includes privacy protection headers to prevent indexing by search engines:
- HTML meta tags: `<meta name="robots" content="noindex, nofollow">`
- HTTP header: `X-Robots-Tag: noindex, nofollow`

This ensures that your private agent dashboard remains private and is not discoverable by search engines.

## 🐳 Running with Docker

Morpheus can be easily deployed using Docker and Docker Compose. The container supports all environment variables for configuration.

### Prerequisites

- Docker Engine
- Docker Compose

### Quick Start

1. Create a `.env` file with your configuration:

```bash
cp .env.example .env
# Edit .env with your actual API keys and settings
```

2. Build and start the container:

```bash
docker-compose up -d
```

3. Access the Web UI at `http://localhost:3333`

### Using Docker Directly

```bash
# Build the image
docker build -t morpheus .

# Run with environment variables
docker run -d \
  --name morpheus-agent \
  -p 3333:3333 \
  -v morpheus_data:/root/.morpheus \
  -e MORPHEUS_LLM_PROVIDER=openai \
  -e OPENAI_API_KEY=your-api-key-here \
  -e THE_ARCHITECT_PASS=your-password \
  morpheus
```

### Environment Variables in Docker

All environment variables described above work in Docker. The precedence order remains the same:
1. Container environment variables
2. Configuration file values
3. Default values

### Persistent Data

The container stores configuration and data in `/root/.morpheus`. Mount a volume to persist data between container restarts:

```yaml
volumes:
  - morpheus_data:/root/.morpheus  # Recommended for persistence
```

### Health Check

The container includes a health check that verifies the health endpoint is accessible. The application exposes a public `/health` endpoint that doesn't require authentication:

```bash
curl http://localhost:3333/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T21:30:00.000Z",
  "uptime": 123.45
}
```

## 📄 License

This project is open-source under the **ISC** license. See the `LICENSE` file for more details.
