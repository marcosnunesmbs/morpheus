# Quickstart: Testing Message Persistence

## Prerequisites
- SQLite database initialized (happens on first run).
- Valid Google Gemini API Key for Audio tests.

## Steps to Verify

### 1. Tool Usage Persistence
1. Start the agent: `npm start -- start`
2. Connect via Telegram or Web UI.
3. Send a message that triggers a tool, e.g., "Check the price of Bitcoin".
4. After response, inspect the database:
   ```bash
   sqlite3 ~/.morpheus/memory/short-memory.db "SELECT type, content, total_tokens FROM messages ORDER BY id DESC LIMIT 5;"
   ```
5. **Verify**: You should see:
   - `human`: "Check the price of Bitcoin"
   - `ai`: (Tool Call arguments)
   - `tool`: (Tool Output/Price)
   - `ai`: "The price is..."
   - `total_tokens`: Should be non-null.

### 2. Audio Usage
1. Send a voice message to the Telegram bot.
2. Inspect the database for the user message created from transcription.
   ```bash
   sqlite3 ~/.morpheus/memory/short-memory.db "SELECT type, input_tokens FROM messages WHERE type='human' ORDER BY id DESC LIMIT 1;"
   ```
3. **Verify**: `input_tokens` should include the audio processing cost (non-zero).
