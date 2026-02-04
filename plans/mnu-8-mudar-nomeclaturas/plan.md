# MNU-8: Mudar Nomeclaturas (Change Nomenclature)

**Branch:** `marcosnunesmbs/mnu-8-mudar-nomeclaturas`  
**Description:** Rename core classes (Agent→Oracle, AudioAgent→Telephonist, ToolsFactory→Construtor) and config file (config.yaml→zaion.yaml) with automatic migration support.

## Goal
Rebrand Morpheus internal nomenclature to align with new naming conventions: Agent becomes "Oracle" (main reasoning engine), AudioAgent becomes "Telephonist" (audio interface), ToolsFactory becomes "Construtor" (tool builder), and the configuration file becomes "zaion.yaml". This refactor affects ~110 files across runtime code, logs, documentation, and tests, requiring careful migration strategy to avoid breaking existing installations.

## Implementation Steps

### Step 1: Implement Config File Migration & Update Paths
**Files:** src/runtime/migration.ts (new), src/config/manager.ts, src/config/constants.ts, src/runtime/scaffold.ts

**What:** Create automatic migration logic to rename `~/.morpheus/config.yaml` → `~/.morpheus/zaion.yaml` on first run after update. Update all config path constants from `config.yaml` to `zaion.yaml`. This ensures existing users don't break when upgrading.

**Testing:** 
1. Test with existing config.yaml (should auto-migrate to zaion.yaml)
2. Test with fresh install (should create zaion.yaml)
3. Test with both files present (should use zaion.yaml, warn about duplicate)
4. Verify migration logs appear with "Zaion" source tag

**Details:**
- Create `src/runtime/migration.ts` with `migrateConfigFile()` function
- Update `CONFIG_PATHS` in src/config/constants.ts: `config: path.join(MORPHEUS_ROOT, 'zaion.yaml')`
- Call migration in src/config/manager.ts `initialize()` before loading config
- Update scaffold.ts to generate `zaion.yaml` in init flow
- Add deprecation warning if old config.yaml found after migration

---

### Step 2: Rename Core Runtime Files & Update Class Names
**Files:** src/runtime/agent.ts → oracle.ts, src/runtime/audio-agent.ts → telephonist.ts, src/runtime/tools/factory.ts, src/types/agent.ts

**What:** Rename core class files and update all class/interface names: `Agent` → `Oracle`, `IAgent` → `IOracle`, `AudioAgent` → `Telephonist`, `ToolsFactory` → `Construtor`. Update type definitions in src/types/.

**Testing:**
1. Verify TypeScript compilation passes after renames
2. Run `npm run build` successfully
3. Check no broken imports with `npm run type-check`
4. Verify class constructors work: `new Oracle()`, `new Telephonist()`

**Details:**
- Rename files:
  - `src/runtime/agent.ts` → `src/runtime/oracle.ts`
  - `src/runtime/audio-agent.ts` → `src/runtime/telephonist.ts`
- Update class declarations:
  - `export class Agent` → `export class Oracle`
  - `export class AudioAgent` → `export class Telephonist`
  - `export class ToolsFactory` → `export class Construtor`
- Update interfaces in src/types/agent.ts:
  - `export interface IAgent` → `export interface IOracle`
- Keep method names unchanged (no API surface changes)

---

