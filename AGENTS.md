# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Morpheus is a local-first AI operator/agent for developers. Node.js + TypeScript daemon with a React 19 + Vite + TailwindCSS web dashboard. It runs as a CLI daemon that orchestrates multiple LLM subagents, integrates with DevKit tools, MCP servers, and communicates via Terminal, Telegram, and Discord.

---

## Commands

### Backend Development
```bash
npm run dev:cli            # Run backend in watch mode (tsx watch)
npm run build              # Build backend (tsc) + frontend (vite build)
npm run start              # Run compiled daemon (bin/morpheus.js)
```

### Frontend Development
```bash
npm run dev:ui             # Vite dev server for the dashboard (src/ui/)
npm run build:ui           # Build frontend only
```

### Testing
```bash
npm test                   # Run all tests (vitest)
npx vitest run <file>      # Run a single test file
npx vitest run src/runtime/chronos/__tests__/parser.test.ts
```

### Installing New Packages
When adding `node-cron`, `cron-parser`, or similar scheduling/peer-dep-heavy packages, use:
```bash
npm install <pkg> --legacy-peer-deps
```

---

## Key Conventions

### TypeScript / ESM
- Use `.js` extension in all relative imports: `import { Foo } from './foo.js'`
- `"type": "module"` in package.json — all files are ESM
- `tsconfig.json`: `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`
- Zod v4: use `.issues` (not `.errors`) for validation error arrays

### Config Precedence (highest → lowest)
1. Environment variables (e.g., `MORPHEUS_LLM_PROVIDER`)
2. `~/.morpheus/zaion.yaml`
3. `DEFAULT_CONFIG` in `src/types/config.ts`

When adding new config keys: define the Zod schema in `src/config/schemas.ts` (child schemas must be declared BEFORE `ConfigSchema` to avoid forward-reference TS errors), add to `src/types/config.ts`, and handle env var override in `src/config/manager.ts`.

---

## Architecture

### Startup Flow
```
bin/morpheus.js             # Shebang entry: loads .env, dynamic import
  → src/cli/index.ts        # Commander.js program, calls scaffold() preAction
  → src/runtime/scaffold.ts # Ensures ~/.morpheus/ dirs + zaion.yaml exist
  → src/cli/commands/start.ts  # Instantiates all services:
      Oracle, HttpServer, ChronosRepository, ChronosWorker,
      TaskRepository, TaskWorker, TaskNotifier, TelegramAdapter
```

### Agent Delegation Pattern
Oracle is the root orchestrator. It delegates to specialized subagents via tools:

| Tool | Subagent | File | Domain |
|---|---|---|---|
| `apoc_delegate` | Apoc | `src/runtime/apoc.ts` | Filesystem, shell, git, browser via DevKit |
| `trinity_delegate` | Trinity | `src/runtime/trinity.ts` | PostgreSQL, MySQL, SQLite, MongoDB |
| `neo_delegate` | Neo | `src/runtime/neo.ts` | MCP tool orchestration |

Oracle never executes DevKit tools directly — it routes through subagents.

### HTTP API Structure
```
src/http/
  ├─ server.ts         # Express wrapper: middleware, routes, start/stop
  ├─ api.ts            # createApiRouter(oracle, chronosWorker) — all endpoints
  ├─ routers/
  │   └─ chronos.ts    # createChronosJobRouter() + createChronosConfigRouter()
  ├─ webhooks-router.ts
  └─ middleware/
      └─ auth.ts       # API key validation
```

New feature routers follow the factory-function pattern from `chronos.ts`: export `createXRouter(deps)` and mount in `api.ts`.

### DevKit Tools (Apoc's toolbox)
```
src/devkit/tools/
  ├─ filesystem.ts   # read, write, delete, list, mkdir, copy, move
  ├─ shell.ts        # execShell, execCommand
  ├─ git.ts          # clone, commit, push, pull, status, diff, log, branch
  ├─ network.ts      # GET/POST/PUT/DELETE, health checks
  ├─ packages.ts     # npm/pip install, list, search
  ├─ processes.ts    # spawn, kill, list, wait
  ├─ system.ts       # CPU, memory, disk, env vars
  └─ browser.ts      # Puppeteer: navigate, screenshot, extract, form fill
```

`buildDevKit()` in `src/devkit/index.ts` returns a `StructuredTool[]` array for LangChain.

### Background Workers
All workers use a singleton + `start()`/`stop()` pattern:
- **ChronosWorker** — `tick()` loop, executes due jobs, parses next run times
- **TaskWorker** — polls `tasks` table, routes to agent by `tasks.agent` column
- **TaskNotifier** — sends completion notifications (Telegram, webhooks)
- **Session embedding scheduler** — populates Sati embeddings asynchronously

In `tasks` table, Trinity agent rows use `agent = 'trinit'` (not `'trinity'`).

