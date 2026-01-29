<div align="center">
  <img src="./assets/logo.png" alt="Morpheus Logo" width="220" />
</div>

# Morpheus

> **Morpheus is a local-first AI operator that bridges developers and machines.**

Morpheus is a local AI agent for developers, running as a CLI daemon that connects to **LLMs**, **local tools**, and **MCPs**, enabling interaction via **Terminal, Telegram, and Discord**. Inspired by the character Morpheus from *The Matrix*, the project acts as an **intelligent orchestrator**, bridging the gap between the developer and complex systems.

## Technical Overview

Morpheus is built with **Node.js** and **TypeScript**, using **LangChain** as the orchestration engine. It runs as a background daemon process, managing connections to LLM providers (OpenAI, Anthropic, Ollama) and external channels (Telegram, Discord).

### Core Components

- **Runtime (`src/runtime/`)**: The heart of the application. Manages the agent lifecycle, provider instantiation, and command execution.
- **CLI (`src/cli/`)**: Built with `commander`, handles user interaction, configuration, and daemon control (`start`, `stop`, `status`).
- **Configuration (`src/config/`)**: Singleton-based configuration manager using `zod` for validation and `js-yaml` for persistence (`~/.morpheus/config.yaml`).
- **Channels (`src/channels/`)**: Adapters for external communication. Currently supports Telegram (`telegraf`) with strict user whitelisting.

## Prerequisites

- **Node.js**: >= 18.x
- **npm**: >= 9.x
- **TypeScript**: >= 5.x

## Getting Started (Development)

This guide is for developers contributing to the Morpheus codebase.

### 1. Clone & Install

```bash
git clone https://github.com/your-org/morpheus.git
cd morpheus
npm install
```

### 2. Build

Compile TypeScript source to `dist/`.

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

The configuration file is located at `~/.morpheus/config.yaml`. You can edit it manually or use the CLI.

```yaml
agent:
  name: "Morpheus"
  personality: "stoic, wise, and helpful"
llm:
  provider: "openai" # options: openai, anthropic, ollama
  model: "gpt-4-turbo"
  temperature: 0.7
  api_key: "sk-..."
channels:
  telegram:
    enabled: true
    token: "YOUR_TELEGRAM_BOT_TOKEN"
    allowedUsers: ["123456789"] # Your Telegram User ID
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
│   └── index.ts
└── package.json
```

## Roadmap

- [ ] **MCP Support**: Full integration with Model Context Protocol.
- [ ] **Discord Adapter**: Support for Discord interactions.
- [ ] **Web Dashboard**: Local UI for management and logs.
- [ ] **Plugin System**: Extend functionality via external modules.

## Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'feat: Add amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

## License

MIT
