# Morpheus Copilot Instructions

## 🧠 Project Context
**Morpheus** is a local-first AI operator/agent for developers. It runs as a persistent background daemon (CLI + HTTP Server), bridging LLMs (via LangChain) to external channels (Telegram), a Web UI, and local tools (MCP support).

**Key Insight**: Morpheus is an *orchestrator* not just a chatbot - it manages LLM lifecycle, persistent memory (short & long-term), tool execution, and multi-channel communication as a unified daemon process.

## 🏗 Architecture & Core Components

### Entry Point & CLI
- **Entry:** `bin/morpheus.js` → executes built `src/cli/index.ts`
- **Framework:** `commander` parses commands (`src/cli/commands/*.ts`)
- **Daemon:** `src/runtime/lifecycle.ts` manages PID file (`~/.morpheus/morpheus.pid`)
- **Startup Flow:** `start.ts` → scaffold → checkStalePid → load config → initialize Oracle → start channels/HTTP

### Runtime & Agent
- **Oracle Engine:** `src/runtime/oracle.ts` implements `IOracle` - the main conversation loop using LangChain's `ReactAgent`
  - **Memory System (Three-Database Architecture):**
    - **Short-term:** `SQLiteChatMessageHistory` (`src/runtime/memory/sqlite.ts`) - per-session chat history
      - **Storage:** `~/.morpheus/memory/short-memory.db`
    - **Long-term (Sati):** `src/runtime/memory/sati/` - persistent facts/preferences across sessions
      - **Architecture Rule:** Sati is an *independent sub-agent* invoked by middleware, NOT part of Oracle's main flow
      - **Middleware:** `SatiMemoryMiddleware` (`src/runtime/memory/sati/index.ts`) hooks into `beforeAgent` (retrieval) and `afterAgent` (consolidation)
      - **Storage:** Dedicated `sati-memory.db` (separate from chat history)
    - **Session Embeddings:** Background worker for semantic search over past sessions
      - **Service:** `EmbeddingService` (`src/runtime/memory/embedding.service.ts`) - uses `@xenova/transformers` with `Xenova/all-MiniLM-L6-v2` (384-dim embeddings)
      - **Worker:** `runSessionEmbeddingWorker()` processes completed sessions asynchronously
      - **Scheduler:** Runs every 5 minutes to embed pending sessions (`startSessionEmbeddingScheduler()`)
      - **Storage:** Vector embeddings stored in `sati-memory.db` using `sqlite-vec` extension
    - **Context Window:** Configurable via `llm.context_window` (default: 100 messages) - controls how many messages from history are loaded into LLM context
  - **Providers:** `src/runtime/providers/factory.ts` creates LLMs (OpenAI, Anthropic, Google Gemini, Ollama)
  - **Tools:** `src/runtime/tools/factory.ts` loads MCP servers from `~/.morpheus/mcps.json`
    - **Schema Sanitization:** `wrapToolWithSanitizedSchema()` removes fields unsupported by Google Gemini (`examples`, `additionalInfo`, `$schema`, etc.)
- **Specialized Agents:**
  - **Audio:** `src/runtime/audio-agent.ts` (Telegram voice → Google Gemini transcription)
  - **Telephonist:** `src/runtime/telephonist.ts` handles phone-style interactions
- **Output:** `DisplayManager` (`src/runtime/display.ts`) - centralized logging (NEVER use `console.log`)

### Channels & Adapters
- **Location:** `src/channels/` (e.g., `telegram.ts`)
- **Pattern:** Each adapter converts external protocol → Oracle prompts → external responses
- **Security:** Strict `allowedUsers` allowlist enforcement (see `TelegramAdapter.isAuthorized()`)
- **Voice Handling:** Telegram adapter delegates audio to `Telephonist` → Audio Agent

### HTTP Server & Web UI
- **Server:** `src/http/server.ts` (Express.js)
  - **API:** `/api/*` routes in `src/http/api.ts`
  - **Auth:** Optional `THE_ARCHITECT_PASS` environment variable (checked via `x-architect-pass` header)
  - **Static:** Serves compiled React UI from `dist/ui/`
- **UI:** `src/ui/` (React 19, Vite, TailwindCSS)
  - **Theme:** Matrix-inspired green/dark aesthetic
  - **Data:** SWR hooks for API client (`src/ui/src/services/`)

### Configuration
- **Manager:** `ConfigManager` singleton (`src/config/manager.ts`)
- **Schema:** Zod schemas in `src/config/schemas.ts` (shared between Backend & Frontend)
- **Persistence:** YAML at `~/.morpheus/config.yaml` (aliased as `zaion.yaml` in some docs)
- **Migration:** `src/runtime/migration.ts` handles config schema upgrades

## 📝 Specification-Driven Development
**CRITICAL:** Do not write code without understanding the active spec in `specs/NNN-feature/`.

### Workflow
1. **Read Spec:** Start with `specs/NNN-feature/spec.md` (Requirements, User Stories, Acceptance Criteria)
2. **Read Plan:** Study `specs/NNN-feature/plan.md` (Technical Design, Architecture Decisions)
3. **Define Contracts:** Create interfaces in `src/types/` or `specs/NNN-feature/contracts/` *before* implementation
4. **Implement:** Follow tech design in plan.md
5. **Track Progress:** Update `specs/NNN-feature/tasks.md` as you complete items

