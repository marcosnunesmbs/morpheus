# Quickstart: Chat Memory Config

## Prerequisites
- Feature `017-chat-memory-config` checked out.
- Project built: `npm run build`.

## Steps

1.  **Start Morpheus**:
    ```bash
    npm start -- start
    ```

2.  **Navigate to Settings**:
    - Open `http://localhost:3000` (or `3333`).
    - Click "Settings".
    - Go to "LLM" tab.

3.  **Configure Memory Limit**:
    - Notice new field: "Message History Limit" (not "Generic Token Limit").
    - Enter a value (e.g. `50`).
    - Click "Save".

4.  **Verify**:
    - Refresh page. Value persists.
    - Check `~/.morpheus/config.yaml`. `memory.limit` should be `50`.
