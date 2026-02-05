
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
*   **Sati Memory (Mindfulness)**:
    *   Middleware that intercepts conversations to extract and store important facts in `santi-memory.db`.
    *   Independent configuration (allows using a smarter/cheaper model just for memory management).
*   **MCP Protocol**: Dynamic tool loading via the `~/.morpheus/mcps.json` file.
*   **Matrix Web Interface**: Local dashboard for monitoring, configuration, and chat, password-protected (`THE_ARCHITECT_PASS`).
*   **Telegram/Discord Chatbot**: Mobile interface with voice transcription support via Google GenAI.
*   **Hot-Reload Configuration**: APIs for dynamic agent parameter adjustment without restarting the process.
*   **Usage Analytics**: Granular monitoring of token consumption by provider and model.

---

## 🧠 Architecture

Morpheus uses a **Modular Monolith** architecture with a middleware-based control flow.

### High-Level Diagram

```mermaid
graph TD
    User(["User"]) -->|Chat/Voice| Channel["Channel Adapters<br/>(Telegram/Discord/UI)"]
    Channel -->|Normalized Event| Oracle["Oracle Agent<br/>(Runtime Core)"]
    
    subgraph "Cognitive Cycle"
        Oracle -->|1. Retrieval| Sati["Sati Middleware<br/>(Long-Term Memory)"]
        Sati <-->|Query| GraphDB[("Sati DB")]
        
        Oracle -->|2. Context| ShortMem[("Session DB")]
        
        Oracle -->|3. Inference| LLM["LLM Provider<br/>(OpenAI/Ollama/etc)"]
        
        Oracle -->|4. Optional Action| ToolManager["Tool Manager"]
        ToolManager <-->|Execution| MCP["MCP Servers"]
        
        Oracle -->|5. Consolidation| Sati
    end
    
    Oracle -->|Response| Channel
```

### Architectural Decisions
*   **Oracle**: The orchestrator core that implements the thinking interface. It is agnostic to the AI provider.
*   **Sati Middleware**: An independent "sub-agent" that runs before and after the main cycle to manage memory without polluting business logic.
*   **Isolated Channels**: Each channel (Telegram, CLI, HTTP) is an isolated module that only emits and receives standardized events.

---

## 📂 Folder Structure

```
/src
  /channels     # Input/output adapters (Telegram, Discord)
  /cli          # Terminal commands and daemon process management
  /config       # Schema definitions (Zod) and YAML loading
  /http         # Express API server and REST routes
  /runtime      # Core business logic
    /memory     # Storage implementations (SQLite, Sati)
    /providers  # Factory for LLM clients (OpenAI, etc)
    /tools      # MCP client and local tool manager
    oracle.ts   # Main agent class
  /ui           # Frontend source code (React/Vite)
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
| `MORPHEUS_SANTI_PROVIDER` | Sati provider to use | santi.provider |
| `MORPHEUS_SANTI_MODEL` | Model name for Sati | santi.model |
| `MORPHEUS_SANTI_TEMPERATURE` | Temperature setting for Sati | santi.temperature |
| `MORPHEUS_SANTI_MAX_TOKENS` | Maximum tokens for Sati | santi.max_tokens |
| `MORPHEUS_SANTI_CONTEXT_WINDOW` | Context window size for Sati | santi.context_window |
| `MORPHEUS_SANTI_API_KEY` | Generic API key for Sati (lower precedence than provider-specific keys) | santi.api_key |
| `MORPHEUS_SANTI_MEMORY_LIMIT` | Memory retrieval limit for Sati | santi.memory_limit |
| `MORPHEUS_AUDIO_MODEL` | Model name for audio processing | audio.model |
| `MORPHEUS_AUDIO_ENABLED` | Enable/disable audio processing | audio.enabled |
| `MORPHEUS_AUDIO_API_KEY` | Generic API key for audio (lower precedence than provider-specific keys) | audio.apiKey |
| `MORPHEUS_AUDIO_MAX_DURATION` | Max duration for audio processing | audio.maxDurationSeconds |
| `MORPHEUS_TELEGRAM_ENABLED` | Enable/disable Telegram channel | channels.telegram.enabled |
| `MORPHEUS_TELEGRAM_TOKEN` | Telegram bot token | channels.telegram.token |
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

### Production (Daemon)
Starts the agent in the background and frees the terminal.

```bash
morpheus start
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
3.  **Deliberation (Oracle)**:
    *   Oracle queries the configured LLM.
    *   If the LLM requests a tool (e.g., `read_file`), Oracle executes it via the MCP client.
    *   The process repeats until the LLM generates a final response.
4.  **Post-Processing (Middleware)**:
    *   The Sati `afterAgent` endpoint is triggered with the full interaction history.
    *   A parallel (fire-and-forget) process analyzes the conversation to extract new facts.
    *   New facts are saved in the long-term database.
5.  **Delivery**: The final response is sent to the user via the Telegram adapter.

---

## 📡 API

The REST API runs on port 3333 (configurable) and serves both the UI and local integrations.

### GET `/api/agents`
Returns the health status of the agent and active providers.

### GET `/api/config/sati`
Retrieves the specific configuration of the Sati memory subsystem.

### POST `/api/config/sati`
*   **Description**: Updates Sati settings (Model, Provider, Window).
*   **Body**: `{ "provider": "openai", "model": "gpt-4-turbo", ... }`

### GET `/api/stats/usage`
Returns accumulated token consumption metrics (Input/Output).

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
*   [ ] Discord support
*   [ ] Iteration tools with Local Filesystem.
*   [ ] Iteration with local terminal.

---

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
