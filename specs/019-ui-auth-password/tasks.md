# Implementation Tasks: UI Authentication with Environment Variable

**Branch**: `019-ui-auth-password` | **Framework**: Node.js/Express + React | **Date**: 2026-02-01

## Phase 1: Setup & Contracts
*Goal: Initialize feature structure and define shared constants.*
*Independent Test*: N/A - scaffolding only.

- [x] T001 [P] Create `contracts/api-verify.ts` to define shared AUTH_HEADER and error interfaces in `specs/019-ui-auth-password/contracts/`
- [x] T002 Update `src/types/config.ts` if needed (likely not needed as per plan, mainly runtime env)

## Phase 2: Foundational (Backend Auth)
*Goal: Secure the API so it rejects unauthorized requests.*
*Independent Test*: `curl` to `/api/config` returns 401 when `THE_ARCHITECT_PASS` is set.

- [x] T003 [US2] Create new `src/http/middleware/auth.ts` to implement authentication logic using `process.env.THE_ARCHITECT_PASS`
- [x] T004 [US2] Update `src/http/server.ts` to register `authMiddleware` before API routes
- [x] T005 [P] [US2] Create unit test `src/http/__tests__/auth.test.ts` using `supertest` to verify 401/200 scenarios

## Phase 3: Frontend Infrastructure
*Goal: Enable Frontend to speak the new auth protocol.*
*Independent Test*: Frontend can successfully fetch data when hardcoded token is present, handles 401s gracefully.

- [x] T006 [US2] Create `src/ui/src/services/httpClient.ts` as a wrapper around fetch with interceptors
- [x] T007 [P] [US2] Refactor `src/ui/src/services/config.ts` to use `httpClient`
- [x] T008 [P] [US2] Refactor `src/ui/src/services/stats.ts` to use `httpClient`
- [x] T009 [P] [US2] Refactor any other services to use `httpClient`

## Phase 4: User Story 1 (Secure Access UI)
*Goal: Provide visual login mechanism for the Administrator.*
*Independent Test*: User is redirected to Login page when unauthenticated.

- [x] T010 [US1] Create `src/ui/src/pages/Login.tsx` with password input and submit handler
- [x] T011 [US1] Update `src/ui/src/App.tsx` config to add `/login` route
- [x] T012 [US1] Create `Authenticator` component or hook in `src/ui/src/hooks/useAuth.ts` to manage state
- [x] T013 [US1] Implement "Auth Guard" in `src/ui/src/components/AuthGuard.tsx` to wrap protected routes

## Phase 5: User Story 3 (Persistence)
*Goal: Remember the user across sessions.*
*Independent Test*: Refreshing the page stays logged in.

- [x] T014 [US3] Update `httpClient.ts` to read token from `localStorage` before every request
- [x] T015 [US3] Update `httpClient.ts` to clear `localStorage` and redirect to `/login` on 401 response
- [x] T016 [US3] Update `Login.tsx` to save token to `localStorage` on success

## Phase 6: Polish
*Goal: UX refinements and cleanup.*

- [x] T017 Add "Logout" button to `src/ui/src/components/Layout.tsx`
- [x] T018 Add visual error message to Login page for invalid credentials
- [x] T019 Update `README.md` to document `THE_ARCHITECT_PASS` usage

## Dependencies

- **[US2] Backend Auth** must be done first to "break" the UI and prove security.
- **[US1] UI Login** depends on [US2] being active to be meaningful.
- **[US3] Persistence** enhances [US1].