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

Oracle never executes DevKit/MCP tools directly — it routes through subagents.

**Subagent Execution Mode** (`execution_mode: 'sync' | 'async'`):

Each subagent (Apoc, Neo, Trinity) can be configured to run synchronously or asynchronously:
- **`async`** (default): Creates a background task in the queue. TaskWorker picks it up, executes it, and TaskNotifier delivers the result via the originating channel. Oracle responds immediately with a task acknowledgement.
- **`sync`**: Oracle executes the subagent inline during the same turn. The result is returned directly in Oracle's response, like `skill_execute` does for Keymaker. No task is created in the queue.

Configurable via `zaion.yaml` (e.g., `neo.execution_mode: sync`), env var (e.g., `MORPHEUS_NEO_EXECUTION_MODE=sync`), or the Settings UI.

**Verbose Mode** (`verbose_mode: true | false`, default: `true`):

When enabled, every tool execution by any agent sends a real-time notification (`🔧 executing: <tool_name>`) to the originating channel (Telegram, Discord, etc.). Channels `api` and `ui` are excluded. Configurable via `zaion.yaml`, env var `MORPHEUS_VERBOSE_MODE`, or the Settings UI.

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

### DevKit Tools (Apoc & Keymaker's toolbox)
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

### DevKit Security (Shared Config)

DevKit tools are shared by both Apoc and Keymaker. Security is configured via a **shared** `devkit` section in `zaion.yaml` (not per-agent):

```yaml
devkit:
  sandbox_dir: /home/user/projects    # All file/shell ops confined here (default: CWD)
  readonly_mode: false                 # Block destructive filesystem ops (write, delete, move)
  enable_filesystem: true              # Toggle filesystem tools
  enable_shell: true                   # Toggle shell tools
  enable_git: true                     # Toggle git tools
  enable_network: true                 # Toggle network tools
  allowed_shell_commands: []           # Shell command allowlist (empty = allow all)
  timeout_ms: 30000                    # Tool execution timeout
```

**Security model:**
- **Sandbox enforcement:** `guardPath()` confines ALL filesystem operations (reads AND writes) to `sandbox_dir`. Shell `cwd`, git clone destinations, and network downloads are also validated.
- **Readonly mode:** When enabled, destructive operations (write, delete, move, copy) return an error.
- **Category toggles:** Disable entire tool categories (filesystem, shell, git, network). Non-toggleable categories (processes, packages, system, browser) always load.
- **Shell allowlist:** When `allowed_shell_commands` is non-empty, only listed commands are permitted.
- **Migration:** `apoc.working_dir` is auto-migrated to `devkit.sandbox_dir` if the latter is not set.

Environment variables: `MORPHEUS_DEVKIT_SANDBOX_DIR`, `MORPHEUS_DEVKIT_READONLY_MODE`, `MORPHEUS_DEVKIT_ENABLE_FILESYSTEM`, etc.

UI: Settings → DevKit tab (3 sections: Security, Tool Categories, Shell Allowlist).

### Channel Adapter Pattern

`src/channels/registry.ts` — `ChannelRegistry` singleton + `IChannelAdapter` interface.

Every channel adapter implements `IChannelAdapter` and self-registers at startup via `ChannelRegistry.register()`. Notification machinery (`TaskDispatcher`, `ChronosWorker`, `WebhookDispatcher`) routes through the registry and never holds direct adapter references.

**`IChannelAdapter` interface** (required fields):
```typescript
interface IChannelAdapter {
  readonly channel: string;                                       // e.g. 'telegram', 'discord'
  sendMessage(text: string): Promise<void>;                      // broadcast to all users
  sendMessageToUser(userId: string, text: string): Promise<void>;
  disconnect(): Promise<void>;
}
```

**To add a new channel:**
1. Create `src/channels/<name>.ts` implementing `IChannelAdapter` with `readonly channel = '<name>' as const`
2. Add config to `src/types/config.ts` + `src/config/schemas.ts` + `src/config/manager.ts`
3. `ChannelRegistry.register(adapter)` in `src/cli/commands/start.ts` **and** `restart.ts`
4. Add UI section in `src/ui/src/pages/Settings.tsx` under the Channels tab
5. Nothing else changes — dispatchers pick it up automatically

**`OriginChannel` routing in `TaskDispatcher`:**

| `origin_channel` | Routing |
|---|---|
| `'telegram'` / `'discord'` / any channel | `ChannelRegistry.sendToUser(channel, userId, msg)` or `adapter.sendMessage()` |
| `'chronos'` | `ChannelRegistry.broadcast(msg)` — all registered adapters |
| `'webhook'` | iterates `webhook.notification_channels`, calls each via registry |
| `'ui'` | writes result to SQLite session history |

**Chronos jobs** always tag delegated tasks as `origin_channel: 'chronos'` so TaskDispatcher broadcasts their result to every registered channel.

---

### Background Workers
All workers use a singleton + `start()`/`stop()` pattern:
- **ChronosWorker** — `tick()` loop, executes due jobs, parses next run times
- **TaskWorker** — polls `tasks` table, routes to agent by `tasks.agent` column
- **TaskNotifier** — sends completion notifications via `ChannelRegistry`
- **Session embedding scheduler** — populates Sati embeddings asynchronously

In `tasks` table, Trinity agent rows use `agent = 'trinit'` (not `'trinity'`).

### Architecture Quick Reference

| Layer | Path | Notes |
|---|---|---|
| Main entry | `src/index.ts` | |
| CLI entry | `src/cli/index.ts` | Commander.js |
| Start command | `src/cli/commands/start.ts` | Wires all services, registers channel adapters |
| Channel registry | `src/channels/registry.ts` | `IChannelAdapter` + `ChannelRegistry` singleton |
| Telegram adapter | `src/channels/telegram.ts` | `channel = 'telegram'`, implements `IChannelAdapter` |
| Discord adapter | `src/channels/discord.ts` | `channel = 'discord'`, implements `IChannelAdapter` |
| Oracle agent | `src/runtime/oracle.ts` | LangChain ReactAgent |
| Apoc subagent | `src/runtime/apoc.ts` | DevKit, `apoc_delegate` |
| DevKit config | `src/devkit/registry.ts` | Shared security: sandbox, readonly, category toggles |
| Trinity subagent | `src/runtime/trinity.ts` | DB specialist, `trinity_delegate` |
| Neo subagent | `src/runtime/neo.ts` | MCP tools, `neo_delegate` |
| MCP Tool Cache | `src/runtime/tools/cache.ts` | Singleton cache for MCP tools |
| MCP Factory | `src/runtime/tools/factory.ts` | `Construtor.create()` / `reload()` / `getStats()` |
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
