## Context

Morpheus currently uses `memory.limit` to control how many conversation messages are loaded from SQLite and sent to the LLM. This naming is ambiguous - it suggests memory storage limits rather than context window management. The field lives under the `memory` config section but semantically belongs to LLM configuration since it directly controls the context sent to the model.

**Current State:**
- `memory.limit` is defined in `ConfigSchema` under `memory` object
- Oracle reads `this.config.memory?.limit` with fallback to 100
- UI Settings page shows it in "Chat Memory" section with label "History Limit (Messages)"
- Init command doesn't explicitly prompt for this value (uses defaults)
- Doctor command doesn't validate this field

**Constraints:**
- Must maintain backward compatibility for existing users with `memory.limit` in their config
- Config migration must be automatic and transparent
- No data loss or service disruption during migration

## Goals / Non-Goals

**Goals:**
- Rename `memory.limit` → `llm.context_window` for semantic clarity
- Move field from `memory` section to `llm` section in config schema
- Auto-migrate existing configs on startup without user intervention
- Update UI to reflect new naming and move to LLM section
- Enhance init flow to prompt for context window size
- Add doctor validation to detect missing field and report defaults

**Non-Goals:**
- Changing the actual functionality (still controls message count sent to LLM)
- Modifying SQLite history storage behavior
- Adding dynamic context window adjustment based on model capabilities
- Implementing token-based limits (stays message-based for now)

## Decisions

### Decision 1: Field Location - `llm.context_window` vs `memory.context_window`

**Choice:** Place under `llm` config section

**Rationale:**
- This field controls what is sent TO the LLM, not what is stored in memory
- SQLite always stores full history; this field only affects retrieval for context
- Aligns with LLM-specific settings like `temperature`, `max_tokens`, `model`
- Different LLM providers may have different optimal context windows

**Alternatives Considered:**
- Keep under `memory` section: Would perpetuate the semantic confusion
- Create new `context` top-level section: Over-engineering for a single field

### Decision 2: Migration Strategy - Auto-migrate vs Manual

**Choice:** Automatic migration in `migration.ts` on startup

**Rationale:**
- Seamless upgrade experience for existing users
- Prevents config validation errors on first launch after upgrade
- Follows established pattern used for other config migrations in Morpheus

**Migration Logic:**
```typescript
// In migration.ts
if (config.memory?.limit && !config.llm?.context_window) {
  config.llm.context_window = config.memory.limit;
  delete config.memory?.limit;
  // Write migrated config
}
```

**Alternatives Considered:**
- Manual migration via CLI command: Creates friction and support burden
- Deprecation warning first, then remove: Takes multiple release cycles

### Decision 3: Backward Compatibility - Dual Read vs Hard Cutover

**Choice:** Oracle reads `llm.context_window` first, falls back to `memory.limit` if missing

**Rationale:**
- Provides safety net if migration fails or is skipped
- Allows gradual transition in monorepo/multi-instance setups
- Minimal code complexity (simple null-coalescing)

**Implementation:**
```typescript
// In Oracle.initialize()
limit: this.config.llm?.context_window ?? this.config.memory?.limit ?? 100
```

**Alternatives Considered:**
- Hard cutover: Risky if migration has edge cases
- Keep both fields indefinitely: Config bloat and confusion

### Decision 4: UI Field Placement - Keep in Memory Section vs Move to LLM Section

**Choice:** Move to "LLM Configuration" section in Settings UI

**Rationale:**
- Reinforces semantic meaning (LLM context, not memory limit)
- Groups with related LLM settings (temperature, max_tokens, model)
- Reduces user confusion about what "Memory" section controls

**Label Change:**
- Old: "History Limit (Messages)" in "Chat Memory" section
- New: "Context Window (Messages)" in "LLM Configuration" section

### Decision 5: Default Value - Keep 100 vs Change

**Choice:** Keep default at 100 messages

**Rationale:**
- Proven safe value in production
- No reason to change behavior, only naming
- Avoids unintended context size changes for existing users

## Risks / Trade-offs

### Risk 1: Migration Logic Fails to Run
**Scenario:** User has corrupted config or custom deployment that skips migration

**Mitigation:**
- Oracle fallback ensures system still works: `llm.context_window ?? memory.limit ?? 100`
- Doctor command will detect and warn about deprecated field usage
- Migration code includes error handling and logging

### Risk 2: UI Shows Both Old and New Fields During Transition
**Scenario:** User edits config manually while UI updates are deployed

**Mitigation:**
- Migration runs on every startup (idempotent)
- UI only reads/writes `llm.context_window` after update
- Config validation schema will eventually reject old structure

### Risk 3: Breaking Change for External Tools
**Scenario:** Users have scripts/tools that read `memory.limit` directly from config YAML

**Impact:** Medium - External tooling may break

**Mitigation:**
- Document in changelog/release notes
- Provide grace period where both fields work (via Oracle fallback)
- Doctor command warns about deprecated usage

### Trade-off: Increased Config Schema Complexity
**Temporary Cost:** Need to support both `memory.limit` and `llm.context_window` during transition

**Long-term Benefit:** Cleaner, more intuitive config structure

**Plan:** Remove `memory.limit` support in next major version (v1.0)

## Migration Plan

### Phase 1: Code Changes (This PR)
1. Update TypeScript interfaces (`LLMConfig`, `MorpheusConfig`)
2. Update Zod schemas to include `llm.context_window` (keep `memory.limit` as deprecated/optional)
3. Update Oracle to read new field with fallback
4. Add migration logic in `migration.ts`
5. Update UI Settings component
6. Update init command prompts
7. Update doctor command validation

### Phase 2: Deployment
1. Users upgrade Morpheus (npm install -g morpheus-cli@latest)
2. On first `morpheus start`:
   - Config loads via ConfigManager
   - Migration runs automatically
   - Old `memory.limit` → New `llm.context_window`
   - Migrated config saved to disk
3. User sees no disruption (seamless)

### Phase 3: Verification
- Run `morpheus doctor` to verify config health
- Check Web UI Settings page shows new field in LLM section
- Confirm Oracle logs show context window being applied

### Rollback Strategy
**If migration causes issues:**
1. Downgrade to previous version: `npm install -g morpheus-cli@<previous-version>`
2. Config will still work (old version reads `memory.limit`)
3. Manual fix: Edit `~/.morpheus/config.yaml` to restore old structure if needed

**Protection:**
- Migration creates backup before modifying config
- Original config saved to `~/.morpheus/config.yaml.backup-<timestamp>`

## Open Questions

None - design is complete and ready for implementation.
