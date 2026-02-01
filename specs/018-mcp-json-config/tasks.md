# Tasks: MCP JSON Configuration

**Input**: Design documents from `/specs/018-mcp-json-config/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/mcp-config.ts ✓, quickstart.md ✓

**Tests**: Not explicitly requested - test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Project type**: Single project (CLI + Runtime)
- Paths use `src/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new files and type definitions needed by all stories

- [ ] T001 [P] Create MCP types and template in `src/types/mcp.ts`
- [ ] T002 [P] Add MCPServerConfigSchema to `src/config/schemas.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core MCP loader infrastructure that all user stories depend on

**⚠️ CRITICAL**: User story work cannot begin until this phase is complete

- [ ] T003 Create MCP config loader module in `src/config/mcp-loader.ts`
- [ ] T004 Implement `loadMCPConfig()` function with JSON parsing in `src/config/mcp-loader.ts`
- [ ] T005 Implement entry validation loop with Zod schema and log each loaded/failed server (FR-009) in `src/config/mcp-loader.ts`
- [ ] T006 Add metadata key filtering (skip `_` and `$` prefixed keys) in `src/config/mcp-loader.ts`

**Checkpoint**: MCP loader ready - user story implementation can now begin

---

## Phase 3: User Story 1 - First-Time Setup with MCP Template (Priority: P1) 🎯 MVP

**Goal**: When user runs `morpheus init`, system creates `mcps.json` with documented template

**Independent Test**: Run `morpheus init` on fresh install → verify `mcps.json` created with example entry

### Implementation for User Story 1

- [ ] T007 [US1] Import DEFAULT_MCP_TEMPLATE in `src/runtime/scaffold.ts`
- [ ] T008 [US1] Add `mcps.json` creation check (if not exists) in `src/runtime/scaffold.ts`
- [ ] T009 [US1] Write template JSON with `fs.writeJson()` and pretty print in `src/runtime/scaffold.ts`

**Checkpoint**: User Story 1 complete - `morpheus init` creates template file

---

## Phase 4: User Story 2 - Loading MCPs from Configuration File (Priority: P1) 🎯 MVP

**Goal**: ToolsFactory reads MCP servers from `mcps.json` instead of hardcoded values

**Independent Test**: Add MCP entry to `mcps.json`, run `morpheus start`, verify tool is loaded

### Implementation for User Story 2

- [ ] T010 [US2] Import `loadMCPConfig` in `src/runtime/tools/factory.ts`
- [ ] T011 [US2] Replace hardcoded `mcpServers` object with `await loadMCPConfig()` call in `src/runtime/tools/factory.ts`
- [ ] T012 [US2] Add early return with info log when no servers configured in `src/runtime/tools/factory.ts`
- [ ] T013 [US2] Remove hardcoded MCP entries (coingecko, coolify, context7) from `src/runtime/tools/factory.ts`
- [ ] T014 [US2] Keep existing `beforeToolCall` and `afterToolCall` hooks in `src/runtime/tools/factory.ts`

**Checkpoint**: User Story 2 complete - agent loads MCPs from config file

---

## Phase 5: User Story 3 - Adding a New MCP Server (Priority: P2)

**Goal**: User can edit `mcps.json` to add/remove/modify MCPs

**Independent Test**: Edit `mcps.json`, restart agent, verify changes take effect

### Implementation for User Story 3

> Note: This story requires no code changes - it's enabled by US1 + US2.
> Tasks here ensure the workflow is documented and validated.

- [ ] T015 [US3] Add example MCP entries to template showing different configurations in `src/types/mcp.ts`
- [ ] T016 [US3] Verify template includes `_docs` field with usage instructions in `src/types/mcp.ts`

**Checkpoint**: User Story 3 complete - users have clear documentation for adding MCPs

---

## Phase 6: User Story 4 - Automatic File Verification on Any CLI Command (Priority: P2)

**Goal**: Any CLI command auto-creates missing `config.yaml` and `mcps.json` files

**Independent Test**: Delete `mcps.json`, run `morpheus doctor`, verify file is recreated

### Implementation for User Story 4

- [ ] T017 [US4] Import `scaffold` function in `src/cli/index.ts`
- [ ] T018 [US4] Add Commander.js `preAction` hook calling `scaffold()` in `src/cli/index.ts`
- [ ] T019 [US4] Remove redundant `scaffold()` call from `initCommand` in `src/cli/commands/init.ts` (now handled by hook)

**Checkpoint**: User Story 4 complete - all commands ensure config files exist

---

## Phase 7: User Story 5 - Error Handling for Invalid Configuration (Priority: P2)

**Goal**: System gracefully handles invalid JSON and malformed entries

**Independent Test**: Create malformed `mcps.json`, run `morpheus start`, verify clear error message and graceful degradation

### Implementation for User Story 5

> Note: These tasks extend the core loader created in Phase 2 for robust error handling.

- [ ] T020 [US5] Add try-catch for JSON.parse with user-friendly error logging in `src/config/mcp-loader.ts`
- [ ] T021 [US5] Log validation errors for individual entries with server name in `src/config/mcp-loader.ts`
- [ ] T022 [US5] Ensure empty object return on parse failure (agent starts without MCPs) in `src/config/mcp-loader.ts`
- [ ] T023 [US5] Handle empty file (0 bytes) as valid empty config in `src/config/mcp-loader.ts`

**Checkpoint**: User Story 5 complete - robust error handling implemented

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T024 [P] Remove any unused imports from modified files
- [ ] T025 [P] Verify all imports use `.js` extension (ESM requirement)
- [ ] T026 Run `npm run build` to verify TypeScript compilation
- [ ] T027 Run quickstart.md validation checklist manually

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────► Phase 2 (Foundational) ─────────► User Stories (3-7)
     │                            │                               │
     └── T001, T002 [P]           └── T003 → T004 → T005 → T006   └── Can run in priority order
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (Template Creation) | Phase 2 | T006 complete |
| US2 (Load from Config) | Phase 2 | T006 complete |
| US3 (Adding MCPs) | US1, US2 | T014 complete |
| US4 (CLI Auto-Verify) | US1 | T009 complete |
| US5 (Error Handling) | Phase 2 | T006 complete |

### Parallel Opportunities

**Phase 1** - Both tasks can run in parallel:
```bash
T001: "Create MCP types and template in src/types/mcp.ts"
T002: "Add MCPServerConfigSchema to src/config/schemas.ts"
```

**After Phase 2** - User stories can start in parallel:
```bash
US1: T007-T009 (scaffold.ts)
US2: T010-T014 (factory.ts)
US5: T020-T023 (mcp-loader.ts - extends Phase 2)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T006)
3. Complete Phase 3: User Story 1 (T007-T009)
4. Complete Phase 4: User Story 2 (T010-T014)
5. **STOP and VALIDATE**: Test `morpheus init` + `morpheus start`
6. Deploy MVP

### Incremental Delivery

1. MVP (US1 + US2) → Users can configure MCPs
2. Add US4 (CLI Auto-Verify) → Better UX, any command first
3. Add US5 (Error Handling) → Production-ready resilience
4. Add US3 (Documentation) → Self-service onboarding

---

## Files Changed Summary

| File | Action | Stories |
|------|--------|---------|
| `src/types/mcp.ts` | NEW | US1, US3 |
| `src/config/schemas.ts` | MODIFY | Phase 1 |
| `src/config/mcp-loader.ts` | NEW | Phase 2, US5 |
| `src/runtime/scaffold.ts` | MODIFY | US1 |
| `src/runtime/tools/factory.ts` | MODIFY | US2 |
| `src/cli/index.ts` | MODIFY | US4 |
| `src/cli/commands/init.ts` | MODIFY | US4 |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story is independently testable after completion
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
- ESM requirement: All imports must include `.js` extension
