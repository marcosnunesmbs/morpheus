# Morpheus Copilot Instructions

## 🧠 Project Context
**Morpheus** is a local-first AI operator/agent for developers. It runs as a background daemon (CLI + HTTP Server), bridging LLMs (LangChain) to external channels (Telegram, Discord), a Web UI, and local tools.

## 🏗 Architecture & Core Components

### Entry Point & CLI
- **Entry:** `bin/morpheus.js` (executes built `src/cli/index.ts`).
- **Framework:** `commander` for command parsing (`src/cli/commands/*.ts`).
- **Daemon:** `src/runtime/lifecycle.ts` manages the process & PID file (`~/.morpheus/morpheus.pid`). Controls `HttpServer` lifecycle.

### Runtime & Agent
- **Orchestrator:** `src/runtime/agent.ts` implements `IAgent`.
  - Orchestrates LLMs via `@langchain/core`.
  - **Memory:** Persisted via `SQLiteChatMessageHistory` (`src/runtime/memory/sqlite.ts`) using `better-sqlite3`.
  - **Providers:** `src/runtime/providers/factory.ts` instantiates LLMs.
- **Specialized Agents:**
  - **Audio:** `src/runtime/audio-agent.ts` handles transcription (via `@google/genai`).
- **Display:** `src/runtime/display.ts` handles centralized logging/output.

### Channels & Adapters
- **Location:** `src/channels/`.
- **Pattern:** Adapters (e.g., `TelegramAdapter`) manage:
  - Connection/Polling (Telegraf, discord.js).
  - Authorization (Strict `allowedUsers` checks).
  - Event Handling (Text, Voice, etc.).
  - Transforming inputs to Agent prompts.

### HTTP Server & Web UI
- **Server:** `src/http/server.ts` (Express).
  - Serves API (`/api/*` defined in `src/http/api.ts`).
  - Serves compiled React UI static files.
- **UI:** Located in `src/ui/`.
  - **Stack:** React 19, Vite, TailwindCSS, SWR.
  - **Theme:** "Matrix" aesthetic (Green/Black).
  - **Communication:** Consumes API via `src/ui/src/services/`.

### Configuration
- **Manager:** `src/config/manager.ts` (`ConfigManager` singleton).
- **Schema:** Shared Zod schemas in `src/config/schemas.ts`.
- **Storage:** YAML at `~/.morpheus/config.yaml`.
- **Paths:** `src/config/paths.ts` abstracts OS paths.

## 📝 Specification-Driven Development
**Strict adherence to the `specs/` directory structure is required.**

- **Feature Folders:** Every feature resides in `specs/NNN-feature-name/`.
- **Key Files:**
  - `spec.md`: The functional source of truth.
  - `plan.md`: Technical implementation strategies.
  - `tasks.md`: Granular checklist of implementation steps.
  - `contracts/`: TypeScript interfaces defined *before* implementation.
- **Workflow:**
  1.  **Read Context:** Always consult `spec.md` and `plan.md` first.
  2.  **Track Progress:** Update `tasks.md` as you complete items.
  3.  **No Magic:** Do not invent features not in the spec.

## 🛠 Developer Patterns & Conventions

### TypeScript & ESM
- **Strict Imports:** This project is native ESM. **Relative imports MUST include the `.js` extension**.
  - ✅ `import { Foo } from './foo.js';`
  - ❌ `import { Foo } from './foo';`
- **Verbatim Module Syntax is enabled.** Use `import type` for type-only imports to avoid build errors.
- **Interfaces:** Prefer defining interfaces in `specs/.../contracts/` or `src/types/` before implementation.

### Infrastructure Patterns
- **Singletons:** Access infrastructure via `getInstance()`:
  - `ConfigManager.getInstance()`
  - `DisplayManager.getInstance()`
- **Error Handling:** Catch errors and log to `DisplayManager` (with structured source/level), not `console.error`.

### Validation
- **Shared Schemas:** Define Zod schemas in `src/config/schemas.ts` to share validation logic between Backend and Frontend.
- **Input:** Validate prompt inputs at CLI boundary (`commander`/`inquirer`) and Channel boundary (Adapters).

## 🚀 Workflows

### Building & Running
- **Full Build:** `npm run build` (compiles Backend `tsc` && Frontend `vite build`).
- **Run Daemon:** `npm start -- start` (starts CLI daemon + HTTP server).
- **UI Dev:** `npm run dev --prefix src/ui` (runs Vite dev server).
- **Verify Start:** `npx tsx src/runtime/__tests__/manual_start_verify.ts` (quick sanity check).

### Key Commands
- `npm start -- init` - Scaffolds configuration.
- `npm start -- doctor` - Diagnoses issues.
- `npm test` - Runs Vitest suite.

### Adding Features
1.  **Spec First:** Create/Read `specs/NNN-feature/`.
2.  **Contracts:** Define interfaces.
3.  **Implementation:** Build Core -> Config -> UI/Channel.
4.  **Register:** Register new commands in `src/cli/index.ts` or API endpoints in `src/http/api.ts`.
5.  **New UI Page:** Add route in `src/ui/src/App.tsx`, create page in `src/ui/src/pages/`.
