# Morpheus Copilot Instructions

## 🧠 Project Context
**Morpheus** is a local-first AI operator/agent for developers. It runs as a persistent background daemon (CLI + HTTP Server), bridging LLMs (via LangChain) to external channels (Telegram, Discord), a Web UI, and local tools (MCP + DevKit + Skills).

**Key Insight**: Morpheus is an *orchestrator* not just a chatbot - it manages LLM lifecycle, persistent memory (short & long-term), tool execution, async task queues, scheduled jobs, and multi-channel communication as a unified daemon process.

## 🏗 Architecture & Core Components

### Entry Point & CLI
- **Entry:** `bin/morpheus.js` → executes built `src/cli/index.ts`
- **Framework:** `commander` parses commands (`src/cli/commands/*.ts`)
- **Daemon:** `src/runtime/lifecycle.ts` manages PID file (`~/.morpheus/morpheus.pid`)
- **Startup Flow:** `start.ts` → scaffold → checkStalePid → load config → load SkillRegistry → initialize Oracle → start channels/HTTP → start workers

### Multi-Agent Architecture
Oracle is the root orchestrator. It delegates to specialized subagents via tools:

| Tool | Subagent | File | Domain |
|---|---|---|---|
| `skill_execute` | Keymaker | `src/runtime/keymaker.ts` | Sync skill execution (immediate result) |
| `skill_delegate` | Keymaker | `src/runtime/keymaker.ts` | Async skill execution (background task) |
| `apoc_delegate` | Apoc | `src/runtime/apoc.ts` | Filesystem, shell, git, browser via DevKit |
| `trinity_delegate` | Trinity | `src/runtime/trinity.ts` | PostgreSQL/MySQL/SQLite/MongoDB queries |
| `neo_delegate` | Neo | `src/runtime/neo.ts` | MCP tool orchestration |
| `chronos_schedule` | Chronos | `src/runtime/chronos/` | Scheduled job management |

Oracle never executes DevKit/MCP tools directly — it routes through subagents.

**Subagent Execution Mode** (`execution_mode: 'sync' | 'async'`):

Each subagent (Apoc, Neo, Trinity) can be configured to run synchronously or asynchronously:
- **`async`** (default): Creates a background task in the queue. TaskWorker picks it up, executes it, and TaskNotifier delivers the result via the originating channel. Oracle responds immediately with a task acknowledgement.
- **`sync`**: Oracle executes the subagent inline during the same turn. The result is returned directly in Oracle's response, like `skill_execute` does for Keymaker. No task is created in the queue.

Configurable via `zaion.yaml` (e.g., `neo.execution_mode: sync`), env var (e.g., `MORPHEUS_NEO_EXECUTION_MODE=sync`), or the Settings UI.

**Verbose Mode** (`verbose_mode: true | false`, default: `true`):

When enabled, every tool execution by any agent sends a real-time notification (`🔧 executing: <tool_name>`) to the originating channel (Telegram, Discord, etc.). Channels `api` and `ui` are excluded. Configurable via `zaion.yaml`, env var `MORPHEUS_VERBOSE_MODE`, or the Settings UI.

### Skills System (Keymaker)
- **Location:** `src/runtime/skills/` (loader, registry, tool, types)
- **User Skills:** `~/.morpheus/skills/` folders with `SKILL.md` (YAML frontmatter + instructions)
- **Execution Modes:**
  - `sync` (default): `skill_execute` returns result inline
  - `async`: `skill_delegate` queues background task, notifies on completion
- **Format:** Single `SKILL.md` with frontmatter:
  ```markdown
  ---
  name: my-skill
  description: Brief description
  execution_mode: sync
  tags: [automation]
  ---
  # Instructions for Keymaker...
  ```

### Memory System (Three-Database Architecture)
- **Short-term:** `~/.morpheus/memory/short-memory.db` - per-session chat history
- **Long-term (Sati):** `~/.morpheus/memory/sati-memory.db` - persistent facts + session embeddings
- **Trinity:** `~/.morpheus/memory/trinity.db` - database registry (encrypted passwords)

**Sati Middleware:** `SatiMemoryMiddleware` hooks `beforeAgent` (retrieval) and `afterAgent` (consolidation).

### Channels & Adapters
- **Pattern:** `src/channels/registry.ts` (`ChannelRegistry` singleton) + `IChannelAdapter` interface
- **Adding a channel:**
  1. Create `src/channels/<name>.ts` implementing `IChannelAdapter`
  2. Add config to `src/types/config.ts` + `src/config/schemas.ts`
  3. Register in `start.ts` via `ChannelRegistry.register(adapter)`
  4. Dispatchers pick it up automatically

