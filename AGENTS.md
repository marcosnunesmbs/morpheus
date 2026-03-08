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
      TaskRepository, TaskWorker, TaskNotifier, TelegramAdapter,
      SmithRegistry (connects to remote Smiths)
```

### Agent Delegation Pattern
Oracle is the root orchestrator. It delegates to specialized subagents via tools:

| Tool | Subagent | File | Domain |
|---|---|---|---|
| `apoc_delegate` | Apoc | `src/runtime/subagents/apoc.ts` | Filesystem, shell, git, browser via DevKit |
| `trinity_delegate` | Trinity | `src/runtime/subagents/trinity/trinity.ts` | PostgreSQL, MySQL, SQLite, MongoDB |
| `neo_delegate` | Neo | `src/runtime/subagents/neo.ts` | MCP tool orchestration |
| `link_delegate` | Link | `src/runtime/subagents/link/link.ts` | Document search and RAG over indexed files |
| `smith_delegate` | Smith (remote) | `src/runtime/smiths/delegator.ts` | Remote DevKit execution via WebSocket |

All subagents self-register with `SubagentRegistry` (in `src/runtime/subagents/registry.ts`) during `getInstance()`. The registry is the single source of truth for delegation tool names, display metadata (emoji, color, Tailwind classes), session propagation, and task routing.

Oracle never executes DevKit/MCP tools directly — it routes through subagents.

### Creating a New Subagent

All subagents (Apoc, Neo, Trinity) follow a strict pattern. Follow these steps exactly.

#### Shared utilities — always use, never duplicate

```typescript
// src/runtime/subagents/utils.ts
extractRawUsage(lastMessage)           // 4-fallback chain for token usage
persistAgentMessage(name, content, config, sessionId, rawUsage, durationMs)
buildAgentResult(content, config, rawUsage, durationMs, stepCount)

// src/runtime/tools/delegation-utils.ts
buildDelegationTool(opts)              // builds Oracle's StructuredTool for sync/async delegation

// src/runtime/subagents/registry.ts
SubagentRegistry.register(reg)         // self-register in getInstance()
```

#### 1. Create `src/runtime/subagents/<name>.ts`

```typescript
import type { ISubagent } from "./ISubagent.js";
import { extractRawUsage, persistAgentMessage, buildAgentResult } from "./utils.js";
import { buildDelegationTool } from "../tools/delegation-utils.js";
import { SubagentRegistry } from "./registry.js";

export class MyAgent implements ISubagent {
  private static instance: MyAgent | null = null;
  private static currentSessionId: string | undefined = undefined;
  private static _delegateTool: StructuredTool | null = null;

  static getInstance(config?: MorpheusConfig): MyAgent {
    if (!MyAgent.instance) {
      MyAgent.instance = new MyAgent(config ?? ConfigManager.getInstance().get());
      // Self-register with SubagentRegistry
      SubagentRegistry.register({
        agentKey: 'myagent', auditAgent: 'myagent', label: 'MyAgent',
        delegateToolName: 'myagent_delegate', emoji: '🤖', color: 'blue',
        description: 'What this agent does',
        colorClass: 'text-blue-600 dark:text-blue-400',
        bgClass: 'bg-blue-50 dark:bg-blue-900/10',
        badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        instance: MyAgent.instance, hasDynamicDescription: false, isMultiInstance: false,
        setSessionId: (id) => MyAgent.setSessionId(id),
      });
    }
    return MyAgent.instance;
  }
  static resetInstance(): void { MyAgent.instance = null; MyAgent._delegateTool = null; }
  static setSessionId(id: string | undefined): void { MyAgent.currentSessionId = id; }

  // Optional: refresh tool description when runtime data changes (e.g. DB list, MCP catalog)
  static async refreshDelegateCatalog(): Promise<void> { /* update MyAgent._delegateTool.description */ }

  async initialize(): Promise<void> { ... }

