## 1. Database Schema

- [x] 1.1 Add `channel_sessions` table migration to `src/runtime/memory/sqlite.ts` with columns: channel (TEXT), user_id (TEXT), session_id (TEXT), updated_at (INTEGER), PRIMARY KEY (channel, user_id)
- [x] 1.2 Create `ChannelSessionRepository` class in `src/runtime/memory/channel-session.ts` with methods: save(channel, userId, sessionId), get(channel, userId), delete(channel, userId)

## 2. Discord Adapter

- [x] 2.1 Import `ChannelSessionRepository` in `src/channels/discord.ts`
- [x] 2.2 Add `loadPersistedSession(userId): Promise<string | null>` method to DiscordAdapter
- [x] 2.3 Add `persistSession(userId, sessionId): Promise<void>` method to DiscordAdapter
- [x] 2.4 Modify message handler to call `loadPersistedSession()` before processing
- [x] 2.5 Modify `/newsession`, `/session_switch`, session list buttons to call `persistSession()`

## 3. Telegram Adapter

- [ ] 3.1 Import `ChannelSessionRepository` in `src/channels/telegram.ts`
- [ ] 3.2 Identify existing user session tracking (userContext Map) in TelegramAdapter
- [ ] 3.3 Add `loadPersistedSession(userId): Promise<string | null>` method to TelegramAdapter
- [ ] 3.4 Add `persistSession(userId, sessionId): Promise<void>` method to TelegramAdapter
- [ ] 3.5 Modify message handler to call `loadPersistedSession()` before processing
- [ ] 3.6 Modify `/new_session` and session switch handlers to call `persistSession()`

## 4. Testing

- [ ] 4.1 Test Discord: restart Morpheus, verify session persists
- [ ] 4.2 Test Telegram: restart Morpheus, verify session persists
- [ ] 4.3 Test session switch persists across restart
- [ ] 4.4 Test deleted session graceful fallback

## 5. Edge Cases

- [x] 5.1 Handle migration for fresh database (table doesn't exist)
- [x] 5.2 Handle stale mapping to deleted session
- [x] 5.3 Handle concurrent session switches (upsert semantics)