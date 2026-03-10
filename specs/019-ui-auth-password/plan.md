# Implementation Plan: UI Authentication with Environment Variable

**Branch**: `019-ui-auth-password` | **Date**: 2026-02-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/019-ui-auth-password/spec.md`

## Summary

Implement a secure access layer for the Web UI and API. The system will read a `THE_ARCHITECT_PASS` environment variable (or config value). If set, this value serves as the "Master Password". An Express middleware will protect API routes, requiring a custom header `X-Architect-Pass`. The Frontend will be updated to handle 401 Unauthorized responses, redirect to a new Login page, and persist the password in LocalStorage.

## Technical Context

**Language/Version**: Node.js >= 18 (Backend), TypeScript (strict).
**Primary Dependencies**: 
- `express` (Backend Middleware)
- `react`, `react-router-dom` (Frontend Routing/UI)
- `zod` (Validation)
**Storage**: `localStorage` (Browser-side session), `process.env` / Config (Backend-side secret).
**Testing**: `vitest` (Backend), manual validation (Browser).
**Target Platform**: Node.js Server + Modern Web Browser.
**Project Type**: Single repo with Backend (`src/http`) and Frontend (`src/ui`).
**Performance Goals**: Negligible latency overhead (<1ms) for auth check middleware.
**Constraints**: Must fail closed (deny if pass set and header missing). Must be backward compatible (allow if pass not set).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Local-First & Privacy**: ✅ Password stored in LocalStorage, not cloud. Env var determines security. 
- **Extensibility by Design**: ✅ Uses standard HTTP headers and Env vars.
- **Orchestration & Context**: N/A
- **Developer Experience**: ✅ Simple setup (one env var). Clear UI feedback.
- **Reliability & Transparency**: ✅ Explicit 401 errors.

## Project Structure

### Documentation (this feature)

```text
specs/019-ui-auth-password/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── config/
│   ├── schemas.ts       # Update schema if we decide to allow config.yaml auth
│   └── manager.ts       # Ensure env var is loaded/exposed safely
├── http/
│   ├── middleware/
│   │   └── auth.ts      # [NEW] Auth middleware
│   └── server.ts        # Register middleware
└── ui/
    ├── src/
    │   ├── App.tsx          # Add Auth Guard / wrapper
    │   ├── pages/
    │   │   └── Login.tsx    # [NEW] Login Page
    │   ├── services/
    │   │   └── httpClient.ts # [NEW/REFACTOR] Centralized fetch wrapper with interceptors
    │   │   └── config.ts    # Update to use httpClient
    │   └── components/
    │       └── Layout.tsx   # Add Logout button?
```

**Structure Decision**: 
- **Backend**: Introduce a dedicated `auth.ts` middleware.
- **Frontend**: Refactor direct `fetch` calls to a singleton/utility `httpClient` (or `apiClient`) to inject headers and handle global 401 redirects. This avoids repeating auth logic in every service.

## Complexity Tracking

N/A - No violations.