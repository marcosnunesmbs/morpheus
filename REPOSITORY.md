# Morpheus — Local-First AI Operator for Developers

Morpheus is a local-first AI operator that runs as a daemon and orchestrates LLMs, tools, memory, and delivery channels (Web UI, Telegram, API, webhooks). All data stays on your machine.

---

## What is Morpheus?

- **Multi-agent architecture** — Oracle (orchestrator), Neo (MCP + internal tools), Apoc (DevKit / shell / git / browser), Trinity (database specialist), Sati (long-term memory)
- **LLM provider agnostic** — OpenAI, Anthropic, Google Gemini, OpenRouter, Ollama
- **Async task queue** — Oracle delegates execution to subagents; results are delivered proactively via Telegram or UI
- **Persistent memory** — SQLite-backed sessions, Sati long-term memory with vector search
- **MCP integration** — connect any Model Context Protocol server
- **Database management** — Trinity connects to PostgreSQL, MySQL, SQLite, MongoDB; passwords encrypted at rest
- **Webhooks** — trigger Oracle via HTTP; results delivered to UI and/or Telegram
- **Audio transcription** — voice messages via Google Gemini or Whisper
- **Web Dashboard** — Matrix-themed React UI for chat, tasks, settings, logs, stats, MCP, Trinity databases

---

## Quick Start with Docker

### Docker Compose (recommended)

Create a `.env` file:

```env
# Required
OPENAI_API_KEY=sk-...
THE_ARCHITECT_PASS=changeme

# Optional — Telegram
MORPHEUS_TELEGRAM_ENABLED=false
MORPHEUS_TELEGRAM_TOKEN=
MORPHEUS_TELEGRAM_ALLOWED_USERS=

# Optional — Trinity (database passwords encryption key)
MORPHEUS_SECRET=
```

Create a `docker-compose.yml`:

```yaml
services:
  morpheus:
    image: marcodalpra/morpheus-agent:latest
    container_name: morpheus-agent
    ports:
      - "3333:3333"
    volumes:
      - morpheus_data:/root/.morpheus
    env_file:
      - .env
    environment:
      # Oracle (main LLM)
      - MORPHEUS_LLM_PROVIDER=${MORPHEUS_LLM_PROVIDER:-openai}
      - MORPHEUS_LLM_MODEL=${MORPHEUS_LLM_MODEL:-gpt-4o}
      - MORPHEUS_LLM_TEMPERATURE=${MORPHEUS_LLM_TEMPERATURE:-0.7}

      # Provider API keys
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}

      # Security
      - THE_ARCHITECT_PASS=${THE_ARCHITECT_PASS:-iamthearchitect}
      - MORPHEUS_SECRET=${MORPHEUS_SECRET}

      # Telegram (optional)
      - MORPHEUS_TELEGRAM_ENABLED=${MORPHEUS_TELEGRAM_ENABLED:-false}
      - MORPHEUS_TELEGRAM_TOKEN=${MORPHEUS_TELEGRAM_TOKEN}
      - MORPHEUS_TELEGRAM_ALLOWED_USERS=${MORPHEUS_TELEGRAM_ALLOWED_USERS}

      # UI
      - MORPHEUS_UI_ENABLED=true
      - MORPHEUS_UI_PORT=3333

      # Logging
      - MORPHEUS_LOGGING_LEVEL=${MORPHEUS_LOGGING_LEVEL:-info}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3333/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  morpheus_data:
```

```bash
docker compose up -d
docker compose logs -f
```

Access the dashboard at **http://localhost:3333** and log in with `THE_ARCHITECT_PASS`.

---

### Docker Run (standalone)

```bash
docker run -d \
  --name morpheus-agent \
  -p 3333:3333 \
  -v morpheus_data:/root/.morpheus \
  -e MORPHEUS_LLM_PROVIDER=openai \
  -e OPENAI_API_KEY=sk-... \
  -e THE_ARCHITECT_PASS=changeme \
  marcodalpra/morpheus-agent:latest
```

With Telegram:

```bash
docker run -d \
  --name morpheus-agent \
  -p 3333:3333 \
  -v morpheus_data:/root/.morpheus \
  -e OPENAI_API_KEY=sk-... \
  -e THE_ARCHITECT_PASS=changeme \
  -e MORPHEUS_TELEGRAM_ENABLED=true \
  -e MORPHEUS_TELEGRAM_TOKEN=<bot-token> \
  -e MORPHEUS_TELEGRAM_ALLOWED_USERS=123456789 \
  marcodalpra/morpheus-agent:latest
```

---

## Environment Variables

### Oracle (main LLM)

| Variable | Description | Default |
|---|---|---|
| `MORPHEUS_LLM_PROVIDER` | `openai` / `anthropic` / `gemini` / `openrouter` / `ollama` | `openai` |
| `MORPHEUS_LLM_MODEL` | Model name | `gpt-4o` |
| `MORPHEUS_LLM_TEMPERATURE` | Temperature (0–1) | `0.7` |
| `MORPHEUS_LLM_API_KEY` | Generic API key fallback | — |
| `MORPHEUS_LLM_CONTEXT_WINDOW` | Message history window | `100` |

