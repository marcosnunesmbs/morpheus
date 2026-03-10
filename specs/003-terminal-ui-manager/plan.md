# Implementation Plan: Unified Terminal Output Manager

**Branch**: `003-terminal-ui-manager` | **Date**: 2026-01-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-terminal-ui-manager/spec.md`

## Summary

Implement a singleton `DisplayManager` to centralized terminal output. This resolves visual conflicts between the running `ora` spinner and asynchronous logs from channels (Telegram) or the system. It ensures messages are printed clearly above the active spinner.

## Technical Context

**Language/Version**: Node.js >= 18, TypeScript
**Primary Dependencies**: `ora`, `chalk`
**Storage**: N/A
**Testing**: Manual verification
**Target Platform**: CLI
**Project Type**: CLI Application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **DX**: Improves readability and debugging experience.
- **Reliability**: Removes race conditions on stdout.
- **Local-First**: No data handling involved.

## Project Structure

### Documentation (this feature)

```text
specs/003-terminal-ui-manager/
├── plan.md              
├── research.md          
├── data-model.md        
└── tasks.md             
```

### Source Code (repository root)

```text
src/
├── runtime/
│   └── display.ts        # NEW: The DisplayManager implementation
├── channels/
│   └── telegram.ts       # UPDATE: Use DisplayManager
├── cli/
│   ├── commands/
│   │   └── start.ts      # UPDATE: Use DisplayManager for spinner
│   └── index.ts          
└── types/
    └── display.ts        # NEW: Interfaces
```

## Phase 1: Setup & Core Logic

- [ ] T001 Create `src/types/display.ts` with LogLevel and Options interfaces.
- [ ] T002 Create `src/runtime/display.ts` implementing the Singleton `DisplayManager`.
- [ ] T003 Implement `startSpinner`, `stopSpinner`, `updateSpinner` methods.
- [ ] T004 Implement `log` method with the "Stop-Log-Start" pattern.

## Phase 2: Integration

- [ ] T005 Refactor `src/cli/commands/start.ts` to use `DisplayManager` for the main loop spinner.
- [ ] T006 Refactor `src/channels/telegram.ts` to use `DisplayManager.log()` instead of `console.log`.
- [ ] T007 Add colored prefixes (chalk) for different sources in `log()` method.

## Phase 3: Verification

- [ ] T008 Verification: Start agent, send Telegram message, verify clean output.
- [ ] T009 Verification: Check `config set` logs also work cleanly if agent is running (needs careful check if commands run in same process or new). NB: `config set` runs in new process usually, so strictly this only affects the long-running `start` process.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
