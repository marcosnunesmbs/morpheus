# Morpheus Project - QWEN Context

## Project Overview

Morpheus is a local-first AI operator/agent for developers, distributed as a global npm package. It functions as a persistent background daemon that bridges Large Language Models (LLMs) with external communication channels (Telegram, Discord), local system tools, and user interfaces (CLI, Web Dashboard). The project is inspired by the character Morpheus from *The Matrix* and acts as an intelligent orchestrator connecting developers to complex systems.

**Core Purpose**: Morpheus serves as a local AI agent that runs as a CLI daemon, connecting to LLMs, local tools, and Model Context Protocol (MCP) servers, enabling interaction via Terminal, Telegram, and Discord.

## Technology Stack

- **Runtime**: Node.js (ES Modules)
- **Language**: TypeScript
- **Build System**: TypeScript compiler (tsc)
- **AI Framework**: LangChain.js
- **Storage**: SQLite (via `better-sqlite3`)
- **CLI Framework**: Commander.js
- **Frontend**: React 19 + Vite + TailwindCSS
- **Validation**: Zod (for configuration and API)
- **Logging**: Winston with daily rotation
- **Testing**: Vitest

## Project Structure

```
.
├── assets/              # Static assets (logo, etc.)
├── bin/                 # CLI entry point (morpheus.js)
├── dist/                # Compiled TypeScript output
├── node_modules/        # Dependencies
├── specs/               # Technical specifications & documentation per feature
├── src/
│   ├── channels/        # Communication adapters (Telegram, Discord)
│   ├── cli/             # CLI commands and logic
│   ├── config/          # Configuration management with Zod validation
│   ├── http/            # Express server for Web UI and API
│   ├── runtime/         # Core agent logic, memory, and providers
│   ├── types/           # Shared TypeScript interfaces and types
│   └── ui/              # React Web Dashboard source
├── .github/             # GitHub templates and configurations
├── .specify/            # Specification tools
├── .vscode/             # VSCode settings
├── ARCHITECTURE.md      # Architecture documentation
├── CONTRIBUTING.md      # Contribution guidelines
├── PRODUCT.md           # Product documentation
├── README.md            # Main project documentation
├── SPECIFICATION.md     # Technical specification
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── QWEN.md              # Current file - project context for AI assistants
```

## Key Features

1. **Local-First Architecture**: All data, configuration, and conversation history reside on the user's machine
2. **Multi-Channel Support**: Interact via CLI, Web Dashboard, Telegram, and Discord
3. **LLM Provider Agnostic**: Supports OpenAI, Anthropic, Ollama, and Google Gemini
4. **Persistent Memory**: SQLite-backed conversation history across sessions
5. **MCP Integration**: Full support for Model Context Protocol for external tools
6. **Audio Transcription**: Voice message support via Google Gemini
7. **Web Dashboard**: Matrix-themed React UI for management and monitoring
8. **Declarative Configuration**: YAML-based configuration with environment variable support

## Building and Running

### Development Setup

```bash
# Install dependencies
npm install

# Build the project (backend + frontend)
npm run build

# Run in development mode with watch
npm run dev

# Run tests
npm test
```

### Production Commands

```bash
# Install globally
npm install -g morpheus-cli

# Initialize configuration
morpheus init

# Start the daemon
morpheus start

# Check status
morpheus status

# Stop the daemon
morpheus stop

# Diagnose issues
morpheus doctor
```

### Development Workflow

The project follows a specification-driven development approach:

1. **Create a Spec**: Start a new folder `specs/NNN-feature-name/`
2. **Required Files**:
   - `spec.md`: Functional requirements (source of truth)
   - `plan.md`: Technical implementation strategy
   - `tasks.md`: Checklist of implementation steps
   - `contracts/`: Define TypeScript interfaces before writing code
3. **Process**: Read the spec → Update the plan → Implement → Check off tasks

## Development Conventions

### TypeScript & ESM
- This project uses native ESM. Relative imports MUST include the `.js` extension:
  ```typescript
  // ✅ Correct
  import { Foo } from './foo.js';
  // ❌ Incorrect
  import { Foo } from './foo';
  ```

### Architecture Patterns
- **Singletons**: Use `ConfigManager.getInstance()` and `DisplayManager.getInstance()` for global concerns
- **Directory Structure**:
  - `src/cli/`: Command definitions
  - `src/runtime/`: Core agent logic
  - `src/channels/`: Input/output adapters (e.g., Telegram)
  - `src/http/`: Express server and API
  - `src/ui/`: React + Vite frontend
- **Error Handling**: Log errors to `DisplayManager`, not `console.error`

### Configuration Management
- Configuration is stored in `~/.morpheus/config.yaml`
- Uses Zod for validation
- Supports environment variable references with `env:VARIABLE_NAME` syntax

### MCP (Model Context Protocol) Support
- MCP servers are configured in `~/.morpheus/mcps.json`
- Full integration with standardized tools from any MCP-compatible server
- MCP tools are registered as LangChain tools

## Key Components

### Runtime Core (`src/runtime/`)
- **Agent Orchestrator**: Implements the `IAgent` interface, manages conversation loop using LangChain
- **Memory System**: Uses `SQLiteChatMessageHistory` for persistent conversation storage
- **LLM Providers**: Factory pattern abstracts specific LLM implementations

### Channel Adapters (`src/channels/`)
- Implement adapter pattern for external communication
- Enforce strict authorization (allow-lists) for security
- Normalize external events to internal standard objects

### CLI Interface (`src/cli/`)
- Built with Commander.js
- Handles process lifecycle (start/stop daemon)
- Configuration initialization and management

### Web Dashboard (`src/ui/`)
- React-based SPA built with Vite and TailwindCSS
- Matrix-themed UI for monitoring and management
- Communicates with daemon via local HTTP API

## Security Considerations

- Tokens stored via environment variables
- Secrets masked in UI
- Local tool execution sandboxing
- Path whitelist enforcement
- Optional human confirmation for dangerous commands
- UI authentication via "The Architect Pass"

## Testing

The project uses Vitest for testing:

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Specifications Directory

The `specs/` directory contains feature specifications organized by number:

- `001-cli-structure` - CLI structure specification
- `002-telegram-adapter` - Telegram integration
- `003-terminal-ui-manager` - Terminal UI management
- `004-langchain-core-agent` - Core agent implementation
- `005-langchain-agent-integration` - LangChain integration
- `006-agent-interaction-flow` - Interaction flow
- `007-logging-system` - Logging implementation
- `008-sqlite-memory-persistence` - SQLite memory persistence
- `009-web-ui-dashboard` - Web dashboard
- `010-settings-form-ui` - Settings UI
- `011-npm-publish-setup` - NPM publishing
- `012-audio-transcription` - Audio transcription
- `013-improve-init-flow` - Initialization flow improvement
- `014-tools-factory-memory-limit` - Tools and memory limits
- `015-persist-tool-usage` - Tool usage persistence
- `016-ui-config-stats` - UI configuration and stats
- `017-chat-memory-config` - Chat memory configuration
- `018-mcp-json-config` - MCP JSON configuration
- `019-ui-auth-password` - UI authentication password

This specification-driven approach ensures all major features are documented before implementation.