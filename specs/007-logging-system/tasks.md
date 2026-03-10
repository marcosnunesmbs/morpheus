# Tasks: Logging System

- **Phase 1**: Setup (Dependencies)
- **Phase 2**: Foundational (Configuration & Types)
- **Phase 3**: Persistence (User Story 1 - P1)
- **Phase 4**: Rotation & Policy (User Stories 2 & 3 - P2)
- **Phase 5**: Polish & Edge Cases

## Phase 1: Setup

- [x] T001 Install `winston` and `winston-daily-rotate-file` dependencies in `package.json`

## Phase 2: Foundational

- [x] T002 Update `src/types/config.ts` to include `LogConfig` interface
- [x] T003 Update `src/config/paths.ts` to include `LOGS_DIR` constant
- [x] T004 Update `src/config/manager.ts` to validate logging config with Zod schema and default values
- [x] T005 [P] Create `src/types/logging.ts` (or update `src/runtime/types.ts`) with `LogOptions` and `IDisplayManager` updates

## Phase 3: Persistent Auditing (User Story 1)

**Goal**: Logs are persisted to the filesystem immediately upon daemon startup.
**Independent Test**: Run `npm start`, check `~/.morpheus/logs/`, verify file creation and content.

- [x] T006 [US1] Refactor `src/runtime/display.ts` to implement `initialize(config)` method
- [x] T007 [US1] Implement Winston logger setup with `DailyRotateFile` transport in `DisplayManager`
- [x] T008 [US1] Update `log()` method in `DisplayManager` to dual-write to console and Winston
- [x] T009 [US1] Update `bin/morpheus.js` (or entry point) to call `DisplayManager.getInstance().initialize(config)` after config load
- [x] T010 [US1] Create unit test `src/runtime/__tests__/display.test.ts` to verify `log()` calls Winston transport

## Phase 4: Rotation & Config (User Stories 2 & 3)

**Goal**: Logs rotate daily and respect retention and level settings.
**Independent Test**: Manually config 1d retention, simulate file dates, verify cleanup.

- [x] T011 [US2] Verify `DisplayManager` passes retention config to `winston-daily-rotate-file` in `src/runtime/display.ts`
- [x] T012 [US3] Connect `config.logging.enabled` to prevent logger initialization or writing in `src/runtime/display.ts`
- [x] T013 [US3] Ensure `log()` respects `config.logging.level` (mapping console 'success'/'warning' to 'info'/'warn')

## Phase 5: Polish & Cross-Cutting

- [x] T014 Update `src/cli/index.ts` or `src/cli/commands/doctor.ts` to check write permissions on `LOGS_DIR`
- [x] T015 Verify error handling: Ensure logging failure does not crash the CLI (try/catch in `log` method)

## Dependency Graph

```merchant
graph TD
    T001[Install Deps] --> T002[Config Types]
    T001 --> T007[Winston Setup]
    T002 --> T004[Config Manager]
    T002 --> T006[DisplayManager Init]
    T003 --> T006
    T004 --> T009[Entry Point Init]
    T006 --> T007
    T007 --> T008[Dual Write]
    T008 --> T009
    T008 --> T010[Tests]
```

## Parallel Execution Opportunities

- T005 (Types) can be done in parallel with T001 (Install)
- T010 (Tests) can be written while T007/T008 are being implemented (TDD)