  async execute(task, context?, sessionId?, taskContext?: OracleTaskContext): Promise<AgentResult> {
    // ... run agent ...
    const rawUsage = extractRawUsage(lastMessage);
    const stepCount = response.messages.filter(m => m instanceof AIMessage).length;
    await persistAgentMessage('myagent', content, agentConfig, targetSession, rawUsage, durationMs);
    return buildAgentResult(content, agentConfig, rawUsage, durationMs, stepCount);
  }

  createDelegateTool(): StructuredTool {
    if (!MyAgent._delegateTool) {
      MyAgent._delegateTool = buildDelegationTool({
        name: 'myagent_delegate',
        description: '...',
        agentKey: 'myagent',        // TaskAgent — must match tasks.agent column
        agentLabel: 'MyAgent',      // display name for logs
        auditAgent: 'myagent',      // AuditAgent
        isSync: () => ConfigManager.getInstance().get().myagent?.execution_mode === 'sync',
        notifyText: '🤖 MyAgent is executing your request...',
        executeSync: (task, context, sessionId, ctx) =>
          MyAgent.getInstance().execute(task, context, sessionId, { ...ctx, session_id: sessionId }),
      });
    }
    return MyAgent._delegateTool;
  }

  async reload(): Promise<void> { this.config = ConfigManager.getInstance().get(); this.agent = undefined; await this.initialize(); }
}
```

**`agentKey` vs `auditAgent`:** `agentKey` is the string stored in `tasks.agent` (DB key). If the DB key differs from the display name, use the DB key (e.g. Trinity: `agentKey: 'trinit'`, `auditAgent: 'trinity'`).

#### 2. Register types

- `src/runtime/tasks/types.ts` — add to `TaskAgent` union: `| 'myagent'`
- `src/runtime/audit/types.ts` — add to `AuditAgent` union: `| 'myagent'`

#### 3. Add config

- `src/config/schemas.ts` — add `MyAgentConfigSchema` **before** `ConfigSchema` (forward-reference rule)
- `src/types/config.ts` — add `myagent?: MyAgentConfig` to `MorpheusConfig`
- `src/config/manager.ts` — add `getMyAgentConfig()` + env var overrides

#### 4. Wire into Oracle (`src/runtime/oracle.ts`)

Oracle now uses `SubagentRegistry` for most wiring. You just need to ensure your agent is instantiated before Oracle initializes (so it self-registers):

```typescript
import { MyAgent } from './subagents/myagent.js';

// In initialize() — instantiate so it self-registers:
MyAgent.getInstance(this.config);

// Everything else is automatic:
// - SubagentRegistry.getDelegationTools() includes your agent's tool
// - SubagentRegistry.setAllSessionIds() propagates sessions
// - SubagentRegistry.refreshAllCatalogs() refreshes dynamic descriptions
// - SubagentRegistry.executeTask() routes tasks to your agent
```

#### 5. Add to barrel export (`src/runtime/subagents/index.ts`)

```typescript
export { MyAgent } from './myagent.js';
```

#### 6. Update hot-reload (`src/runtime/hot-reload.ts`)

Add `MyAgent.resetInstance()` to the hot-reload function.

#### Out of scope for this pattern

- **Smith** — multi-instance registry, different delegation architecture; has its own `smith-tool.ts`. Registered from Oracle via `registerSmithIfEnabled()`.
- **TaskWorker** — no longer needs per-agent switch/case. `SubagentRegistry.executeTask()` handles routing automatically.

**Subagent Execution Mode** (`execution_mode: 'sync' | 'async'`):

Each subagent (Apoc, Neo, Trinity, Link, Smith) can be configured to run synchronously or asynchronously:
- **`async`** (default): Creates a background task in the queue. TaskWorker picks it up, executes it, and TaskNotifier delivers the result via the originating channel. Oracle responds immediately with a task acknowledgement.
- **`sync`**: Oracle executes the subagent inline during the same turn. The result is returned directly in Oracle's response. No task is created in the queue.

Configurable via `zaion.yaml` (e.g., `neo.execution_mode: sync`), env var (e.g., `MORPHEUS_NEO_EXECUTION_MODE=sync`), or the Settings UI.

**Verbose Mode** (`verbose_mode: true | false`, default: `true`):

When enabled, every tool execution by any agent sends a real-time notification (`🔧 executing: <tool_name>`) to the originating channel (Telegram, Discord, etc.). Channels `api` and `ui` are excluded. Configurable via `zaion.yaml`, env var `MORPHEUS_VERBOSE_MODE`, or the Settings UI.

### HTTP API Structure
```
src/http/
  ├─ server.ts         # Express wrapper: middleware, routes, start/stop
  ├─ api.ts            # createApiRouter(oracle, chronosWorker) — all endpoints
  ├─ routers/
  │   ├─ agents.ts     # GET /api/agents/metadata — SubagentRegistry display data
  │   ├─ chronos.ts    # createChronosJobRouter() + createChronosConfigRouter()
  │   └─ smiths.ts     # Smith management, config, ping, delegation
  ├─ webhooks-router.ts
  └─ middleware/
      └─ auth.ts       # API key validation
