# Morpheus Copilot Instructions

## 🧠 Project Context
**Morpheus** is a local-first AI operator/agent for developers, running as a Node.js daemon with a React/Vite UI. It acts as an orchestrator (Oracle) that delegates tasks to specialized sub-agents (Apoc, Trinity, Neo, Sati).

## 🏗 Architecture & Core Patterns

### Agent Delegation Model
- **Oracle (Root):** Main conversational loop (`src/runtime/oracle.ts`). Decides whether to answer directly or delegate.
- **Sub-Agents:**
  - **Apoc:** Filesystem, shell, git, browser (`src/runtime/apoc.ts`).
  - **Trinity:** Database management (`src/runtime/trinity.ts`).
  - **Neo:** MCP tool orchestration (`src/runtime/neo.ts`).
  - **Sati:** Long-term memory & retrieval (`src/runtime/memory/sati/`).
- **Rule:** Oracle *never* executes tools directly; it delegates to the appropriate sub-agent.

### Persistence & Memory (Local-First)
- **Short-Term:** `~/.morpheus/memory/short-memory.db` (SQLite) - Sessions, chat history.
- **Long-Term (Sati):** `~/.morpheus/memory/sati-memory.db` (SQLite + `sqlite-vec`) - Facts, embeddings.
- **Config:** `~/.morpheus/zaion.yaml` managed by `ConfigManager` singleton.
- **Secrets:** Environment variables or encrypted in `trinity.db`.

### UI & Frontend (`src/ui`)
- **Stack:** React 19, Vite, TailwindCSS.
- **Theme:** Dual-theme (Azure/Light, Matrix/Dark).
- **Conventions:**
  - Use `dark:` variants for Matrix theme (e.g., `dark:bg-black`, `dark:border-matrix-primary`).
  - **NEVER** use `console.log` in backend; use `DisplayManager.getInstance().log()`.

## 🛠 Developer Workflows

### Build & Run
- **Dev Backend:** `npm run dev:cli` (Watch mode with `tsx`).
- **Dev UI:** `npm run dev:ui` (Vite dev server).
- **Build All:** `npm run build` (TSC + Vite build).
- **Run Daemon:** `npm start` (Executes `bin/morpheus.js`).

### Testing
- **Framework:** Vitest (`npm test`).
- **Pattern:** Co-located `__tests__/` directories.
- **Example:** `npx vitest run src/runtime/chronos/__tests__/parser.test.ts`

### Spec-Driven Development
- Features **MUST** start with `specs/NNN-feature/`:
  1. `spec.md` (Requirements)
  2. `plan.md` (Technical Design)
  3. `contracts/` (Interfaces defined *before* code)

## 🚨 Critical Conventions (Strict Enforcement)

1.  **ESM Only:**
    - Always include `.js` extension in relative imports: `import { Foo } from './foo.js';`
    - `package.json` is `type: module`.

2.  **Logging:**
    - **FORBIDDEN:** `console.log` in backend code.
    - **REQUIRED:** `DisplayManager.getInstance().log(msg, { source: 'Component', level: 'info' })`.

3.  **Error Handling:**
    - Fail open for non-critical features (e.g., Sati middleware).
    - Use Zod schemas for all external inputs (`src/config/schemas.ts`).

4.  **Database Access:**
    - Use `better-sqlite3` for synchronous local DB ops.
    - `src/runtime/memory/sqlite.ts` for chat history.

## 📂 Key Paths
- **Entry:** `src/cli/index.ts`, `bin/morpheus.js`
- **Config:** `src/config/manager.ts`, `src/config/schemas.ts`
- **Agents:** `src/runtime/oracle.ts`, `src/runtime/apoc.ts`
- **Tools:** `src/devkit/tools/` (Apoc), `src/runtime/tools/` (MCP)
- **API:** `src/http/api.ts`, `src/http/server.ts`
