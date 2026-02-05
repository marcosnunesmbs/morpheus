## Why

Currently, the Sati memory agent configuration is hardcoded to use the same LLM settings as the Oracle agent, with no way for users to customize it separately. Users need the ability to configure Sati's LLM provider, model, and memory limits independently through the UI, while also having the option to keep it synchronized with Oracle's settings for simplicity.

## What Changes

- Add dedicated "Sati Agent" configuration section in the UI Settings page
- Rename "LLM Provider" label to "Oracle Agent" for clarity
- Implement toggle to "Use same configuration as Oracle Agent"
- Add Sati-specific LLM configuration fields (provider, model, API key, memory limit)
- Create API endpoints to read and update Sati configuration separately from Oracle config
- Update backend configuration schema to support independent Sati settings

## Capabilities

### New Capabilities
- `sati-ui-settings`: UI components for configuring Sati agent settings with toggle for using Oracle config
- `sati-api-endpoints`: Backend API endpoints for managing Sati configuration separately

### Modified Capabilities
- None

## Impact

**UI:**
- `src/ui/src/pages/Settings.tsx`: Add new "Sati Agent" section, rename LLM section to "Oracle Agent"
- New form fields and validation logic for Sati configuration

**Backend:**
- `src/config/schemas.ts`: Schema already supports `santi` config (from previous work)
- `src/http/api.ts`: New endpoints for Sati config GET/POST
- `src/config/manager.ts`: Already has `getSatiConfig()` method

**Configuration:**
- Config file structure supports independent Sati settings (backward compatible)