```

New feature routers follow the factory-function pattern from `chronos.ts`: export `createXRouter(deps)` and mount in `api.ts`.

### DevKit Tools (External Library)

DevKit tools are now imported from the external `morpheus-devkit` library (published on npm). This library provides the complete toolset for filesystem, shell, git, network, packages, processes, system, and browser operations.

**Package dependency:**
```json
{
  "morpheus-devkit": "^1.0.0"
}
```

**Tool categories:**
- `filesystem` — read, write, delete, list, mkdir, copy, move
- `shell` — execShell, execCommand
- `git` — clone, commit, push, pull, status, diff, log, branch
- `network` — GET/POST/PUT/DELETE, health checks
- `packages` — npm/pip install, list, search
- `processes` — spawn, kill, list, wait
- `system` — CPU, memory, disk, env vars
- `browser` — Puppeteer: navigate, screenshot, extract, form fill

`buildDevKit()` in `src/devkit/index.ts` imports and returns a `StructuredTool[]` array from the external library for LangChain.

### DevKit Security (Shared Config)

DevKit tools are used by Apoc. Security is configured via a **shared** `devkit` section in `zaion.yaml`:

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

### Smith — Remote Agent System

Smith enables remote DevKit execution on isolated machines (Docker, VMs, cloud) via WebSocket.

**Architecture:**
- `SmithRegistry` (singleton) manages all connections. Initialized at startup, non-blocking.
- `SmithConnection` wraps a WebSocket client per Smith instance. Auth via token handshake. TLS supported.
- `SmithDelegator` creates a LangChain ReactAgent with **proxy tools** — local DevKit tools built for schema extraction, filtered by Smith's declared capabilities, wrapped in proxies that forward execution to the remote Smith via WebSocket.
- Oracle delegates via `smith_delegate` tool (sync or async, like other subagents).

**Config (`zaion.yaml`):**
```yaml
smiths:
  enabled: true
  execution_mode: sync    # or async
  heartbeat_interval_ms: 30000
  connection_timeout_ms: 10000
  task_timeout_ms: 300000
  entries:
    - name: smith1
      host: localhost
      port: 7778
      auth_token: secret-token
