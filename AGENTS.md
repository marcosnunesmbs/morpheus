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
│   ├── devkit/          # DevKit tool factories for Apoc (filesystem, shell, git, network, packages, processes, system)
│   ├── devkit/          # DevKit tool factories (filesystem, shell, git, network, packages, processes, system)
│   ├── runtime/         # Core agent logic, memory, and providers
│   │   ├── apoc.ts      # Apoc DevTools subagent
│   │   └── oracle.ts    # Oracle main agent
│   │   ├── apoc.ts      # Apoc DevTools subagent (singleton, uses DevKit)
│   │   ├── oracle.ts    # Oracle main agent (ReactAgent + apoc_delegate tool)
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
6. **Audio Transcription**: Voice message support via multi-provider Telephonist (Google Gemini, OpenAI Whisper, OpenRouter, Anthropic, Ollama)
7. **Web Dashboard**: Matrix-themed React UI for management and monitoring
8. **Declarative Configuration**: YAML-based configuration with environment variable support
9. **Apoc DevTools Subagent**: Specialized subagent for developer operations (filesystem, shell, git, network, packages, processes, system) — called by Oracle via `apoc_delegate` tool

## UI Design System

### Color Palette
The UI follows a dual-theme approach with Azure (light) and Matrix (dark) themes:

**Azure Theme (Light Mode)**:
- Background: `#F0F4F8`
- Surface: `#FFFFFF`
- Primary: `#0066CC`
- Secondary: `#4A90E2`
- Accent: `#2196F3`
- Border: `#B3D4FC`
- Hover: `#E3F2FD`
- Active: `#BBDEFB`
- Text Primary: `#1A1A1A`
- Text Secondary: `#5C6B7D`
- Text Muted: `#8899A8`

**Matrix Theme (Dark Mode)**:
- Background: `#000000`
- Base: `#0D0208`
- Primary: `#003B00`
- Secondary: `#008F11` (Darker Green)
- Highlight: `#00FF41` (Bright Green)
- Text: `#008F11`

### Typography
- Font Family: Monospace (`"Courier New"`, `Courier`, `monospace`)
- Consistent monospace font across the application for a terminal-like experience

### Component Design
- **Buttons**: Multiple variants (default, destructive, outline, secondary, ghost, link) with appropriate color schemes
- **Layout**: Responsive sidebar navigation with mobile support
- **Modals**: Confirmation dialogs with proper styling
- **Forms**: Consistent input components (NumberInput, SelectInput, Switch, TextInput)

### UI Framework
- **React 19**: Latest version for component-based architecture
- **TailwindCSS**: Utility-first CSS framework for styling
- **Framer Motion**: For smooth animations and transitions
- **Lucide React**: Icon library for consistent iconography
- **React Router DOM**: For navigation between pages

### TailwindCSS Classes Available

**Color Classes**:
- Azure Colors: `bg-azure-bg`, `bg-azure-surface`, `bg-azure-primary`, `bg-azure-secondary`, `bg-azure-accent`, `bg-azure-border`, `bg-azure-hover`, `bg-azure-active`
- Azure Text Colors: `text-azure-text-primary`, `text-azure-text-secondary`, `text-azure-text-muted`
- Matrix Colors: `bg-matrix-bg`, `bg-matrix-base`, `bg-matrix-primary`, `bg-matrix-secondary`, `bg-matrix-highlight`, `text-matrix-text`
- Zinc Colors: `bg-zinc-950`

**Typography**:
- Font Family: `font-mono` (uses Courier New/Courier/monospace)

**Layout**:
- Flexbox: `flex`, `flex-col`, `flex-1`, `flex-shrink-0`, `hidden`, `lg:flex`, `lg:hidden`
- Grid: Various grid classes available through Tailwind
- Spacing: `p-*`, `px-*`, `py-*`, `m-*`, `mx-*`, `my-*` (all standard Tailwind spacing)
- Sizing: `w-*`, `h-*`, `min-w-*`, `min-h-*`, `max-w-*`, `max-h-*`
- Positioning: `absolute`, `relative`, `fixed`, `inset-*`, `top-*`, `bottom-*`, `left-*`, `right-*`

**Borders**:
- Border colors: `border-azure-border`, `border-matrix-primary`
- Border styles: `rounded`, `rounded-md`, `rounded-lg`, etc.

**Effects**:
- Shadows: `shadow-*`, `shadow-xl`, etc.
- Transitions: `transition-colors`, `transition-opacity`, `duration-300`
- Opacity: `opacity-*`, `dark:opacity-*`

**States**:
- Hover: `hover:*`, `dark:hover:*`
- Focus: `focus:*`, `focus-visible:*`
- Disabled: `disabled:*`

**Dark Mode**:
- All color classes have dark mode variants using `dark:` prefix
- Theme toggling via `dark` class on document element

### Dark/Light Theme Toggle
- Theme preference is stored in localStorage
- Smooth transitions between themes
- Matrix theme is the default (inspired by The Matrix aesthetic)

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
- **Oracle (`oracle.ts`)**: Main orchestrator using LangChain ReactAgent. Manages conversation, context window, Sati memory middleware, and delegates dev tasks to Apoc via `apoc_delegate` tool.
- **Apoc (`apoc.ts`)**: Singleton DevTools subagent. Receives delegated tasks from Oracle and executes them using DevKit tools. Independently configurable LLM provider/model.
- **DevKit (`src/devkit/`)**: Modular tool factory system. Registers factories for filesystem, shell, git, network, packages, processes, and system. Called via `buildDevKit(ctx)` with `working_dir`, `allowed_commands`, `timeout_ms`.
- **Memory System**: Uses `SQLiteChatMessageHistory` for persistent conversation storage
- **LLM Providers**: Factory pattern (`ProviderFactory`). Two modes:
  - `create()`: Full Oracle agent (internal tools + MCP + `apoc_delegate`)
  - `createBare()`: Clean subagent context (DevKit tools only, used by Apoc)
- **Telephonist**: Multi-provider audio transcription. Supports Google Gemini, OpenAI Whisper, and Ollama Whisper. Configured via `audio.provider` in `config.yaml`.

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
- Apoc DevKit uses `working_dir` to constrain filesystem operations scope
- Apoc tool timeout (`timeout_ms`) prevents runaway shell commands
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