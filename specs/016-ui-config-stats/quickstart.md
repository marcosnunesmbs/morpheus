# Quickstart: Testing UI Config & Stats

## Prerequisites
- Feature branch `016-ui-config-stats` is checked out.
- Dependencies installed: `npm install`.
- Project built: `npm run build`.

## Steps

1.  **Start Morpheus**:
    ```bash
    npm start -- start
    ```

2.  **Open Dashboard**:
    - Navigate to `http://localhost:3000` (or configured port).
    - **Verify**: You should see "Total Input Tokens" and "Total Output Tokens" widgets at the top of the dashboard.

3.  **Test Usage Stats**:
    - Send a message to the agent.
    - Refresh the dashboard.
    - **Verify**: The token counts increment.

4.  **Configure Audio**:
    - Go to **Settings** > **Audio** (New Tab).
    - **Verify**: You can see fields for Provider (Google), API Key, Enabled.
    - Change a setting and click **Save**.
    - Reload page to confirm persistence.

5.  **Configure Memory Limit**:
    - Go to **Settings** > **LLM**.
    - **Verify**: New field "Max Tokens" (or Memory Limit) is available.
    - Set a value (e.g., `1024`) and **Save**.
    - Reload page to confirm persistence.
