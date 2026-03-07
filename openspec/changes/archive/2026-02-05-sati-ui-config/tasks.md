## 1. Backend API Endpoints

- [x] 1.1 Add GET `/api/config/sati` endpoint in `src/http/api.ts`
- [x] 1.2 Implement logic to call `ConfigManager.getSatiConfig()` for fallback behavior
- [x] 1.3 Add POST `/api/config/sati` endpoint in `src/http/api.ts`
- [x] 1.4 Add request body validation using `LLMConfigSchema.parse()`
- [x] 1.5 Implement logic to call `ConfigManager.updateConfig({ santi: {...} })`
- [x] 1.6 Add DELETE `/api/config/sati` endpoint in `src/http/api.ts`
- [x] 1.7 Implement logic to remove `santi` key via `ConfigManager.updateConfig({ santi: undefined })`
- [x] 1.8 Add authentication checks for all three endpoints (check `THE_ARCHITECT_PASS` header)
- [x] 1.9 Add error handling with appropriate status codes (400, 401, 500)
- [x] 1.10 Test GET endpoint returns Oracle config when no Sati config exists
- [x] 1.11 Test POST endpoint validates and persists Sati config correctly
- [x] 1.12 Test DELETE endpoint removes Sati config and falls back to Oracle

## 2. UI Settings Component Structure

- [x] 2.1 Rename "LLM Configuration" section heading to "Oracle Agent" in `src/ui/src/pages/Settings.tsx`
- [x] 2.2 Add "Sati Agent" section after Oracle Agent section
- [x] 2.3 Add descriptive text under Sati section: "Configure the LLM used for memory consolidation"
- [x] 2.4 Create state variable for "Use same configuration as Oracle" toggle
- [x] 2.5 Add toggle checkbox UI component at top of Sati section
- [x] 2.6 Implement toggle handler to copy Oracle config values to Sati fields when checked

## 3. UI Sati Configuration Form Fields

- [x] 3.1 Add Provider dropdown field (OpenAI, Anthropic, Google Gemini, Ollama) matching Oracle field
- [x] 3.2 Add Model text input field matching Oracle field
- [x] 3.3 Add API Key password input field matching Oracle field
- [x] 3.4 Add Memory Limit number input field matching Oracle field
- [x] 3.5 Add Context Window number input field matching Oracle field
- [x] 3.6 Implement form validation rules matching Oracle config validation
- [x] 3.7 Add error display for validation failures
- [x] 3.8 Style fields to match existing Settings page patterns

## 4. UI Form Data Integration

- [x] 4.1 Add SWR hook to fetch from `/api/config/sati` on Settings page load
- [x] 4.2 Populate Sati form fields from API response
- [x] 4.3 Set toggle state based on whether `santi` config exists (unchecked if exists, checked if not)
- [x] 4.4 Implement form submission handler to POST to `/api/config/sati`
- [x] 4.5 Add success banner/toast after save: "Restart Morpheus daemon for changes to take effect"
- [x] 4.6 Add error handling for network failures with retry option
- [x] 4.7 Implement DELETE request when toggle is checked on save (remove Sati config)

## 5. API Client Updates

- [x] 5.1 Add `getSatiConfig()` function in `src/ui/src/services/api.ts`
- [x] 5.2 Add `updateSatiConfig(config)` function in `src/ui/src/services/api.ts`
- [x] 5.3 Add `deleteSatiConfig()` function in `src/ui/src/services/api.ts`
- [x] 5.4 Ensure all functions include `x-architect-pass` header if configured
- [x] 5.5 Add TypeScript types for Sati config request/response

## 6. Testing & Validation

- [x] 6.1 Test UI with no Sati config (toggle checked, shows Oracle values)
- [x] 6.2 Test UI with existing Sati config (toggle unchecked, shows Sati values)
- [x] 6.3 Test toggling on copies Oracle values to Sati fields
- [x] 6.4 Test toggling off allows independent editing
- [x] 6.5 Test form validation catches invalid provider values
- [x] 6.6 Test form validation requires positive integer for memory limit
- [x] 6.7 Test saving with toggle checked removes Sati config (DELETE request)
- [x] 6.8 Test saving with toggle unchecked persists Sati config (POST request)
- [x] 6.9 Test authentication works with `THE_ARCHITECT_PASS` set
- [x] 6.10 Test authentication is skipped when `THE_ARCHITECT_PASS` not set
- [x] 6.11 Verify daemon restart applies new Sati config

## 7. Documentation & Cleanup

- [x] 7.1 Update CHANGELOG.md with new feature entry
- [x] 7.2 Update README.md if needed (mention Sati UI config)
- [x] 7.3 Verify all DisplayManager logging uses correct source names (no console.log)
- [x] 7.4 Run `npm run build` to verify production build works
- [x] 7.5 Run UI locally and verify styling matches existing Settings page
