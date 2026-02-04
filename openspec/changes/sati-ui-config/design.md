## Context

The Sati memory agent currently shares LLM configuration with the Oracle agent. The backend already has infrastructure to support independent Sati configuration (`getSantiConfig()` in ConfigManager, `santi` key in config schema), but the UI provides no way to configure it. This change adds UI controls and API endpoints to expose this existing capability.

**Current State:**
- Backend config schema supports `santi` configuration block (from spec-022)
- `ConfigManager.getSantiConfig()` exists with fallback to Oracle config
- UI Settings page has "LLM Configuration" section (Oracle only)
- No API endpoints for Sati-specific config

**Constraints:**
- Must maintain backward compatibility (users without Sati config should continue working)
- Form validation should match existing LLM config patterns
- API must respect optional `THE_ARCHITECT_PASS` authentication

## Goals / Non-Goals

**Goals:**
- Add UI section for configuring Sati agent independently
- Provide toggle to easily sync Sati config with Oracle config
- Rename existing "LLM Configuration" to "Oracle Agent" for clarity
- Create API endpoints to read/write Sati configuration
- Validate Sati config fields same as Oracle config

**Non-Goals:**
- Modifying backend Sati runtime logic (already works)
- Changing config file migration logic
- Adding new config fields beyond what already exists in schema
- Real-time config updates (daemon restart still required)

## Decisions

### Decision 1: Toggle Implementation Strategy
**Choice:** Use controlled checkbox that copies Oracle config to Sati fields on check, allows independent editing on uncheck

**Rationale:**
- Simpler UX than alternative (disable fields when checked)
- Gives users visibility into what values are being used
- Allows starting from Oracle config then customizing
- Clear visual feedback of sync state

**Alternative Considered:**
- Disable Sati fields when toggle checked, fetch Oracle values dynamically
- **Rejected:** Less transparent, harder to customize starting from Oracle config

### Decision 2: API Endpoint Structure
**Choice:** Separate endpoints `/api/config/sati` (GET/POST) mirroring `/api/config/llm`

**Rationale:**
- Consistent with existing API patterns
- Allows independent updates without affecting Oracle config
- Clear separation of concerns

**Alternative Considered:**
- Single `/api/config` endpoint handling both Oracle and Sati
- **Rejected:** Complicates validation logic and increases risk of accidental Oracle config changes

### Decision 3: UI Section Placement
**Choice:** New "Sati Agent" section immediately after "Oracle Agent" section in Settings page

**Rationale:**
- Groups related configuration together
- Maintains visual hierarchy (Oracle first as primary agent)
- Follows existing Settings page pattern (sections stacked vertically)

**Alternative Considered:**
- Tabs for Oracle vs Sati
- **Rejected:** Overkill for two sections, harder to compare settings side-by-side

### Decision 4: Config Schema Validation
**Choice:** Reuse existing `LLMConfigSchema` for Sati config validation

**Rationale:**
- Sati config has identical structure to Oracle config
- No duplication of validation logic
- Guaranteed consistency between Oracle and Sati validation

## Risks / Trade-offs

**[Risk]** Users may be confused by having two separate LLM configurations
→ **Mitigation:** Toggle labeled "Use same configuration as Oracle Agent" provides clear default path

**[Risk]** Saving Sati config doesn't take effect until daemon restart
→ **Mitigation:** Show info message in UI: "Restart Morpheus daemon for changes to take effect"

**[Risk]** Users may set invalid API keys for Sati that differ from Oracle
→ **Mitigation:** Existing validation on API key format applies; runtime errors already fail-open with DisplayManager logging

**[Trade-off]** Adding second config section increases UI complexity
→ **Accepted:** Necessary to expose existing backend capability; toggle helps mitigate complexity

## Migration Plan

**Deployment Steps:**
1. Add API endpoints (backward compatible - no breaking changes)
2. Update UI components (cosmetic change + new section)
3. Deploy updated daemon

**Rollback Strategy:**
- Remove Sati API endpoints if issues arise
- Revert UI changes (Oracle config continues working)
- Config file remains valid (Sati config optional)

**Testing:**
- Test with no `santi` config (should fall back to Oracle)
- Test with independent `santi` config
- Test toggle behavior (sync/unsync)
- Verify API authentication works with `THE_ARCHITECT_PASS`
