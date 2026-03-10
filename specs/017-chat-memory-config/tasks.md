# Tasks: Chat History Configuration

**Feature Branch**: `017-chat-memory-config`
**Generated**: 2026-02-01
**Spec**: [spec.md](spec.md)

## Phase 1: Setup

- [x] T001 Initialize feature structure (Done via script)

## Phase 2: User Story 1 - Configure Chat History Limit
*Goal: Allow user to control `memory.limit` via UI.*

- [x] T002 [US1] Update `Settings.tsx` to handle `memory.limit` path in `handleUpdate` in [src/ui/src/pages/Settings.tsx](src/ui/src/pages/Settings.tsx)
- [x] T003 [US1] Add "Memory" section (or append to LLM section) with `memory.limit` number input in [src/ui/src/pages/Settings.tsx](src/ui/src/pages/Settings.tsx)
- [x] T004 [US1] Validate persistence of memory limit setting in [src/ui/src/pages/Settings.tsx](src/ui/src/pages/Settings.tsx)

## Dependencies

- None.

## Implementation Strategy

1.  Single-phase update to `Settings.tsx`.
