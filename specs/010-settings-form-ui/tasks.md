# Tasks: Settings Form UI

**Feature Branch**: `010-settings-form-ui`
**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)

## Phase 1: Setup
Initialization and shared dependencies.

- [ ] T001 Install `zod` (match root version ^4.3.6) in `src/ui/package.json` for frontend validation
- [ ] T002 Create `src/config/schemas.ts` and export `ConfigSchema` (move from Manager)

## Phase 2: Foundational (Backend)
Backend API for configuration management.

- [ ] T003 Refactor `src/config/manager.ts` to use `ConfigSchema` from `src/config/schemas.ts`
- [ ] T004 Implement `POST /api/config` in `src/http/api.ts` with Zod validation, error handling, and detailed diff logging (X changed to Y) via `DisplayManager`
- [ ] T005 [P] Create `src/http/__tests__/config_api.test.ts` to verify config endpoints

## Phase 3: User Story 1 - View Current Settings
As a Developer/Admin, I want to view my current Morpheus configuration in a structured form.

- [ ] T006 [US1] Create API client `src/ui/src/services/config.ts` (fetchConfig method)
- [ ] T007 [P] [US1] Create `src/ui/src/components/forms/TextInput.tsx`
- [ ] T008 [P] [US1] Create `src/ui/src/components/forms/SelectInput.tsx`
- [ ] T009 [P] [US1] Create `src/ui/src/components/forms/NumberInput.tsx`
- [ ] T010 [P] [US1] Create `src/ui/src/components/forms/Switch.tsx`
- [ ] T011 [P] [US1] Create `src/ui/src/components/forms/Section.tsx` (collapsible/card layout)
- [ ] T012 [US1] Create `src/ui/src/pages/Settings.tsx` and implement layout with tabs/sections
- [ ] T013 [US1] Integrate `SWR` in `Settings.tsx` to load initial data

## Phase 4: User Story 2 - Update and Save Settings
As a Developer/Admin, I want to modify settings via form inputs and save them.

- [ ] T014 [US2] Update `src/ui/src/services/config.ts` with `updateConfig` method (POST)
- [ ] T015 [US2] Add state management (local state) to `Settings.tsx` to track form changes
- [ ] T016 [US2] Implement "Save" button with dirty state logic (enable only on change)
- [ ] T017 [US2] Add toast notification for success/error in `Settings.tsx` (using simple alert or sonner if avail)

## Phase 5: User Story 3 - Input Validation
As a Developer, I want the form to validate my inputs before saving.

- [ ] T018 [US3] Integrate `zod` schema in `Settings.tsx` for client-side validation on change
- [ ] T019 [US3] Display validation errors in `TextInput`, `NumberInput`, etc.

## Phase 6: Polish
Final cleanups and improvements.

- [ ] T020 Mask API Key inputs in `Settings.tsx` (show/hide toggle)
- [ ] T021 Ensure proper error mapping from Backend 400 responses to Form fields

## Task Dependencies
- T002 -> T003, T018 (Schema shared)
- T006 -> T013 (Client needed for SWR)
- T007, T008, T009, T010 -> T012 (Components needed for Page)
- T012 -> T015 (Page structure needed for logic)

## Parallel Execution Opportunities
- UI Components (T007-T011) can be built in parallel.
- Backend Refactor (T003) and API (T004) can be done while UI components are built.

## Implementation Strategy
1. **MVP**: Setup Schema -> Backend API -> View Settings (US1).
2. **Interactive**: Update/Save (US2).
3. **Robustness**: Validation (US3) & Polish.
