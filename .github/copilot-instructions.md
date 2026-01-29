# Morpheus Copilot Instructions

## 🧠 Project Context
**Morpheus** is a local-first AI operator/agent for developers. It runs as a CLI daemon, bridging LLMs (via LangChain) to external channels (Telegram, Discord) and local tools.

## 🏗 Architecture & Core Components

### Entry Point & CLI
- **Entry:** `bin/morpheus.js` (executes built `src/cli/index.ts`).
- **Framework:** Uses `commander` for command parsing (`src/cli/commands/*.ts`).
- **Commands:** `start`, `stop`, `status`, `config`, `doctor`, `init`.
- **Lifecycle:** `src/runtime/lifecycle.ts` manages the daemon process, including PID file handling (`~/.morpheus/morpheus.pid`).

### Runtime & Agent
- **Agent Core:** `src/runtime/agent.ts` is the central brain.
  - Implements `IAgent` interface.
  - Orchestrates LLMs using `@langchain/core` interfaces (`BaseChatModel`, `BaseMessage`).
  - Manages conversation history in-memory (currently).
- **Providers:** `src/runtime/providers/factory.ts` instantiates LLM providers (OpenAI, Anthropic, Ollama) based on config.
- **Display:** `src/runtime/display.ts` (`DisplayManager`) handles centralized logging/output, likely supporting both CLI output and log files.

### Configuration
- **Manager:** `src/config/manager.ts` (`ConfigManager` singleton).
- **Schema:** Defined in `src/types/config.ts` and validated via `zod` in `manager.ts`.
- **Storage:** Persisted as YAML in `~/.morpheus/config.yaml`.
- **Paths:** `src/config/paths.ts` abstracts file system locations.

### Channels
- **Telegram:** `src/channels/telegram.ts` uses `telegraf`.
  - **Auth:** Strict `allowedUsers` whitelist check.
  - **Flow:** Receives message -> Calls `agent.chat()` -> Replies with response.

## 🛠 Developer Patterns & Conventions

### Singleton Pattern
We use singletons for infrastructure components. Always access them via `getInstance()`:
- `ConfigManager.getInstance()`
- `DisplayManager.getInstance()`

### Error Handling
- Use specific error classes like `ProviderError` (`src/runtime/errors.ts`).
- Wrap external API calls (LLM, Telegram) in try/catch blocks that log to `DisplayManager` rather than `console.error`.

### Validation
- **Config:** ALWAYS update the Zod schema in `src/config/manager.ts` when adding new configuration properties.
- **Inputs:** Validate user inputs at the CLI boundary using `inquirer` or `commander` validators.

### Testing
- **Framework:** `vitest`.
- **Location:** `__tests__` directories adjacent to the source files (e.g., `src/channels/__tests__/`).
- **Mocking:** Mock `fs-extra`, `telegraf`, and `langchain` modules for unit tests. Use `vi.mock()`.

## 🚀 Workflows

### Building & Running
- **Build:** `npm run build` (runs `tsc`).
- **Run Dev:** `npm start -- [command]` (e.g., `npm start -- start`).
- **Daemon Mode:** `morpheus start` runs the long-lived process. `morpheus stop` kills it via PID.

### Adding a New Command
1. Create `src/cli/commands/new-command.ts`.
2. Register it in `src/cli/index.ts`.

### Adding a New LLM Provider
1. Update `MorpheusConfig` interface/schema.
2. Implement provider logic in `src/runtime/providers/factory.ts`.
