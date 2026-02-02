# Morpheus Copilot Instructions

## 🧠 Project Context
**Morpheus** is a local-first AI operator/agent for developers. It runs as a background daemon (CLI + HTTP Server), bridging LLMs (via LangChain) to external channels (Telegram), a Web UI, and local tools (including MCP support).

## 🏗 Architecture & Core Components

### Entry Point & CLI
- **Entry:** `bin/morpheus.js` (executes built `src/cli/index.ts`).
- **Framework:** `commander` parses commands (`src/cli/commands/*.ts`).
- **Daemon:** `src/runtime/lifecycle.ts` manages the process & PID file (`~/.morpheus/morpheus.pid`).

### Runtime & Agent
- **Orchestrator:** `src/runtime/agent.ts` implements `IAgent`.
  - **Logic:** Uses `@langchain/core` for reasoning loop.
  - **Memory:** `SQLiteChatMessageHistory` (`src/runtime/memory/sqlite.ts`) backed by `better-sqlite3`.
  - **Models:** `src/runtime/providers/factory.ts` instantiates LLMs (OpenAI, Anthropic, Google, Ollama).
  - **Tools:** `src/runtime/tools/factory.ts` loads tools, including **MCP Servers** configured in `~/.morpheus/mcps.json`.
- **Specialized Agents:**
  - **Audio:** `src/runtime/audio-agent.ts` using `@google/genai`.
- **Output:** `DisplayManager` (`src/runtime/display.ts`) handles centralized logging.

### Channels & Adapters
- **Location:** `src/channels/`.
- **Pattern:** Adapters (e.g., `TelegramAdapter`) handle specific protocol logic:
  - **Polling/Webhooks:** (e.g., Telegraf).
  - **Auth:** Strict `allowedUsers` allowlists.
  - **Transformation:** Convert external events -> Agent prompts.

### HTTP Server & Web UI
- **Server:** `src/http/server.ts` (Express).
  - **API:** (`/api/*`) defined in `src/http/api.ts`.
  - **Static:** Serves compiled React UI.
- **UI:** `src/ui/`.
  - **Stack:** React 19, Vite, TailwindCSS (Matrix theme).
  - **Data:** SWR for fetching; `src/ui/src/services/` for API client.

### Configuration
- **Manager:** `ConfigManager` singleton (`src/config/manager.ts`).
- **Schema:** Shared Zod schemas in `src/config/schemas.ts` (used by Backend & Frontend).
- **Persistence:** YAML file at `~/.morpheus/config.yaml`.

## 📝 Specification-Driven Development
**Strict adherence to `specs/` is required.** Do not write code without understanding the active spec.

1.  **Context:** Start with `specs/NNN-feature/spec.md` (Requirements) and `plan.md` (Tech Design).
2.  **Tracking:** Update `specs/NNN-feature/tasks.md` as you complete items.
3.  **Contracts:** Define interfaces in `contracts/` or `src/types/` *before* implementing logic.

## 🛠 Developer Patterns & Conventions

### TypeScript & ESM
- **Strict Native ESM:**
  - ✅ `import { Foo } from './foo.js';` (MUST include `.js` extension for relative imports).
  - ❌ `import { Foo } from './foo';`
- **Imports:** Use `import type` for type-only imports.

### Infrastructure & Error Handling
- **Singletons:** Access core services via `ClassName.getInstance()` (e.g., `ConfigManager`).
- **Logging:** Use `DisplayManager.getInstance().log()`, never `console.log` for app output.
- **Validation:** Validate all external inputs (CLI args, API bodies, Channel messages) using Zod schemas.

## 🚀 Workflows

### Building & Running
- **Build All:** `npm run build` (Backend `tsc` + UI `vite build`).
- **Dev Backend:** `npm run dev` (Watches `src/cli/index.ts`).
- **Dev UI:** `npm run dev --prefix src/ui`.
- **Run Daemon:** `npm start -- start`.
- **Tests:** `npm test` (Vitest).

### Key Commands
- `npm start -- init` - Scaffold config/keys.
- `npm start -- doctor` - Diagnose environment.
- `npx tsx src/runtime/__tests__/manual_start_verify.ts` - Quick sanity check.

### Adding Features
1.  **Spec:** Create `specs/NNN-new-feature/` with `spec.md`, `plan.md`, `tasks.md`.
2.  **Contracts:** Define types.
3.  **Implement:** Core -> Adapter/UI.
4.  **Register:** Add to `src/cli/index.ts` (commands) or `src/http/api.ts` (endpoints).
