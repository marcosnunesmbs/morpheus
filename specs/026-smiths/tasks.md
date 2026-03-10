# Smith Agent — Implementation Tasks

## Phase 1: Morpheus-side infrastructure

### 1.1 Config & Types
- [ ] Create `SmithEntrySchema` in `src/config/schemas.ts`
- [ ] Create `SmithsConfigSchema` in `src/config/schemas.ts`
- [ ] Add `SmithEntry`, `SmithsConfig` to `src/types/config.ts`
- [ ] Add `smiths` to `DEFAULT_CONFIG`
- [ ] Add `MORPHEUS_SMITHS_ENABLED` env override in `src/config/manager.ts`
- [ ] Add `smiths` to `zaion.yaml` scaffold template

### 1.2 Protocol Types
- [ ] Create `src/runtime/smiths/types.ts` with wire protocol interfaces
- [ ] Create `src/runtime/smiths/protocol.ts` with message serialization/validation

### 1.3 SmithRegistry
- [ ] Create `src/runtime/smiths/registry.ts` (singleton)
- [ ] Implement `register()`, `unregister()`, `get()`, `list()`, `getOnline()`
- [ ] Add event emitter for `smith:connected`, `smith:disconnected`
- [ ] Write tests: `src/runtime/smiths/__tests__/registry.test.ts`

### 1.4 SmithConnection
- [ ] Create `src/runtime/smiths/connection.ts`
- [ ] Implement WebSocket client with reconnection logic
- [ ] Implement auth handshake flow
- [ ] Implement ping/pong heartbeat
- [ ] Write tests: `src/runtime/smiths/__tests__/connection.test.ts`

### 1.5 SmithDelegator
- [ ] Create `src/runtime/smiths/delegator.ts`
- [ ] Implement `delegate(smithName, task)` method
- [ ] Implement remote tool call routing over WebSocket
- [ ] Handle timeout and error cases
- [ ] Write tests: `src/runtime/smiths/__tests__/delegator.test.ts`

### 1.6 Oracle Integration
- [ ] Create `smith_delegate` tool in `src/runtime/oracle.ts`
- [ ] Add Smith list to Oracle system prompt (dynamic injection)
- [ ] Support `sync` / `async` execution modes
- [ ] Wire into task queue for async mode

### 1.7 HTTP API
- [ ] Create `src/http/routers/smiths.ts`
- [ ] `GET /api/smiths` — list all with status
- [ ] `GET /api/smiths/:name` — detail + stats
- [ ] `POST /api/smiths/register` — self-registration endpoint
- [ ] `POST /api/smiths/:name/ping` — manual ping
- [ ] `DELETE /api/smiths/:name` — remove
- [ ] Mount router in `src/http/api.ts`
- [ ] Write tests: `src/http/__tests__/smiths.test.ts`

### 1.8 CLI Commands
- [ ] Add `morpheus smiths` command to list Smiths
- [ ] Add `morpheus smiths ping <name>` to test connectivity
- [ ] Add `morpheus smiths remove <name>` to unregister

### 1.9 UI — Settings → Smiths Tab
- [ ] Add Smiths tab to Settings page
- [ ] Smith list with status badges (🟢/🔴)
- [ ] Add Smith form (name, host, port, auth_token)
- [ ] Edit/Delete Smith entries
- [ ] Smith detail modal (OS, CPU, memory, capabilities)
- [ ] Test connection button
- [ ] Follow dark mode design system

---

## Phase 2: Smith binary

### 2.1 Core
- [ ] Create `src/smith/index.ts` entry point
- [ ] Create `src/smith/cli.ts` (commander: start, stop, status)
- [ ] Add `bin/smith.js` shim
- [ ] Add `"smith"` bin entry to `package.json`
- [ ] Create `src/smith/config.ts` (local config: `~/.smith/config.yaml`)

### 2.2 Server & Auth
- [ ] Create `src/smith/server.ts` — WebSocket server
- [ ] Create `src/smith/auth.ts` — token validation
- [ ] Implement connection acceptance + auth handshake

### 2.3 Executor
- [ ] Create `src/smith/executor.ts`
- [ ] Wire DevKit tools (reuse from `src/devkit/`)
- [ ] Map incoming tool payloads → DevKit function calls
- [ ] Stream results back via WebSocket
- [ ] Enforce local sandbox/security config

### 2.4 Heartbeat
- [ ] Create `src/smith/heartbeat.ts`
- [ ] Send system stats every 30s (CPU, memory, OS, uptime)
- [ ] Report capabilities list

### 2.5 Lifecycle
- [ ] PID file management (`~/.smith/smith.pid`)
- [ ] Graceful shutdown (notify Morpheus, close WS)
- [ ] Scaffold `~/.smith/` directory on first run

### 2.6 Testing
- [ ] Unit tests for executor
- [ ] Unit tests for auth
- [ ] Integration test: Morpheus ↔ Smith round-trip
- [ ] E2E: `smith start` → `morpheus smiths ping` → `smith stop`

---

## Phase 3: Polish

- [ ] Connection status in Oracle's verbose mode
- [ ] `smith_delegate` error messages with troubleshooting hints
- [ ] Documentation in README.md
- [ ] Smith protocol version negotiation
- [ ] Rate limiting on Smith executor