### Background Workers
All use singleton + `start()`/`stop()` pattern:
- **TaskWorker** — polls `tasks` table, routes to agent by `tasks.agent` column
- **TaskNotifier** — sends completion notifications via `ChannelRegistry`
- **ChronosWorker** — executes due scheduled jobs

**Note:** Trinity tasks use `agent = 'trinit'` (not `'trinity'`).

### HTTP Server & Web UI
- **Server:** `src/http/server.ts` (Express.js) → API routes in `src/http/api.ts`
- **Auth:** `x-architect-pass` header (optional `THE_ARCHITECT_PASS` env var)
- **UI:** `src/ui/` (React 19, Vite, TailwindCSS)

## 🛠 Developer Patterns & Conventions

### TypeScript & ESM (STRICT)
- **Native ESM:** `import { Foo } from './foo.js';` — MUST include `.js` extension
- **Type Imports:** Use `import type` for type-only imports
- **Zod v4:** Use `.issues` (not `.errors`) for validation error arrays

### Config Precedence (highest → lowest)
1. Environment variables (e.g., `MORPHEUS_LLM_PROVIDER`)
2. `~/.morpheus/zaion.yaml`
3. `DEFAULT_CONFIG` in `src/types/config.ts`

**Adding config keys:** Define Zod schema in `schemas.ts` (child schemas BEFORE parent), add to `types/config.ts`, handle env override in `manager.ts`.

### Infrastructure Patterns
- **Singletons:** `ClassName.getInstance()` (ConfigManager, DisplayManager, SkillRegistry, etc.)
- **Logging:** `DisplayManager.getInstance().log(message, { source: 'ComponentName', level: 'info' })` — NEVER `console.log`
- **Validation:** Zod schemas for all external inputs

### UI Design System (Dual-Theme)
- **Themes:** Azure (light) + Matrix (dark). Dark is default.
- **Dark mode tokens:**
  - `dark:bg-black` — modals/inputs
  - `dark:bg-zinc-900` — read-only content
  - `dark:border-matrix-primary` — all borders (full opacity)
  - `dark:text-matrix-highlight` — titles only
  - `dark:text-matrix-secondary` — body text, labels
- **Anti-patterns:** Never use `dark:bg-zinc-800`, `dark:border-matrix-primary/30`, `dark:text-matrix-highlight` for input text

## 🚀 Workflows

### Building & Running
```bash
npm run build          # Backend tsc + UI vite build
npm run dev:cli        # Watch backend with tsx
npm run dev:ui         # Vite dev server for dashboard
npm start -- start     # Run daemon
npm test               # Vitest
```

### Key Commands
```bash
npm start -- init           # Scaffold ~/.morpheus/
npm start -- doctor         # Diagnose environment
npm start -- status         # Check daemon running
npm start -- session new    # Start new session
npm start -- skills         # List loaded skills
npm start -- skills --reload # Reload skills from disk
```

### Adding Features
1. **Config:** Define Zod schema in `schemas.ts`, types in `types/config.ts`
2. **Backend:** Core logic in `src/runtime/`, CLI in `src/cli/commands/`
3. **API:** Add routes to `src/http/api.ts`
4. **UI:** Components in `src/ui/src/`
5. **Register:** CLI in `index.ts`, API routes in `api.ts`

### Architecture Quick Reference
| Component | Path |
|---|---|
| Oracle (main agent) | `src/runtime/oracle.ts` |
| Skills system | `src/runtime/skills/` |
| Keymaker (skill executor) | `src/runtime/keymaker.ts` |
| Apoc (DevKit) | `src/runtime/apoc.ts` |
| Trinity (databases) | `src/runtime/trinity.ts` |
| Neo (MCP) | `src/runtime/neo.ts` |
| Chronos (scheduler) | `src/runtime/chronos/` |
| Channel adapters | `src/channels/` |
| Task queue | `src/runtime/tasks/` |
| Memory (Sati) | `src/runtime/memory/sati/` |
| Config | `src/config/` |
| HTTP API | `src/http/api.ts` |
| UI | `src/ui/src/` |

## 📝 Spec-Driven Development
For major features, create `specs/NNN-feature/` with:
- `spec.md` — requirements, user stories, acceptance criteria
- `plan.md` — technical design, architecture decisions
- `tasks.md` — implementation checklist
- `contracts/` — TypeScript interfaces before coding
