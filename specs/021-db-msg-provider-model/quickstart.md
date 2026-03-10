# Quickstart: Database Message Persistence

**Feature**: `021-db-msg-provider-model`

## Usage

This feature is **automatic** and requires no user configuration.

### For Developers

1. **Verify**:
   Start Morpheus:
   ```bash
   npm start -- start
   ```
   
2. **Inspect Database**:
   Open `~/.morpheus/memory/short-memory.db` with an SQLite viewer.
   Verify `messages` table has `provider` and `model` columns.

3. **Test Persistence**:
   Send a chat message via CLI or UI.
   Query the database:
   ```sql
   SELECT content, provider, model FROM messages ORDER BY id DESC LIMIT 2;
   ```
   Expect valid values (e.g., `openai`, `gpt-4o`).

## Troubleshooting

- **Column Missing**: If columns don't appear, check logs for `[SQLite] Migration check failed`.
- **NULL Values**: Messages created before this update will permanently have NULL values. This is expected.
