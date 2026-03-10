# Quickstart: Testing UI Authentication

## Prerequisites
- Node.js running (or `npm start`).
- `.env` file or environment variables set.

## Step 1: Enable Authentication

Stop the server and set the environment variable:

**Windows PowerShell:**
```powershell
$env:THE_ARCHITECT_PASS = "MatrixKey123"
npm start -- start
```

**Bash / Linux:**
```bash
export THE_ARCHITECT_PASS="MatrixKey123"
npm start -- start
```

## Step 2: Verify Access Denied

1. Open Browser to `http://localhost:3333`.
2. It should redirect to `/login`.
3. Try running a curl command:
   ```bash
   curl -v http://localhost:3333/api/status
   ```
   **Expected**: `401 Unauthorized`

## Step 3: Verify Access Granted

1. In the Browser, enter `MatrixKey123` and login.
2. Dashboard should load.
3. Reload the page -> Should stay logged in.
4. Try curl with header:
   ```bash
   curl -H "X-Architect-Pass: MatrixKey123" http://localhost:3333/api/status
   ```
   **Expected**: `200 OK` (assuming status endpoint exists, or try `/api/config`)

## Step 4: Disable Authentication

1. Stop server.
2. Unset the variable or restart terminal.
3. `npm start -- start`
4. Browser should load Dashboard directly without login.