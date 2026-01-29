# Implementation Plan - Web UI Dashboard

**Feature**: Web UI Dashboard (009-web-ui-dashboard)
**Status**: Planned

## Technical Context

The goal is to provide a local web interface for Morpheus.
- **Stack**: React, Tailwind CSS, Vite.
- **Backend**: Existing Node.js CLI/Daemon.
- **Integration**: The daemon will spin up a lightweight Express server to serve the static UI assets and provides a JSON API.
- **Theme**: Matrix-inspired (#13402B, #1D733B, etc.) + Dark Mode.

### Architecture
- **Frontend**: Single Page Application (SPA) located in `ui/`.
- **Backend**: New module `src/runtime/server.ts` using `express`.
- **Communication**: REST API over HTTP (localhost).

## Constitution Check

- **Local-First & Privacy**: ✅ The UI is served locally and consumes a local API. No external calls.
- **Extensibility**: ✅ API structure allows adding more endpoints later.
- **Orchestration**: N/A (UI is for observation/config).
- **Developer Experience**: ✅ Dashboard provides easier config management than editing YAML.
- **Reliability**: ✅ Visualization of logs improves observability.

## Gates & Phase 0: Research

- [ ] **Research: Serving Vite from Node**: Confirm best practices for serving a Vite SPA from an Express backend in production vs development.
- [ ] **Research: Log Streaming**: Determine efficient way to read/stream log files from the `logs` directory to the UI.
- [ ] **Research: Tailwind Matrix Config**: define the `tailwind.config.js` theme extension for the requested colors.

## Phase 1: Design & Contracts

- [ ] **Data Model**: Define interfaces for `Config`, `LogEntry`, `SystemInfo`.
- [ ] **API Contract**: Define the REST endpoints (OpenAPI format or Markdown table).
- [ ] **Quickstart**: Update guides on how to run the UI (dev mode vs prod).

## Phase 2: Implementation

### 2.1 Backend Setup (CLI Side)
- [ ] **Dependencies**: Install `express`, `cors`, `body-parser`, `open` in root `package.json`.
  ```bash
  npm install express cors body-parser open
  npm install -D @types/express @types/cors
  ```
- [ ] **Config Verification**:
  - Verify `src/types/config.ts` and `src/config/manager.ts` (Already includes `ui` config).
- [ ] **Server Module**:
  - Create `src/http/routes.ts` defining endpoints for `/api/status`, `/api/config`, `/api/logs`.
  - Create `src/http/server.ts` to setup Express app, middleware, and static serving.
- [ ] **Daemon Integration**:
  - Modify `src/cli/commands/start.ts` to initialize `HttpServer` when the daemon starts.

### 2.2 Frontend Setup (Nested Project)
- [ ] **Scaffold**: Create `src/ui` folder.
- [ ] **Init**: Run `npm create vite@latest ui -- --template react-ts` inside `src/`.
  - *Correction*: Automated tools might prefer manual file creation. We will create the `src/ui` structure manually or use `create_new_workspace` tool if available (not available/appropriate here). We will `create_file` the necessary Vite files.
- [ ] **Dependencies**: Define `src/ui/package.json` with `react`, `react-dom`, `vite`, `tailwindcss`, `lucide-react`, `swr`.
- [ ] **Tailwind**: Create `src/ui/tailwind.config.js` and `src/ui/postcss.config.js` with Matrix theme colors.

### 2.3 Frontend Development
- [ ] **API Client**: Create `src/ui/src/lib/api.ts` (fetch wrapper).
- [ ] **Components**:
  - `Layout.tsx`: Sidebar/Header with Matrix theme.
  - `Dashboard.tsx`: Display status.
  - `ConfigEditor.tsx`: Simple JSON/Form editor for config.
  - `LogViewer.tsx`: Polling log display.
- [ ] **Entry**: `App.tsx` with routing (if needed, or single view).

### 2.4 Build & Glue
- [ ] **Build Script**: Update root `package.json` scripts:
  ```json
  "build:ui": "cd src/ui && npm install && npm run build",
  "build": "tsc && npm run build:ui"
  ```
- [ ] **Serving**: Configure `src/http/server.ts` to statically serve files from `path.join(__dirname, '../ui')` (assuming `dist/http` and `dist/ui` are siblings in production). Handle dev mode paths if necessary.
  - Update `src/ui/vite.config.ts` to output to `../../dist/ui`.

## Verification Plan

### Automated Tests
- [ ] **Backend Tests**: `vitest` tests for `src/http/routes.ts` (mocking the express request/response).
- [ ] **Schema Tests**: Verify `server` config validation in `src/config/__tests__`.

### Manual Verification
1. Run `npm run build`.
2. Run `morpheus start`.
3. Open `http://localhost:3000`.
4. Verify Matrix theme.
5. Change a config setting -> Save -> Check `config.yaml`.
6. View Log -> Check terminal output matches UI.
