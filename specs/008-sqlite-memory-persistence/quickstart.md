# Quickstart: Testing SQLite Persistence

## Prerequisites

- Morpheus installed and built.
- `better-sqlite3` installed.

## Manual Verification

1. **Start Morpheus**:
   ```bash
   npm start -- start
   ```

2. **Send a Message**:
   - Type: `Hello, my name is MorpheusTester.`
   - Wait for response.

3. **Verify Database Creation**:
   - Open a new terminal.
   - Check file existence:
     ```bash
     ls ~/.morpheus/memory/short-memory.db
     ```

4. **Verify Persistence**:
   - Stop the agent (`Ctrl+C`).
   - Restart: `npm start -- start`.
   - Ask: `What is my name?`.
   - Result: Agent should reply "Your name is MorpheusTester".

5. **Clear Memory**:
   - Currently requires deleting the file manually or implementing a clear command (out of scope for CLI command, but in scope for Agent API).
   - `rm ~/.morpheus/memory/short-memory.db`

## Automated Testing

Run the feature-specific tests:
```bash
npx vitest src/runtime/memory/__tests__/sqlite.test.ts
```
