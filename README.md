<div align="center">
  <img src="./assets/logo.png" alt="Morpheus Logo" width="220" />
</div>

# Morpheus

> **Morpheus is a local-first AI operator that bridges developers and machines.**

Morpheus is a local AI agent for developers, running as a CLI daemon that connects to **LLMs**, **local tools**, and **MCPs**, enabling interaction via **Terminal, Telegram, and Discord**. Inspired by the character Morpheus from *The Matrix*, the project acts as an **intelligent orchestrator**, bridging the gap between the developer and complex systems.

## Installation

Install Morpheus globally via npm:

```bash
npm install -g morpheus-cli
```

## Quick Start

### 1. Initialize

Set up your configuration (API keys, preferences):

```bash
morpheus init
```

### 2. Start the Agent

Run the background daemon and Web UI:

```bash
morpheus start
```

This will:
- Start the agent process
- Launch the Web UI at http://localhost:3333

### Other Commands

```bash
# Check if Morpheus is running
morpheus status

# Stop the agent
morpheus stop

# Diagnose issues
morpheus doctor
```

## Troubleshooting

### Command not found

If you installed successfully but can't run the `morpheus` command:

1.  **Check your PATH**: Ensure your global npm bin directory is in your system PATH.
    -   Run `npm bin -g` to see the folder.
    -   On Windows, this is usually `%APPDATA%\npm`.
    -   On Linux/Mac, verify `echo $PATH`.
2.  **Restart Terminal**: New installations might not be visible until you restart your shell.

## Using NPX
You can run Morpheus without installing it globally using `npx`:

```bash

npx morpheus-cli init

npx morpheus-cli start

```

## Technical Overview

Morpheus is built with **Node.js** and **TypeScript**, using **LangChain** as the orchestration engine. It runs as a background daemon process, managing connections to LLM providers (OpenAI, Anthropic, Ollama) and external channels (Telegram, Discord).

### Core Components

- **Runtime (`src/runtime/`)**: The heart of the application. Manages the Oracle (agent) lifecycle, provider instantiation, and command execution.
- **CLI (`src/cli/`)**: Built with `commander`, handles user interaction, configuration, and daemon control (`start`, `stop`, `status`).
- **Configuration (`src/config/`)**: Singleton-based configuration manager using `zod` for validation and `js-yaml` for persistence (`~/.morpheus/zaion.yaml`).
- **Channels (`src/channels/`)**: Adapters for external communication. Currently supports Telegram (`telegraf`) with strict user whitelisting.

## Features

### 🖥️ Web Dashboard
Local React-based UI to manage recordings, chat history, and system status across your agent instances.

#### 🔒 UI Authentication
To protect your Web UI, use the `THE_ARCHITECT_PASS` environment variable. This ensures only authorized users can access the dashboard and API.

Additionally, you can use environment variables for API keys instead of storing them in the configuration file:

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key (if using GPT) | No |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using Claude) | No |
| `GOOGLE_API_KEY` | Google AI key (for Gemini and Audio) | Yes (for audio) |
| `OPENROUTER_API_KEY` | OpenRouter API key (if using OpenRouter) | No |
| `THE_ARCHITECT_PASS` | Web Dashboard access password | Recommended |
| `TELEGRAM_BOT_TOKEN` | Telegram BotFather token | No |

If these environment variables are set, they will take precedence over values stored in the configuration file.

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

**Option 1: Using a `.env` file**
Create a `.env` file in the root of your project:

```env
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
GOOGLE_API_KEY="your-google-api-key"
THE_ARCHITECT_PASS="your-secure-password"
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
OPENROUTER_API_KEY="your-openrouter-api-key"
```

**Option 2: Using Shell export**

```bash
export OPENAI_API_KEY="your-openai-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export GOOGLE_API_KEY="your-google-api-key"
export OPENROUTER_API_KEY="your-openrouter-api-key"
export THE_ARCHITECT_PASS="your-secure-password"
export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
morpheus start
```

When enabled:
- The Web UI will redirect to a Login page.
- API requests require the `x-architect-pass` header.
- The session is persisted locally in your browser.

