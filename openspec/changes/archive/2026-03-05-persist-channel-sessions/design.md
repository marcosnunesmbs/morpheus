## Context

The Discord and Telegram adapters currently store per-user session state in memory:

- **DiscordAdapter**: `currentSessionId: string | null` — single session for the entire adapter
- **TelegramAdapter**: `userContext: Map<number, UserContext>` — per-user session tracking

When Morpheus restarts, these in-memory structures are cleared, forcing users to either:
1. Start a new session (losing conversation history)
2. Manually switch to their previous session via `/newsession` or `/session_switch`

The SQLite database already stores sessions in the `sessions` table and has methods like `getCurrentSessionOrCreate()`, `switchSession()`, `listSessions()`, etc.

## Goals / Non-Goals

**Goals:**
- Persist channel-to-session mappings in SQLite so they survive daemon restarts
- Auto-restore the last active session when a user sends a message after a restart
- Maintain backwards compatibility with existing session commands

**Non-Goals:**
- Cross-user session sharing (each Discord/Telegram user has their own session)
- Session persistence for other channels (API, UI) — they already work differently
- Changing the session storage format in the `sessions` table

## Decisions

### 1. New `channel_sessions` table

**Decision**: Create a dedicated table for channel-to-session mappings.

```sql
CREATE TABLE channel_sessions (
  channel TEXT NOT NULL,           -- 'telegram' | 'discord'
  user_id TEXT NOT NULL,           -- user identifier (chat_id for Telegram, user id for Discord)
  session_id TEXT NOT NULL,        -- reference to sessions.id
  updated_at INTEGER NOT NULL,     -- unix timestamp
  PRIMARY KEY (channel, user_id)
);
```

**Rationale**: Simple, single-row-per-user approach. The PRIMARY KEY ensures only one active session per user per channel.

**Alternative**: Add columns to `sessions` table — rejected because sessions are shared across channels.

### 2. Session restoration on message receipt

**Decision**: Load persisted session when processing an incoming message. If no persisted session exists, fall back to `getCurrentSessionOrCreate()`.

```typescript
// Discord example
const sessionId = await this.loadPersistedSession(userId)
  ?? await this.history.getCurrentSessionOrCreate();
```

**Rationale**: Minimal change to existing message handling flow.

### 3. Persist on session change

**Decision**: Call `persistSession()` whenever a session is created or switched via commands (`/newsession`, `/sessions`, `/session_switch`).

**Rationale**: Explicit persist points are easier to reason about than automatic persistence on every message.

### 4. Use existing session methods

**Decision**: Leverage existing `SQLiteChatMessageHistory` methods rather than adding new session management in the adapters.

- `getCurrentSessionOrCreate()` → get or create default session
- `switchSession(sessionId)` → switch current session
- `createNewSession()` → create new session

**Rationale**: Reuses existing well-tested code.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration needed for existing users | New table creation | SQLite handles CREATE TABLE gracefully (no data loss) |
| Session deleted but mapping remains | Stale reference in `channel_sessions` | Validate session exists on load, create new if not |
| Multiple Discord DMs from same user | Each DM uses same session | Acceptable — Discord DM is 1:1 per user |
| Concurrent session switches | Race condition on write | SQLite PRIMARY KEY handles upsert semantics |

## Migration Plan

1. **Deploy code** with new table creation in migration
2. **Existing behavior preserved** — no persisted sessions yet
3. **First session interaction** creates the mapping automatically
4. **After restart** — users automatically continue their session

No rollback needed since the table is additive and existing code continues working.