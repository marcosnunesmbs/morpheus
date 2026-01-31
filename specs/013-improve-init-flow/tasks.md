# Tasks: Improved Init Flow

**Branch**: `013-improve-init-flow`
**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Status**: Completed

## Phase 1: Setup
*Goal: Prepare the existing init command for modifications.*

- [x] T001 Import `ConfigManager` and verify imports in `src/cli/commands/init.ts`

## Phase 2: User Story 1 - Smart Config Pre-filling
*Goal: Detect existing configuration and use it as defaults.*

- [x] T002 [US1] Implement `load()` call on `ConfigManager` at the start of `initCommand` execution in `src/cli/commands/init.ts`
- [x] T003 [US1] Update Agent prompts (name, personality) to use `config.agent.X` as defaults in `src/cli/commands/init.ts`
- [x] T004 [US1] Update LLM prompts (provider, model) to use `config.llm.X` as defaults in `src/cli/commands/init.ts`
- [x] T005 [US1] Update LLM API Key prompt description to indicate "leave empty to preserve" if key exists in `src/cli/commands/init.ts`
- [x] T006 [US1] Update Telegram setup (token, allowedUsers) to use `config.channels.telegram.X` as defaults in `src/cli/commands/init.ts`

## Phase 3: User Story 2 - Conditional Audio Configuration
*Goal: Implement intelligent audio setup flow.*

- [x] T007 [US2] Insert Audio Setup block after LLM setup in `src/cli/commands/init.ts`
- [x] T008 [US2] Add `confirm` prompt for `audio.enabled` (defaulting to current config) in `src/cli/commands/init.ts`
- [x] T009 [US2] Implement conditional logic: check if selected provider is 'gemini' in `src/cli/commands/init.ts`
- [x] T010 [US2] Implement prompt for `audio.apiKey` ONLY if provider != 'gemini' and audio enabled in `src/cli/commands/init.ts`
- [x] T011 [US2] Implement logic to auto-disable audio and warn if key is required but missing in `src/cli/commands/init.ts`
- [x] T012 [US2] Save audio settings (`enabled`, `apiKey`) to `ConfigManager` in `src/cli/commands/init.ts`

## Phase 4: Polish
*Goal: Final verification.*

- [x] T013 Verify prompts flow logically and messages are clear in `src/cli/commands/init.ts`

## Dependencies
- US2 depends on US1 (needs loaded config to know current audio state).

## Implementation Strategy
1.  Add config loading (US1).
2.  Refactor existing prompts to use loaded values (US1).
3.  Inject new Audio flow logic (US2).
