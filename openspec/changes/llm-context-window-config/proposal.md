## Why

The current `memory.limit` configuration is ambiguous and confusing. It controls how many messages are loaded from history into the LLM context, but the name suggests memory storage limits rather than context window management. This should be `llm.context_window` to clearly indicate it controls the context size sent to the LLM, not memory persistence.

Additionally, users installing or upgrading Morpheus need a smooth experience when this field is missing from their config, and should be informed via the `doctor` command when defaults are being used.

## What Changes

- **BREAKING**: Rename config field from `memory.limit` → `llm.context_window`
- Update Oracle initialization to read `llm.context_window` with fallback to old field for backward compatibility
- Update config schema (`ConfigSchema`) to include `llm.context_window` and mark `memory.limit` as deprecated
- Update TypeScript interfaces (`LLMConfig`, `MorpheusConfig`) to reflect new structure
- Update UI Settings page:
  - Change label from "History Limit (Messages)" → "Context Window (Messages)"
  - Update helper text to clarify this controls how many messages are sent to the LLM
  - Move field from "Chat Memory" section to "LLM Configuration" section (since it's LLM-specific)
  - Update form path from `['memory', 'limit']` → `['llm', 'context_window']`
- Update `init` command flow to prompt for "Context Window Size" instead of "Memory Limit"
- Update `doctor` command to:
  - Detect if `llm.context_window` is missing
  - Report when using default value (100 messages)
  - Optionally detect deprecated `memory.limit` and suggest migration
- Add config migration logic in `migration.ts` to auto-migrate old configs
- Update DEFAULT_CONFIG constant to use new structure

## Capabilities

### New Capabilities
- `config-migration-context-window`: Automatic migration from `memory.limit` to `llm.context_window` on startup

### Modified Capabilities
- `cli-init`: Init command now prompts for "Context Window Size"
- `cli-doctor`: Doctor command validates `llm.context_window` field and reports defaults
- `config-schema`: Config schema updated to use `llm.context_window`
- `ui-settings`: Settings UI updated with new label and field path

## Impact

**Affected Files:**
- `src/types/config.ts` - Interface definitions
- `src/config/schemas.ts` - Zod schema validation
- `src/runtime/oracle.ts` - Context window usage
- `src/runtime/migration.ts` - Migration logic
- `src/cli/commands/init.ts` - User prompts
- `src/cli/commands/doctor.ts` - Validation checks
- `src/ui/src/pages/Settings.tsx` - UI form labels and paths
- `.github/copilot-instructions.md` - Documentation update

**User Impact:**
- Existing users: Config auto-migrates on first startup after upgrade (seamless)
- New users: Clearer terminology during initialization
- All users: Better understanding of what this setting controls

**Breaking Changes:**
- Config file structure changes, but backward compatibility via migration ensures no user disruption
- UI form path changes (internal only, users see improved labels)
