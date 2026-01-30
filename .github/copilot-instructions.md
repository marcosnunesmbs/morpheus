# Morpheus Copilot Instructions

## 🧠 Project Context
**Morpheus** is a local-first AI operator/agent for developers. It runs as a background daemon (CLI + HTTP Server), bridging LLMs (LangChain) to external channels (Telegram, Discord), a Web UI, and local tools.

## 🏗 Architecture & Core Components

### Entry Point & CLI
- **Entry:** `bin/morpheus.js` (executes built `src/cli/index.ts`).
- **Framework:** `commander` for command parsing (`src/cli/commands/*.ts`).
- **Daemon:** `src/runtime/lifecycle.ts` manages the process & PID file (`~/.morpheus/morpheus.pid`). Controls `HttpServer` lifecycle.

### Runtime & Agent (The brain)
- **Agent:** `src/runtime/agent.ts` implements `IAgent`.
  - Orchestrates LLMs via `@langchain/core`.
  - **Memory:** Persisted via `SQLiteChatMessageHistory` (`src/runtime/memory/sqlite.ts`) using `better-sqlite3`.
- **Providers:** `src/runtime/providers/factory.ts` instantiates LLMs (OpenAI, Anthropic, Ollama).
- **Display:** `src/runtime/display.ts` handles centralized logging/output.

### HTTP Server & Web UI
- **Server:** `src/http/server.ts` (Express).
  - Serves API (`/api/*` defined in `src/http/api.ts`).
  - Serves compiled React UI static files.
- **UI:** Located in `src/ui/`.
  - **Stack:** React 19, Vite, TailwindCSS, SWR.
  - **Theme:** "Matrix" aesthetic (Green/Black).
  - **Communication:** Consumes API via `src/ui/src/services/` or `lib/`.

### Configuration
- **Manager:** `src/config/manager.ts` (`ConfigManager` singleton).
- **Schema:** Shared Zod schemas in `src/config/schemas.ts`.
- **Storage:** YAML at `~/.morpheus/config.yaml`.
- **Paths:** `src/config/paths.ts` abstracts OS paths.

## 🛠 Developer Patterns & Conventions

### TypeScript & ESM
- **Strict Imports:** This project is native ESM. **Relative imports MUST include the `.js` extension**.
  - ✅ `import { Foo } from './foo.js';`
  - ❌ `import { Foo } from './foo';`
- **Verbatim Module Syntax is enabled.** Use `import type` for type-only imports to avoid build errors.

### Infrastructure Patterns
- **Singletons:** Access infrastructure via `getInstance()`:
  - `ConfigManager.getInstance()`
  - `DisplayManager.getInstance()`
- **Error Handling:** Catch errors and log to `DisplayManager` (with context), not `console.error`.

### Validation
- **Shared Schemas:** Define Zod schemas in `src/config/schemas.ts` to share validation logic between Backend and Frontend.
- **Input:** Validate prompt inputs at CLI boundary (`commander`/`inquirer`).

## 🚀 Workflows

### Building & Running
- **Full Build:** `npm run build` (compiles Backend `tsc` && Frontend `vite build`).
- **Run Daemon:** `npm start -- start` (starts CLI daemon + HTTP server).
- **UI Dev:** `npm run dev --prefix src/ui` (runs Vite dev server).

### Key Commands
- `npm start -- init` - Scaffolds configuration.
- `npm start -- doctor` - Diagnoses issues.
- `npm test` - Runs Vitest suite.

### Adding Features
1. **New Command:** Add to `src/cli/commands/`, register in `src/cli/index.ts`.
2. **New API Endpoint:** Add to `src/http/api.ts`.
3. **New UI Page:** Add route in `src/ui/src/App.tsx`, create page in `src/ui/src/pages/`.