### 🧩 MCP Support (Model Context Protocol)
Full integration with [Model Context Protocol](https://modelcontextprotocol.io/), allowing Morpheus to use standardized tools from any MCP-compatible server.

### 🧠 Sati (Long-Term Memory)
Morpheus features a dedicated middleware system called **Sati** (Mindfulness) that provides long-term memory capabilities.
-   **Automated Storage**: Automatically extracts and saves preferences, project details, and facts from conversations.
-   **Contextual Retrieval**: Injects relevant memories into the context based on your current query.
-   **Data Privacy**: Stored in a local, independent SQLite database (`santi-memory.db`), ensuring sensitive data is handled securely and reducing context window usage.
-   **Memory Management**: View and manage your long-term memories through the Web UI or via API endpoints.

### 📊 Usage Analytics
Track your token usage across different providers and models directly from the Web UI. View detailed breakdowns of input/output tokens and message counts to monitor costs and activity.

### 🎙️ Audio Transcription (Telegram)
Send voice messages directly to the Telegram bot. Morpheus will:
1. Transcribe the audio using **Google Gemini**.
2. Process the text as a standard prompt.
3. Reply with the answer.

*Requires a Google Gemini API Key.*

## Development Setup

This guide is for developers contributing to the Morpheus codebase.

### Prerequisites

- **Node.js**: >= 18.x
- **npm**: >= 9.x
- **TypeScript**: >= 5.x

### 1. Clone & Install

```bash
git clone https://github.com/your-org/morpheus.git
cd morpheus
npm install
```

### 2. Build

Compile TypeScript source to `dist/` and build the Web UI.

```bash
npm run build
```

### 3. Run the CLI

You can run the CLI directly from the source using `npm start`.

```bash
# Initialize configuration (creates ~/.morpheus)
npm start -- init

# Start the daemon
npm start -- start

# Check status
npm start -- status
```

### 4. Configuration

The configuration file is located at `~/.morpheus/zaion.yaml`. You can edit it manually or use the `morpheus config` command.

```yaml
agent:
  name: "Morpheus"
  personality: "stoic, wise, and helpful"
llm:
  provider: "openai" # options: openai, anthropic, ollama, gemini
  model: "gpt-4-turbo"
  temperature: 0.7
  context_window: 100 # Number of messages to load into LLM context
  api_key: "sk-..."
santi: # Optional: Sati (Long-Term Memory) specific settings
  provider: "openai" # defaults to llm.provider
  model: "gpt-4o"
  memory_limit: 1000 # Number of messages/items to retrieve
channels:
  telegram:
    enabled: true
    token: "YOUR_TELEGRAM_BOT_TOKEN"
    allowedUsers: ["123456789"] # Your Telegram User ID
  discord:
    enabled: false # Coming soon

# Web UI Dashboard
ui:
  enabled: true
  port: 3333

# Audio Transcription Support
audio:
  enabled: true
  apiKey: "YOUR_GEMINI_API_KEY" # Optional if llm.provider is 'gemini'
  maxDurationSeconds: 300
```

### 5. MCP Configuration

Morpheus supports external tools via **MCP (Model Context Protocol)**. Configure your MCP servers in `~/.morpheus/mcps.json`:

```json
{
  "coolify": {
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@coolify/mcp-server"],
    "env": {
      "COOLIFY_URL": "https://app.coolify.io",
      "COOLIFY_TOKEN": "your-token"
    }
  },
  "coingecko": {
    "transport": "http",
    "url": "https://mcps.mnunes.xyz/coingecko/mcp"
  }
}
```

## API Endpoints

Morpheus exposes several API endpoints for programmatic access to its features:

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

## Testing

We use **Vitest** for testing.

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```text
.
├── assets/          # Static assets
├── bin/             # CLI entry point (morpheus.js)
├── specs/           # Technical specifications & documentation
├── src/
│   ├── channels/    # Communication adapters (Telegram, etc.)
│   ├── cli/         # CLI commands and logic
│   ├── config/      # Configuration management
│   ├── runtime/     # Core agent logic, lifecycle, and providers
│   ├── types/       # Shared TypeScript definitions
│   └── ui/          # React Web UI Dashboard
└── package.json
```

## Roadmap

- [x] **Web Dashboard**: Local UI for management and logs.
- [x] **MCP Support**: Full integration with Model Context Protocol.
- [ ] **Discord Adapter**: Support for Discord interactions.
- [ ] **Plugin System**: Extend functionality via external modules.

## 🕵️ Privacy Protection

The Web UI includes privacy protection headers to prevent indexing by search engines:
- HTML meta tags: `<meta name="robots" content="noindex, nofollow">`
- HTTP header: `X-Robots-Tag: noindex, nofollow`

This ensures that your private agent dashboard remains private and is not discoverable by search engines.

## 🐳 Running with Docker

Morpheus can be easily deployed using Docker and Docker Compose. The container supports all environment variables for configuration.
The Docker image is publicly available at [Docker Hub](https://hub.docker.com/r/marcosnunesmbs/morpheus).

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

### Docker Compose Example

Here's a complete example of how to run Morpheus using Docker Compose:

```yaml
version: '3.8'

services:
  morpheus:
    image: morpheus/morpheus-agent:latest
    container_name: morpheus-agent
    ports:
      - "3333:3333"
    volumes:
      - morpheus_data:/root/.morpheus
    environment:
      # LLM Configuration
      - MORPHEUS_LLM_PROVIDER=openai
      - MORPHEUS_LLM_MODEL=gpt-4o
      - MORPHEUS_LLM_TEMPERATURE=0.7
      
      # API Keys
      - OPENAI_API_KEY=your-openai-api-key
      - ANTHROPIC_API_KEY=your-anthropic-api-key
      - GOOGLE_API_KEY=your-google-api-key
      - OPENROUTER_API_KEY=your-openrouter-api-key
      
      # Security
      - THE_ARCHITECT_PASS=your-secure-password
      
      # Agent Configuration
      - MORPHEUS_AGENT_NAME=morpheus
      - MORPHEUS_AGENT_PERSONALITY=helpful_dev
      
      # UI Configuration
      - MORPHEUS_UI_ENABLED=true
      - MORPHEUS_UI_PORT=3333
    restart: unless-stopped
```

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

## Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'feat: Add amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

## License

MIT
