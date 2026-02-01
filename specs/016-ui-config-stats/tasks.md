# Tasks: Advanced UI Configuration and Statistics

**Feature Branch**: `016-ui-config-stats`
**Generated**: 2026-02-01
**Spec**: [spec.md](spec.md)

## Phase 1: Setup

- [x] T001 Initialize feature structure (Done via script)

## Phase 2: Foundational
*Goal: Ensure backend schemas, types, and API endpoints exist to support the UI changes.*

- [x] T002 [P] Update `ConfigSchema` to include `llm.max_tokens` and `audio.provider` in [src/config/schemas.ts](src/config/schemas.ts)
- [x] T003 [P] Update `LLMConfig` and `AudioConfig` interfaces to match schema in [src/types/config.ts](src/types/config.ts)
- [x] T004 Implement `getUsageStats()` aggregation method in [src/runtime/memory/sqlite.ts](src/runtime/memory/sqlite.ts)
- [x] T005 Create `GET /api/stats/usage` endpoint in [src/http/api.ts](src/http/api.ts)

## Phase 3: User Story 1 - Configure LLM Memory Limit
*Goal: Allow user to configure context window size.*

- [x] T006 [US1] Add "Memory Limit" (max_tokens) input field to LLM Config section in [src/ui/src/pages/Settings.tsx](src/ui/src/pages/Settings.tsx)
- [x] T007 [US1] Validate persistence of memory limit setting in [src/ui/src/pages/Settings.tsx](src/ui/src/pages/Settings.tsx)

## Phase 4: User Story 2 - Configure Audio Settings
*Goal: Provide dedicated configuration for Audio.*

- [x] T008 [US2] Update `TABS` constant to include 'audio' tab in [src/ui/src/pages/Settings.tsx](src/ui/src/pages/Settings.tsx)
- [x] T009 [US2] Implement Audio settings form section with Provider selector (Google) in [src/ui/src/pages/Settings.tsx](src/ui/src/pages/Settings.tsx)
- [x] T010 [US2] Move existing audio fields (enabled, apiKey, etc.) to new Audio section in [src/ui/src/pages/Settings.tsx](src/ui/src/pages/Settings.tsx)

## Phase 5: User Story 3 - View Usage Statistics
*Goal: Display aggregated token usage on Dashboard.*

- [x] T011 [P] [US3] Create `StatsService` for fetching API data in [src/ui/src/services/stats.ts](src/ui/src/services/stats.ts)
- [x] T012 [P] [US3] Create `UsageStatsWidget` component in [src/ui/src/components/dashboard/UsageStatsWidget.tsx](src/ui/src/components/dashboard/UsageStatsWidget.tsx)
- [x] T013 [US3] Integrate `UsageStatsWidget` into main view in [src/ui/src/pages/Dashboard.tsx](src/ui/src/pages/Dashboard.tsx)

## Phase 6: Polish
*Goal: Final verification and error handling.*

- [x] T014 Verify UI validation for negative numbers in memory limit input in [src/ui/src/pages/Settings.tsx](src/ui/src/pages/Settings.tsx)
- [x] T015 Ensure UsageStatsWidget handles loading and error states gracefully in [src/ui/src/components/dashboard/UsageStatsWidget.tsx](src/ui/src/components/dashboard/UsageStatsWidget.tsx)

## Dependencies

- **US3** depends on **T005** (API endpoint).
- **US1 & US2** depend on **T002 & T003** (Schema/Types).

## Parallel Execution Opportunities

- T002 (Schema) and T003 (Types) can be done in parallel.
- T011 (Service) and T012 (Component) can be done in parallel.
- Phase 3 (LLM Config) and Phase 4 (Audio Config) are independent of each other (mostly, sharing same file).

## Implementation Strategy

1.  **Backend First**: Update types, schemas, and API to providing the plumbing.
2.  **UI Config**: Update the Settings page to consume new schemas.
3.  **UI Dashboard**: Build the read-only view for statistics.