### Step 3: Update All Import Statements (16 files)
**Files:** src/channels/telegram.ts, src/http/api.ts, src/http/server.ts, src/cli/commands/*.ts, src/runtime/*.ts, src/types/*.ts

**What:** Update all import statements to use new file paths and class names. Change `import { Agent } from '../runtime/agent.js'` → `import { Oracle } from '../runtime/oracle.js'` across all files. Update variable declarations to use new class names.

**Testing:**
1. Run `npm run build` - should compile without errors
2. Search codebase for remaining "from '../runtime/agent" patterns (should be 0)
3. Search for `import { Agent }` excluding node_modules (should be 0)
4. Verify no runtime errors when starting daemon

**Details:**
Update imports in:
- **Channels:** src/channels/telegram.ts (`Agent` → `Oracle`)
- **HTTP:** src/http/server.ts, src/http/api.ts (`Agent` → `Oracle`, `AudioAgent` → `Telephonist`)
- **CLI:** src/cli/commands/start.ts, src/cli/commands/audio.ts
- **Runtime:** src/runtime/lifecycle.ts, src/runtime/display.ts, src/runtime/tools/factory.ts
- **Types:** src/types/agent.ts (interface re-exports)
- Update variable names: `private agent: Agent` → `private agent: Oracle`

---

### Step 4: Update DisplayManager Log Source Tags (23 locations)
**Files:** src/runtime/display.ts, src/runtime/oracle.ts, src/runtime/telephonist.ts, src/runtime/tools/factory.ts, src/runtime/tools/morpheus-tool.ts, src/config/mcp-loader.ts, src/http/api.ts

**What:** Update all `DisplayManager.getInstance().log()` calls to use new source tags: "Config" → "Zaion", "Agent" → "Oracle", "AgentAudio" → "Telephonist", "ToolsFactory" → "Construtor", "ToolCall" → "ConstructLoad". Update color assignments in DisplayManager.

**Testing:**
1. Run daemon and verify logs show new names ("Oracle", "Telephonist", "Construtor")
2. Check log colors are preserved correctly
3. Send test message via Telegram - verify "Oracle" appears in logs
4. Test audio transcription - verify "Telephonist" appears in logs
5. Trigger tool execution - verify "ConstructLoad" appears in logs

**Details:**
- Update color mapping in `src/runtime/display.ts`:
  ```typescript
  else if (options.source === 'Oracle') { color = chalk.hex('#FFA500'); }
  else if (options.source === 'Telephonist') { color = chalk.hex('#b902b9'); }
  else if (options.source === 'Construtor') { color = chalk.hex('#806d00'); }
  else if (options.source === 'ConstructLoad') { color = chalk.hex('#e5ff00'); }
  else if (options.source === 'Zaion') { color = chalk.hex('#00c3ff'); }
  ```
- Update log calls in:
  - **Config:** src/config/mcp-loader.ts (6 calls: "Config" → "Zaion")
  - **Oracle:** src/runtime/oracle.ts (3 calls: "Agent" → "Oracle")
  - **Telephonist:** src/runtime/telephonist.ts (6 calls: "AgentAudio" → "Telephonist")
  - **Construtor:** src/runtime/tools/factory.ts (4 calls: "ToolsFactory" → "Construtor")
  - **ConstructLoad:** src/runtime/tools/morpheus-tool.ts (4 calls: "ToolCall" → "ConstructLoad")

---

### Step 5: Update Test Files (13 files)
**Files:** src/runtime/__tests__/*.test.ts, src/channels/__tests__/*.test.ts, src/http/__tests__/*.test.ts

**What:** Update all test files to use new class names in constructor calls, imports, and mock expectations. Change `new Agent()` → `new Oracle()`, update mock setups for renamed classes.

**Testing:**
1. Run full test suite: `npm test`
2. Verify all tests pass (expect 0 failures)
3. Check test coverage remains above 80%
4. Run manual verification script: `npx tsx src/runtime/__tests__/manual_start_verify.ts`

**Details:**
Update constructor calls (9 files):
- `new Agent(...)` → `new Oracle(...)`
- `new AudioAgent(...)` → `new Telephonist(...)`

Update mocks and expectations:
- Mock imports: `jest.mock('../oracle.js')`
- Mock instances: `Oracle.prototype.initialize = jest.fn()`
- Spy assertions: `expect(Oracle.prototype.initialize).toHaveBeenCalled()`

Files to update:
- src/runtime/__tests__/agent.test.ts
- src/runtime/__tests__/audio-agent.test.ts
- src/runtime/__tests__/lifecycle.test.ts
- src/channels/__tests__/telegram.test.ts
- src/http/__tests__/server.test.ts
- All other test files importing Agent/AudioAgent

---

### Step 6: Update CLI Messages & User-Facing Text
**Files:** src/cli/commands/start.ts, src/cli/commands/init.ts, src/cli/index.ts, README.md

**What:** Update CLI command help text, success messages, and documentation to reference "zaion.yaml" instead of "config.yaml". Update initialization messages to say "Oracle initialized" instead of "Agent initialized".

**Testing:**
1. Run `npm start -- --help` - verify help text is accurate
2. Run `npm start -- init` - verify mentions zaion.yaml
3. Run `npm start -- start` - verify "✓ Oracle initialized" message
4. Check README examples use zaion.yaml

**Details:**
- Update `src/cli/commands/start.ts` line 65: `"✓ Oracle initialized"`
- Update CLI help text to reference zaion.yaml where config is mentioned
- Update README.md (7 occurrences of config.yaml → zaion.yaml)
- Update DOCUMENTATION.md (3 occurrences)
- Update .github/copilot-instructions.md (2 occurrences)

---

### Step 7: Update Specs & Documentation (50+ files)
**Files:** specs/001-cli-structure/ through specs/021-db-msg-provider-model/, ARCHITECTURE.md, QWEN.md

**What:** Batch update all specification files, architecture docs, and technical documentation to use new nomenclature. This is primarily a find-replace operation across markdown files.

**Testing:**
1. Search for remaining "config.yaml" in specs/ (should find 0 in code contexts)
2. Search for "Agent class" references (verify they now say "Oracle")
3. Verify quickstart guides reference correct file names
4. Check spec contracts use new interface names

**Details:**
- Update all specs (001-021) with references to:
  - `config.yaml` → `zaion.yaml` (in code examples and paths)
  - "Agent class" → "Oracle class" (in architecture descriptions)
  - "AudioAgent" → "Telephonist" (in feature descriptions)
- Update ARCHITECTURE.md with new class names
- Update QWEN.md and other AI context files
- Preserve historical context in research.md files (note: "previously called Agent")

---

### Step 8: Final Validation & Migration Testing
**Files:** All files (integration testing)

**What:** Comprehensive end-to-end testing of the migration path, fresh installations, and runtime behavior. Verify no references to old names remain in code (only in historical docs/comments where appropriate).

**Testing:**
1. **Fresh Install Test:**
   - Delete ~/.morpheus directory
   - Run `npm start -- init`
   - Verify creates `zaion.yaml` (not config.yaml)
   - Start daemon, send Telegram message
   - Verify logs show "Oracle", "Telephonist", "Zaion"

2. **Migration Test:**
   - Create test config at ~/.morpheus-test/config.yaml
   - Run migration logic
   - Verify file renamed to zaion.yaml
   - Verify contents unchanged
   - Verify migration log message appears

3. **Regression Test:**
   - Run full test suite: `npm test`
   - Build project: `npm run build`
   - Start daemon: `npm start -- start`
   - Test Telegram interaction
   - Test audio transcription (if configured)
   - Test tool execution (check MCP tools work)
   - Test Web UI (verify settings page works)

4. **Search Validation:**
   - `grep -r "class Agent" src/` (should only find in comments/docs)
   - `grep -r "config\.yaml" src/` (should only find in migration logic)
   - `grep -r "AudioAgent" src/` (should be 0 in code)
   - Verify no TypeScript errors: `npm run type-check`

**Details:**
- Create test environment with old config
- Verify automatic migration works
- Test rollback scenario (if migration fails, don't corrupt config)
- Verify all npm scripts work: build, dev, test, start
- Check no broken imports in UI: `npm run dev --prefix src/ui`

---

## Migration Strategy

### Breaking Changes
- **Config File Path:** `~/.morpheus/config.yaml` → `~/.morpheus/zaion.yaml`

### Automatic Migration
The system will automatically migrate existing configs on first run:
1. Check if `~/.morpheus/config.yaml` exists
2. If yes and `zaion.yaml` doesn't exist: rename file
3. Log success message with "Zaion" source
4. If both exist: use zaion.yaml, warn about duplicate

### Rollback Plan
If user needs to rollback to previous version:
1. Rename `zaion.yaml` back to `config.yaml`
2. Previous Morpheus version will work normally

### User Communication
Add to CHANGELOG.md:
```markdown
## [Next Version] - BREAKING CHANGES

### Renamed Components
- Main agent: `Agent` → `Oracle`
- Audio agent: `AudioAgent` → `Telephonist`
- Tool factory: `ToolsFactory` → `Construtor`
- Config file: `config.yaml` → `zaion.yaml` (auto-migrated)

### Migration
Your config will be automatically renamed on first run. No action required.
Logs will now show "Oracle", "Telephonist", and "Zaion" instead of previous names.
```

---

## Estimated Implementation Time
- **Step 1 (Migration):** 45 minutes
- **Step 2 (Core Rename):** 30 minutes
- **Step 3 (Imports):** 30 minutes
- **Step 4 (Logs):** 30 minutes
- **Step 5 (Tests):** 45 minutes
- **Step 6 (CLI):** 20 minutes
- **Step 7 (Docs):** 30 minutes
- **Step 8 (Testing):** 45 minutes

**Total:** ~4 hours (split across 8 commits)

---

## Success Criteria
- [ ] All TypeScript code compiles without errors
- [ ] All tests pass (`npm test`)
- [ ] Fresh install creates `zaion.yaml`
- [ ] Existing `config.yaml` auto-migrates to `zaion.yaml`
- [ ] Logs display "Oracle", "Telephonist", "Zaion", "Construtor", "ConstructLoad"
- [ ] CLI messages reference correct file names
- [ ] Documentation updated with new nomenclature
- [ ] No breaking changes to user workflows (migration is seamless)
- [ ] Git branch name matches Linear: `marcosnunesmbs/mnu-8-mudar-nomeclaturas`
