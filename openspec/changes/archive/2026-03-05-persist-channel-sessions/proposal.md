## Why

When Morpheus restarts, Discord and Telegram adapters lose their in-memory session state (`currentSessionId` in Discord, `userContext` Map in Telegram). Users are forced to either start a new session or manually switch to their previous session each time the daemon restarts, breaking conversation continuity.

## What Changes

- Add a new `channel_sessions` table to persist per-user session associations across restarts
- Extend DiscordAdapter to load/persist session state in the database
- Extend TelegramAdapter to load/persist session state in the database
- Auto-restore the last active session for each user when they send a message after a restart

## Capabilities

### New Capabilities

- `channel-session-persistence`: Persists Discord/Telegram user session associations to SQLite so they survive daemon restarts and remain consistent per-user

### Modified Capabilities

- None. This is a new capability that doesn't change existing spec requirements.

## Impact

- **Code**: `src/channels/discord.ts`, `src/channels/telegram.ts`, `src/runtime/memory/sqlite.ts`
- **Database**: New `channel_sessions` table in `short-memory.db`
- **No new APIs**: Uses existing session management methods (create, switch, list)