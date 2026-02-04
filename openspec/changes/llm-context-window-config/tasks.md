## 1. Update TypeScript Interfaces

- [x] 1.1 Add `context_window?: number` to `LLMConfig` interface in `src/types/config.ts`
- [x] 1.2 Mark `limit` in `MemoryConfig` as deprecated with JSDoc comment
- [x] 1.3 Verify TypeScript compilation passes with no errors

## 2. Update Config Schema

- [x] 2.1 Add `context_window` field to `LLMConfigSchema` in `src/config/schemas.ts` as optional positive integer
- [x] 2.2 Mark `memory.limit` as optional (for backward compatibility)
- [x] 2.3 Update `DEFAULT_CONFIG` in `src/types/config.ts` to include `llm.context_window: 100`
- [x] 2.4 Test Zod schema validation with both old and new config structures

## 3. Implement Config Migration

- [x] 3.1 Add migration function in `src/runtime/migration.ts` to detect and migrate `memory.limit` → `llm.context_window`
- [x] 3.2 Implement backup creation before migration (`.backup-<timestamp>`)
- [x] 3.3 Add error handling with fail-open behavior (log errors, continue startup)
- [x] 3.4 Make migration idempotent (check if already migrated)
- [ ] 3.5 Test migration with various config states (only old field, only new field, both fields, neither field)

## 4. Update Oracle Implementation

- [x] 4.1 Update Oracle.initialize() to read `llm.context_window` with fallback to `memory.limit` then 100
- [x] 4.2 Change SQLiteChatMessageHistory constructor call to use new fallback chain
- [x] 4.3 Add DisplayManager log message showing which config value is being used
- [ ] 4.4 Test Oracle initialization with various config states

## 5. Update Init Command

- [x] 5.1 Update `src/cli/commands/init.ts` to prompt for "Context Window Size"
- [x] 5.2 Change prompt text to clarify it's for LLM context (not memory storage)
- [x] 5.3 Update config save to write to `llm.context_window` instead of `memory.limit`
- [x] 5.4 Add input validation for positive integers
- [ ] 5.5 Test init command flow end-to-end

## 6. Update Doctor Command

- [x] 6.1 Add validation in `src/cli/commands/doctor.ts` to check for `llm.context_window`
- [x] 6.2 Show warning when field is missing with default value message
- [x] 6.3 Detect deprecated `memory.limit` usage and suggest migration
- [x] 6.4 Show warning when both fields present
- [ ] 6.5 Test doctor command with various config states

## 7. Update UI Settings Component

- [x] 7.1 Move context window field from "Chat Memory" section to "LLM Configuration" section in `src/ui/src/pages/Settings.tsx`
- [x] 7.2 Change label from "History Limit (Messages)" to "Context Window (Messages)"
- [x] 7.3 Update helper text to "Number of past interactions to load into LLM context (e.g., 100)"
- [x] 7.4 Change form path from `['memory', 'limit']` to `['llm', 'context_window']`
- [x] 7.5 Update error key from `errors['memory.limit']` to `errors['llm.context_window']`
- [ ] 7.6 Test UI form load, edit, and save with new field path

## 8. Testing & Validation

- [ ] 8.1 Test fresh install with `morpheus init` creates config with `llm.context_window`
- [ ] 8.2 Test upgrade scenario: old config auto-migrates on first start
- [ ] 8.3 Test `morpheus doctor` detects missing field and reports default
- [ ] 8.4 Test UI Settings page shows field in correct section with correct label
- [ ] 8.5 Test Oracle loads correct context window value from config
- [ ] 8.6 Verify backup file created during migration
- [ ] 8.7 Test rollback by restoring backup file

## 9. Documentation

- [x] 9.1 Update `.github/copilot-instructions.md` to reference `llm.context_window` instead of `memory.limit`
- [x] 9.2 Add migration notes to CHANGELOG.md
- [x] 9.3 Update README.md if it references memory configuration

## 10. Cleanup

- [x] 10.1 Remove console.log statements used during testing
- [x] 10.2 Verify all DisplayManager logging uses correct source names
- [ ] 10.3 Run `npm test` to ensure no regressions
- [x] 10.4 Run `npm run build` to verify production build works