```

**Key behaviors:**
- **Hot-reload:** `SmithRegistry.reload()` diffs config vs runtime — connects new entries, disconnects removed ones. Triggered by `PUT /api/smiths/config` and `smith_manage` tool.
- **Reconnection:** Max 3 attempts. 401 auth failures stop retries immediately (`_authFailed` flag).
- **Non-blocking startup:** `connectAll()` fires and forgets — Smith connection failures don't block daemon boot.
- **LLM management tools:** `smith_list` (list all Smiths with state/capabilities), `smith_manage` (add/remove/ping/enable/disable).
- **Task queue:** Async Smith tasks use `agent = 'smith'` in the `tasks` table.

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
- **LinkWorker** — background document indexing and embedding generation
- **Session embedding scheduler** — populates Sati embeddings asynchronously

In `tasks` table, Trinity agent rows use `agent = 'trinit'` (not `'trinity'`). Smith tasks use `agent = 'smith'`. Link tasks use `agent = 'link'`.

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
| Subagent registry | `src/runtime/subagents/registry.ts` | `SubagentRegistry` singleton — single source of truth |
| Subagent barrel | `src/runtime/subagents/index.ts` | Re-exports all subagents, registry, utils |
| Subagent interface | `src/runtime/subagents/ISubagent.ts` | `ISubagent` contract |
| Subagent utils | `src/runtime/subagents/utils.ts` | `extractRawUsage`, `persistAgentMessage`, `buildAgentResult` |
| Apoc subagent | `src/runtime/subagents/apoc.ts` | DevKit, `apoc_delegate` |
| DevKit instrument | `src/runtime/subagents/devkit-instrument.ts` | Wraps DevKit tools with audit events |
| DevKit config | `src/devkit/registry.ts` | Shared security: sandbox, readonly, category toggles |
| DevKit library | `morpheus-devkit` | External npm package (filesystem, shell, git, network, packages, processes, system, browser) |
| Trinity subagent | `src/runtime/subagents/trinity/trinity.ts` | DB specialist, `trinity_delegate` |
| Trinity connector | `src/runtime/subagents/trinity/connector.ts` | PostgreSQL, MySQL, SQLite, MongoDB connections |
| Neo subagent | `src/runtime/subagents/neo.ts` | MCP tools, `neo_delegate` |
| Link subagent | `src/runtime/subagents/link/link.ts` | Document RAG, `link_delegate` |
| Link repository | `src/runtime/subagents/link/repository.ts` | Document and chunk storage |
| Link search | `src/runtime/subagents/link/search.ts` | Hybrid vector + keyword search |
| Link worker | `src/runtime/subagents/link/worker.ts` | Background indexing and embedding |
| Link chunker | `src/runtime/subagents/link/chunker.ts` | Document splitting for embeddings |
| Smith delegator | `src/runtime/smiths/delegator.ts` | Remote DevKit via WebSocket, `smith_delegate` |
| Smith registry | `src/runtime/smiths/registry.ts` | Singleton managing Smith connections |
| Smith connection | `src/runtime/smiths/connection.ts` | WebSocket client per Smith instance |
| Smith tool | `src/runtime/tools/smith-tool.ts` | Oracle tool for `smith_delegate` |
| Agents API router | `src/http/routers/agents.ts` | `GET /api/agents/metadata` — display metadata |
| Smiths API router | `src/http/routers/smiths.ts` | Smith management + config + ping |
| Link API router | `src/http/routers/link.ts` | Document upload, list, delete, reindex |
| MCP Tool Cache | `src/runtime/tools/cache.ts` | Singleton cache for MCP tools |
| MCP Factory | `src/runtime/tools/factory.ts` | `Construtor.create()` / `reload()` / `getStats()` |
| Provider factory | `src/runtime/providers/factory.ts` | `create()` / `createBare()` |
| HTTP API | `src/http/api.ts` | Express, mounted at `/api` |
| Config manager | `src/config/manager.ts` | Singleton, `getInstance().get()` |
| Config schemas | `src/config/schemas.ts` | Zod schemas |
| Paths constants | `src/config/paths.ts` | `PATHS.root`, `PATHS.config`, etc. |
| Frontend | `src/ui/src/` | React 19 + Vite |
| Chronos scheduler | `src/runtime/chronos/` | parser, worker, repository |
| Memory DB | `~/.morpheus/memory/short-memory.db` | sessions, messages, tasks, chronos, audit |
| Trinity DB | `~/.morpheus/memory/trinity.db` | DB registry (encrypted passwords) |
| Sati DB | `~/.morpheus/memory/sati-memory.db` | sqlite-vec embeddings |
| Link DB | `~/.morpheus/memory/link.db` | Document embeddings (sqlite-vec) |
| Documents dir | `~/.morpheus/docs/` | User uploaded documents |
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

## Spec-Driven Development
New features require a `specs/NNN-feature-name/` folder with:
- `spec.md` — functional requirements (source of truth)
- `plan.md` — technical implementation strategy
- `tasks.md` — implementation checklist
- `contracts/` — TypeScript interfaces defined before coding

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
