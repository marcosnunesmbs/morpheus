# Tasks: Web UI Dashboard

**Feature**: Web UI Dashboard (009-web-ui-dashboard)
**Status**: Planned
**Total Tasks**: 21

## Phase 1: Setup & Infrastructure
*Goal: Initialize backend dependencies and scaffold the frontend project structure.*

- [x] T001 Install backend dependencies (`express`, `cors`, `body-parser`, `open`) in root `package.json`
- [x] T002 Scaffold `src/ui` directory structure and create `src/ui/package.json` with React/Vite dependencies
- [x] T003 Create `src/ui/vite.config.ts` configured to build to `../../dist/ui`
- [x] T004 Create `src/ui/tsconfig.json` and `src/ui/index.html`
- [x] T005 Create `src/ui/src/main.tsx`, `src/ui/src/App.tsx`, and `src/ui/src/index.css` (Tailwind directives)
- [x] T006 Install frontend dependencies `cd src/ui && npm install`
- [x] T007 Configure `src/ui/tailwind.config.js` with Matrix theme colors (#13402B, etc.) and Dark Mode support

## Phase 2: Foundational (Backend Core)
*Goal: Establish the Express server and integrate it with the CLI daemon.*

- [x] T008 [P] Create `src/http/api.ts` defining the API route handlers (Status, Config, Logs placeholders)
- [x] T009 Create `src/http/server.ts` to setup Express, Middleware, Static Serving, and API routes.
- [x] T010 Modify `src/cli/commands/start.ts` to initialize and start `HttpServer` when daemon starts, ensuring it reads `ui.port` from the loaded configuration (default 3333).

## Phase 3: User Story 1 - Dashboard Access & System Status (P1)
*Goal: User can access the API status and view the main dashboard with footer info.*

- [x] T011 [US1] Implement `GET /api/status` in `src/http/api.ts` returning version, uptime, and agent info
- [x] T012 [P] [US1] Create `src/ui/src/lib/api.ts` client wrapper for fetching status
- [x] T013 [US1] Create `src/ui/src/components/Layout.tsx` with Sidebar and Matrix-themed container
- [x] T014 [US1] Create `src/ui/src/components/Footer.tsx` displaying system status from API
- [x] T015 [US1] Create `src/ui/src/pages/Dashboard.tsx` displaying service health cards

## Phase 4: User Story 2 - Configuration Management (P1)
*Goal: User can view and edit configuration via UI.*

- [x] T016 [US2] Implement `GET /api/config` and `PUT /api/config` in `src/http/api.ts` using `ConfigManager`
- [x] T017 [US2] Create `src/ui/src/pages/Config.tsx` with a form/JSON editor to modify settings

## Phase 5: User Story 3 - Log Viewer (P2)
*Goal: User can view system logs.*

- [x] T018 [US3] Implement `GET /api/logs` (list) and `GET /api/logs/:file` (content) in `src/http/api.ts`.
  - Ensure `GET /api/logs/:file` accepts a `limit` query param (default 50) to return only the last N lines.
- [x] T019 [US3] Create `src/ui/src/pages/Logs.tsx` with file selection and content viewer

## Phase 6: User Story 4 - Theme Customization (P3)
*Goal: User can toggle dark mode.*

- [x] T020 [US4] Implement Theme Toggle in `src/ui/src/components/Layout.tsx` (switching `dark` class on html)

## Phase 7: Polish & Integration
*Goal: Ensure full build pipeline works.*

- [x] T021 Update root `package.json` scripts to include `build:ui` and update `build` task

## Dependencies
- US1 (Dashboard) blocks US2, US3, US4 (requires Layout and API client Base).
- Setup & Foundational phases block all User Stories.

## Parallel Execution Examples
- **Setup**: One developer can set up Backend Deps (T001) while another scaffolds Frontend (T002-T005).
- **US1**: Backend `/api/status` (T011) and Frontend Layout (T013) can be built in parallel once contracts are agreed.
