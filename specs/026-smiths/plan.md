# Smith Agent — Technical Plan

## Phase 1: Morpheus-side infrastructure (no separate binary yet)

### 1.1 Config & Types
- Add `SmithEntrySchema` and `SmithsSchema` to `src/config/schemas.ts`
- Add `SmithEntry` and `SmithsConfig` types to `src/types/config.ts`
- Add `smiths` section to `DEFAULT_CONFIG`
- Handle env vars: `MORPHEUS_SMITHS_ENABLED`

```yaml
# zaion.yaml
smiths:
  enabled: true
  entries:
    - name: alpha
      host: 192.168.1.100
      port: 7900
      auth_token: "secret-token-alpha"
    - name: beta
      host: 192.168.1.101
      port: 7900
      auth_token: "secret-token-beta"
```

### 1.2 SmithRegistry (`src/runtime/smiths/registry.ts`)
- Singleton pattern (like ChannelRegistry)
- `register(smith)`, `unregister(name)`, `get(name)`, `list()`, `getOnline()`
- Tracks connection state per Smith: `online | offline | error`
- Emits events: `smith:connected`, `smith:disconnected`, `smith:error`

### 1.3 SmithConnection (`src/runtime/smiths/connection.ts`)
- WebSocket client wrapper per Smith
- Handles: connect, reconnect (exponential backoff), auth handshake, ping/pong
- Exposes: `send(message)`, `onMessage(handler)`, `disconnect()`
- Reconnect strategy: 1s → 2s → 4s → 8s → 16s → 30s (cap)

### 1.4 SmithDelegator (`src/runtime/smiths/delegator.ts`)
- `delegate(smithName: string, task: string): Promise<string>`
- Creates a sub-LLM agent (like Apoc) that translates the natural-language task into DevKit tool calls
- Sends tool calls over WebSocket to the target Smith
- Collects results and returns consolidated response

### 1.5 Oracle integration (`src/runtime/oracle.ts`)
- New tool: `smith_delegate` with schema `{ smith: string, task: string }`
- Supports `execution_mode: sync | async` (configured globally for all Smiths)
- System prompt includes list of available Smiths and their capabilities

### 1.6 HTTP API (`src/http/routers/smiths.ts`)
- `GET /api/smiths` — list all Smiths with status
- `GET /api/smiths/:name` — Smith detail + stats
- `POST /api/smiths/:name/ping` — manual ping
- `POST /api/smiths/register` — self-registration endpoint (Smith calls this)
- `DELETE /api/smiths/:name` — remove Smith

### 1.7 UI — Settings → Smiths tab
- List of configured Smiths with status badge (🟢 online / 🔴 offline)
- Add/Edit/Remove Smith entries
- Per-Smith detail: OS, CPU, memory, uptime, capabilities
- Test connection button

---

## Phase 2: Smith binary (standalone process)

### 2.1 Project structure
Smith lives inside morpheus repo as `src/smith/` (monorepo approach) — simpler to share types, DevKit code, and build pipeline.

```
src/smith/
  ├─ index.ts              # Entry point
  ├─ cli.ts                # Commander: start, stop, status
  ├─ config.ts             # Smith-local config (~/.smith/config.yaml)
  ├─ server.ts             # WebSocket server (accepts Morpheus connections)
  ├─ executor.ts           # Receives tool payloads, runs DevKit tools
  ├─ heartbeat.ts          # Sends periodic stats to Morpheus
  ├─ auth.ts               # Token validation
  └─ types.ts              # Shared protocol types
```

### 2.2 Smith DevKit subset
Reuse existing DevKit tools from `src/devkit/tools/`:
- `filesystem.ts` ✅
- `shell.ts` ✅
- `git.ts` ✅
- `system.ts` ✅
- `processes.ts` ✅
- `packages.ts` ✅
- `network.ts` ✅
- `browser.ts` ❌ (too heavy for remote agents v1)

### 2.3 Smith lifecycle
```
smith start → load config → start WS server → announce to Morpheus → heartbeat loop
smith stop  → notify Morpheus → close WS → exit
smith status → check PID file, show connection state
```

### 2.4 Communication flow
```
1. Smith starts → connects to Morpheus WS endpoint (or Morpheus connects to Smith)
2. Smith sends { type: 'register', name, auth_token, capabilities }
3. Morpheus validates → SmithRegistry marks online
4. Oracle receives user request → calls smith_delegate(name, task)
5. SmithDelegator creates agent → plans tool calls → sends to Smith via WS
6. Smith executor runs tools locally → streams results back
7. SmithDelegator consolidates → returns to Oracle
```

### Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Connection direction | Smith → Morpheus | Simpler NAT traversal; Smith initiates |
| Protocol | WebSocket (JSON) | Bidirectional, real-time, well-supported |
| Auth | Shared secret (v1), mTLS (v2) | Simple to start, upgrade path clear |
| Agent on Smith? | No — Smith is a tool executor | LLM runs on Morpheus only; Smith just runs DevKit |
| Monorepo vs separate | Monorepo (`src/smith/`) | Share types + DevKit code |
| Binary name | `smith` (via bin in package.json) | `npx smith start` or `npm run smith -- start` |

### Dependencies (new)
- `ws` — WebSocket server/client
- No new LLM dependencies on Smith side (executor only)

### Risk Mitigation
- **Network failures**: Exponential backoff reconnect + task timeout
- **Security**: Auth token required, Smith sandbox enforced locally
- **Resource exhaustion**: Smith reports system stats; Morpheus can skip busy Smiths
- **Version mismatch**: Protocol version in register handshake; reject incompatible