### Spec Structure (Mandatory Elements)
- **User Stories:** P1/P2/P3 priority scenarios with acceptance criteria
- **Edge Cases:** Must document cold start, error states, boundary conditions
- **Functional Requirements:** FR-XXX format with explicit MUST/SHOULD language
- **Independent Testing:** Each user story must be testable in isolation

## 🛠 Developer Patterns & Conventions

### TypeScript & ESM (STRICT)
- **Native ESM Only:**
  - ✅ `import { Foo } from './foo.js';` (MUST include `.js` extension for relative imports)
  - ❌ `import { Foo } from './foo';` (will break at runtime)
- **Type Imports:** Use `import type` for type-only imports
- **Build:** `tsc` compiles TS → JS (preserving `.js` extensions in output)

### Infrastructure Patterns
- **Singletons:** Access via `ClassName.getInstance()` (e.g., `ConfigManager`, `DisplayManager`, `SatiMemoryMiddleware`)
- **Logging:** `DisplayManager.getInstance().log(message, { source: 'ComponentName', level: 'info' })` - NEVER `console.log`
- **Validation:** Zod schemas for all external inputs (CLI args, API bodies, Channel messages)
- **Error Handling:** Fail open for non-critical features (e.g., Sati middleware returns null on error to allow Oracle to continue)

### File Organization
- **Types:** `src/types/` for shared interfaces (e.g., `config.ts`, `display.ts`)
- **Tests:** Co-located `__tests__/` directories (Vitest)
- **Specs:** `specs/NNN-feature/` for feature documentation
- **Plans:** `plans/` for implementation roadmaps (separate from specs)

## 🚀 Workflows

### Building & Running
- **Build All:** `npm run build` (Backend `tsc` + UI `vite build`)
- **Dev Backend:** `npm run dev:cli` (Watches `src/cli/index.ts` with `tsx`)
- **Dev UI:** `npm run dev:ui` (alias for `npm run dev --prefix src/ui`)
- **Run Daemon:** `npm start -- start` (or `npx . start` in dev)
- **Tests:** `npm test` (Vitest)

### Key Commands
- `npm start -- init` - Scaffold config/keys (creates `~/.morpheus/`)
- `npm start -- doctor` - Diagnose environment (checks API keys, config, processes)
- `npm start -- status` - Check if daemon is running
- `npm start -- stop` - Kill daemon process
- `npm start -- session new` - Start a new session (archives current conversation)
- `npm start -- session status` - Get current session information
- `npm run backfill` - Manually trigger embedding generation for existing sessions
- `npx tsx src/runtime/__tests__/manual_start_verify.ts` - Quick sanity check for Oracle initialization

### Adding Features
1. **Spec:** Create `specs/NNN-new-feature/` with `spec.md`, `plan.md`, `tasks.md`
2. **Contracts:** Define types in `src/types/` or `specs/NNN-feature/contracts/`
3. **Implement:** 
   - Core logic in `src/runtime/` (if agent-related)
   - CLI commands in `src/cli/commands/`
   - API endpoints in `src/http/api.ts`
   - UI components in `src/ui/src/components/`
4. **Register:** 
   - CLI: Add to `src/cli/index.ts` command tree
   - API: Add route to `src/http/api.ts`
   - Config: Update Zod schemas in `src/config/schemas.ts`

### Publishing
- **Package:** `morpheus-cli` on npm
- **Build Before Publish:** `prepublishOnly` script runs `npm run build`
- **Files:** `dist/`, `bin/`, `README.md`, `LICENSE` (see `package.json` `files` field)

## 🔍 Key Implementation Notes

### MCP Tool Loading
- **Config:** `~/.morpheus/mcps.json` defines MCP servers
- **Loader:** `src/config/mcp-loader.ts` → `MultiServerMCPClient` from `@langchain/mcp-adapters`
- **Sanitization:** Tools are wrapped to remove Gemini-incompatible schema fields

### Memory Architecture
- **Three-Database System:**
  - `~/.morpheus/memory/short-memory.db` - Per-session chat history (Oracle short-term memory)
  - `~/.morpheus/memory/sati-memory.db` - Long-term facts + session embeddings (Sati + vector storage)
- **Sati (Long-Term Memory):**
  - **Separation:** Oracle (short-term) vs. Sati (long-term) - completely independent databases
  - **Middleware Hooks:**
    - `beforeAgent()`: Retrieves relevant memories, injects as AIMessage
    - `afterAgent()`: Analyzes conversation, extracts/stores new facts
  - **Categories:** Preference, Project, Identity, Personal Data, etc.
  - **Deduplication:** Hash-based to prevent redundant memories
- **Session Embeddings:**
  - **Purpose:** Enable semantic search over historical conversations
  - **Process:** Background scheduler embeds completed sessions every 5 minutes
  - **Vector DB:** Uses `sqlite-vec` extension with 384-dimensional embeddings
  - **Model:** Xenova/all-MiniLM-L6-v2 via @xenova/transformers

### Channel Security
- **Allowlist Pattern:** All adapters enforce strict user ID allowlists (Telegram: numeric IDs)
- **Silent Fail:** Unauthorized messages are logged but not responded to (security by obscurity)

### Configuration Migration
- **Auto-Migration:** `migrateConfigFile()` runs on startup to upgrade old configs
- **Schema Validation:** Zod ensures type safety across Backend/Frontend boundary