### Architecture Quick Reference

| Layer | Path | Notes |
|---|---|---|
| Main entry | `src/index.ts` | |
| CLI entry | `src/cli/index.ts` | Commander.js |
| Start command | `src/cli/commands/start.ts` | Wires all services |
| Oracle agent | `src/runtime/oracle.ts` | LangChain ReactAgent |
| Apoc subagent | `src/runtime/apoc.ts` | DevKit, `apoc_delegate` |
| Trinity subagent | `src/runtime/trinity.ts` | DB specialist, `trinity_delegate` |
| Neo subagent | `src/runtime/neo.ts` | MCP tools, `neo_delegate` |
| Provider factory | `src/runtime/providers/factory.ts` | `create()` / `createBare()` |
| HTTP API | `src/http/api.ts` | Express, mounted at `/api` |
| Config manager | `src/config/manager.ts` | Singleton, `getInstance().get()` |
| Config schemas | `src/config/schemas.ts` | Zod schemas |
| Paths constants | `src/config/paths.ts` | `PATHS.root`, `PATHS.config`, etc. |
| Frontend | `src/ui/src/` | React 19 + Vite |
| Chronos scheduler | `src/runtime/chronos/` | parser, worker, repository |
| Memory DB | `~/.morpheus/memory/short-memory.db` | sessions, messages, tasks, chronos |
| Trinity DB | `~/.morpheus/memory/trinity.db` | DB registry (encrypted passwords) |
| Sati DB | `~/.morpheus/memory/sati-memory.db` | sqlite-vec embeddings |
| MCP config | `~/.morpheus/mcps.json` | MCP server definitions |
| Daemon config | `~/.morpheus/zaion.yaml` | User config file |

### Test File Locations
```
src/
  ├─ channels/__tests__/        # Telegram adapter
  ├─ config/__tests__/          # Config manager
  ├─ http/__tests__/            # Auth middleware, config API
  ├─ runtime/__tests__/         # Oracle agent behavior
  ├─ runtime/chronos/__tests__/ # Parser + Worker
  ├─ runtime/memory/__tests__/  # SQLite chat history
  ├─ runtime/memory/sati/__tests__/  # Sati memory
  └─ runtime/tools/__tests__/   # MCP tool loading + execution
```

---

## UI Design System

The dashboard uses a **dual-theme** system: Azure (light) and Matrix (dark).
Matrix is the default theme. All new UI must support both modes via Tailwind `dark:` classes.

### Dark Mode Color Tokens

| Token | Role |
|---|---|
| `dark:bg-black` | Modal backgrounds, interactive inputs |
| `dark:bg-zinc-900` | Read-only content boxes inside modals |
| `dark:border-matrix-primary` | All borders (full opacity — never `/30`) |
| `dark:text-matrix-highlight` | Titles, headings, emphasis |
| `dark:text-matrix-secondary` | Input text, labels, body text |
| `dark:text-matrix-tertiary` | Icons, muted secondary text |

### Modal / Dialog Pattern
```tsx
// Container
className="... dark:bg-black dark:border-matrix-primary shadow-xl ..."

// Title
className="... dark:text-matrix-highlight ..."

// Close button
className="... dark:text-matrix-tertiary dark:hover:text-matrix-highlight ..."

// Backdrop
className="fixed inset-0 bg-black/50 backdrop-blur-sm"
```

### Form Input Pattern (input, textarea, select)
```tsx
className="... dark:bg-black dark:border-matrix-primary dark:text-matrix-secondary
            dark:focus:border-matrix-highlight dark:placeholder-matrix-secondary/50 ..."
```

### Form Label Pattern
```tsx
className="... dark:text-matrix-secondary ..."
```

### Content Box Pattern (read-only areas inside modals)
```tsx
className="... dark:bg-zinc-900 dark:text-matrix-secondary ..."
```

### Anti-patterns — Never Use
- `dark:bg-zinc-800` / `dark:bg-zinc-950` / `dark:bg-matrix-base` for inputs
- `dark:text-matrix-highlight` for input text (titles only)
- `dark:text-matrix-text` or `dark:text-matrix-dim` (deprecated — use `matrix-secondary`)
- `dark:border-matrix-primary/30` for modal/input borders (full opacity only)
- `shadow-lg` on modals (use `shadow-xl`)

### Shared Input Components
Prefer reusable components in `src/ui/src/components/forms/`:
- `TextInput` — text input with label + error
- `NumberInput` — number input with label + error
- `SelectInput` — select with label + options + error

These already have the correct dark mode classes applied.

---

## Spec-Driven Development
New features require a `specs/NNN-feature-name/` folder with:
- `spec.md` — functional requirements (source of truth)
- `plan.md` — technical implementation strategy
- `tasks.md` — implementation checklist
- `contracts/` — TypeScript interfaces defined before coding