### Provider API Keys (take precedence over generic)

| Variable | Provider |
|---|---|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GOOGLE_API_KEY` | Google Gemini |
| `OPENROUTER_API_KEY` | OpenRouter |

### Agent-Specific Overrides

Each subagent falls back to Oracle config if not set.

| Variable | Agent |
|---|---|
| `MORPHEUS_SATI_PROVIDER` / `_MODEL` / `_API_KEY` | Sati (memory) |
| `MORPHEUS_NEO_PROVIDER` / `_MODEL` / `_API_KEY` | Neo (MCP + internal tools) |
| `MORPHEUS_APOC_PROVIDER` / `_MODEL` / `_API_KEY` | Apoc (DevKit) |
| `MORPHEUS_APOC_WORKING_DIR` | Apoc working directory |
| `MORPHEUS_APOC_TIMEOUT_MS` | Apoc tool timeout (ms) |
| `MORPHEUS_TRINITY_PROVIDER` / `_MODEL` / `_API_KEY` | Trinity (databases) |

### Security

| Variable | Description | Default |
|---|---|---|
| `THE_ARCHITECT_PASS` | Dashboard + API password | `iamthearchitect` |
| `MORPHEUS_SECRET` | AES-256-GCM key for encrypting database passwords (Trinity) | — |

### Telegram

| Variable | Description | Default |
|---|---|---|
| `MORPHEUS_TELEGRAM_ENABLED` | Enable Telegram bot | `false` |
| `MORPHEUS_TELEGRAM_TOKEN` | Bot token from @BotFather | — |
| `MORPHEUS_TELEGRAM_ALLOWED_USERS` | Comma-separated Telegram user IDs | — |

### Audio

| Variable | Description | Default |
|---|---|---|
| `MORPHEUS_AUDIO_ENABLED` | Enable voice transcription | `true` |
| `MORPHEUS_AUDIO_PROVIDER` | `google` / `openai` / `openrouter` | `google` |
| `MORPHEUS_AUDIO_MODEL` | Transcription model | `gemini-2.5-flash-lite` |
| `MORPHEUS_AUDIO_MAX_DURATION` | Max voice message duration (s) | `300` |

### UI & Logging

| Variable | Description | Default |
|---|---|---|
| `MORPHEUS_UI_ENABLED` | Enable Web UI | `true` |
| `MORPHEUS_UI_PORT` | Web UI port | `3333` |
| `MORPHEUS_LOGGING_LEVEL` | `debug` / `info` / `warn` / `error` | `info` |
| `MORPHEUS_LOGGING_RETENTION` | Log file retention | `14d` |

---

## Persistent Data

All configuration and databases are stored in `/root/.morpheus` inside the container:

```
/root/.morpheus/
├── zaion.yaml          # agent configuration
├── mcps.json           # MCP server list
├── logs/               # rotating log files
└── memory/
    ├── short-memory.db # sessions, messages, tasks, usage, webhooks
    ├── sati-memory.db  # long-term memory with vector embeddings
    └── trinity.db      # registered database registry (encrypted passwords)
```

Mount a named volume to persist across restarts and image upgrades:

```yaml
volumes:
  - morpheus_data:/root/.morpheus
```

---

## Health Check

```bash
curl http://localhost:3333/health
```

```json
{ "status": "healthy", "timestamp": "...", "uptime": 1832.5 }
```

The container probes this endpoint every 30s (60s start period, 3 retries).

---

## Web Dashboard Pages

| Route | Description |
|---|---|
| `/` | Status, uptime, quick usage summary |
| `/chat` | Session-based chat with Oracle |
| `/tasks` | Async task queue — status, filters, retry |
| `/trinity-databases` | Register and manage databases |
| `/mcp-servers` | Add/edit/toggle MCP servers, hot reload |
| `/sati-memories` | Browse and delete long-term memories |
| `/stats` | Token usage, cost by provider/model |
| `/model-pricing` | Configure per-model pricing for cost tracking |
| `/webhooks` | Manage webhook triggers and notifications |
| `/logs` | Browse application log files |
| `/zaion` | Agent, LLM, audio, channel settings |

---

## Telegram Bot Commands

| Command | Description |
|---|---|
| `/status` | Check if Morpheus is running |
| `/stats` | Token usage and cost summary |
| `/sessions` | List and switch sessions |
| `/newsession` | Start a new session |
| `/sati [n]` | Show last N long-term memories |
| `/trinity` | List registered databases |
| `/mcp` | List MCP servers with enable/disable buttons |
| `/mcpreload` | Reload MCP connections without restart |
| `/zaion` | Show current agent configuration |
| `/doctor` | Diagnose environment and configuration |
| `/restart` | Restart the daemon |

---

## License

MIT
