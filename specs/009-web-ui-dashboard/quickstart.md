# Quickstart: Web UI Dashboard

## Prerequisites
- Node.js >= 18
- `npm install` to get new dependencies (Express, etc.)

## Running the UI

The UI is embedded within the `morpheus start` command.

1. **Start the Agent**:
   ```bash
   npm start -- start
   # OR installed globally
   morpheus start
   ```

2. **Access the Dashboard**:
   - Open your browser to `http://localhost:3000` (default port).
   - The port can be configured in `.morpheus/config.yaml` under `server.port`.

## Development

If you want to work on the Frontend functionality with hot-reloading:

1. **Start the Backend** (for API):
   ```bash
   npm start -- start
   ```

2. **Start the Frontend** (in a separate terminal):
   ```bash
   cd src/ui
   npm install
   npm run dev
   ```
   - Access at `http://localhost:5173`.
   - The Vite dev server proxies `/api` requests to `localhost:3000`.

## Building

To build the full application including the UI:

```bash
npm run build
```
This will compile TypeScript and build the Vite app to `dist/ui`.
