# GWS OAuth Setup — Implementation Tasks

## Phase 1: Config & Types
- [ ] 1.1 Add `auth_method` and `oauth_scopes` to `GwsConfig` in `src/types/config.ts`
- [ ] 1.2 Update `GwsConfigSchema` in `src/config/schemas.ts` with new fields
- [ ] 1.3 Create `src/runtime/gws-oauth/scopes.ts` with scope mapping constants
- [ ] 1.4 Add `DEFAULT_GWS_SCOPES` array constant
- [ ] 1.5 Update `ConfigManager.getGwsConfig()` to handle env var overrides:
  - `MORPHEUS_GWS_AUTH_METHOD`
  - `MORPHEUS_GWS_OAUTH_SCOPES` (comma-separated string)

## Phase 2: GwsOAuthManager
- [ ] 2.1 Create `src/runtime/gws-oauth/types.ts` with:
  - `GwsOAuthStatus` interface
  - `GwsSetupResult` interface
  - `GwsAuthMethod` type union
- [ ] 2.2 Create `src/runtime/gws-oauth/manager.ts` skeleton with singleton pattern
- [ ] 2.3 Implement `isBinaryAvailable('gws')` helper (reuse from gws-sync or extract)
- [ ] 2.4 Implement `setup(scopes?)` method:
  - Spawn `gws auth login --scopes <list>`
  - Capture authorization URL from stdout
  - Return `{ url, status: 'pending_auth' }`
- [ ] 2.5 Implement `pollForTokens(timeoutMs)` method:
  - Poll `~/.config/gws/credentials.json` for existence
  - Poll `gws auth status --json` for validity
  - Resolve when tokens detected or timeout
- [ ] 2.6 Implement `getStatus()` method:
  - Check credentials file existence
  - Run `gws auth status --json` for detailed info
  - Return `GwsOAuthStatus` with scopes, expiry
- [ ] 2.7 Implement `revoke()` method:
  - Delete `~/.config/gws/credentials.json`
  - Clear any cached state
- [ ] 2.8 Implement `refresh(scopes?)` method:
  - Re-run setup flow if tokens expired
  - No-op if tokens still valid
- [ ] 2.9 Add barrel export `src/runtime/gws-oauth/index.ts`

## Phase 3: HTTP Router
- [ ] 3.1 Create `src/http/routers/gws.ts` with:
  - `GET /api/gws/oauth/status`
  - `POST /api/gws/oauth/setup`
  - `DELETE /api/gws/oauth/revoke`
  - `POST /api/gws/oauth/refresh`
- [ ] 3.2 Mount GWS router in `src/http/api.ts`
- [ ] 3.3 Initialize `GwsOAuthManager` in `src/cli/commands/start.ts`
- [ ] 3.4 Test all endpoints manually (curl/Postman)

## Phase 4: Oracle & Apoc Integration
- [ ] 4.1 Create `validateGwsAuth(skillName)` function in `src/runtime/subagents/apoc.ts`
- [ ] 4.2 Add pre-flight check before executing GWS skills
- [ ] 4.3 Update Apoc's skill selection to check auth status
- [ ] 4.4 Add Oracle system prompt section for GWS auth guidance
- [ ] 4.5 Test skill execution with missing auth → verify error message
- [ ] 4.6 Test skill execution with authorized OAuth → verify success

## Phase 5: UI Integration
- [ ] 5.1 Add GWS OAuth section to Settings → Channels tab
- [ ] 5.2 Create auth method selector (OAuth vs Service Account)
- [ ] 5.3 Add status display (authorized/pending/expired)
- [ ] 5.4 Add "Connect Google Account" button with setup call
- [ ] 5.5 Add authorization link display when setup initiated
- [ ] 5.6 Add "Revoke Access" and "Refresh Tokens" buttons
- [ ] 5.7 Add scope multi-select checkboxes
- [ ] 5.8 Wire up real-time status polling (refetch every 10s when pending)
- [ ] 5.9 Test UI in both light (Azure) and dark (Matrix) themes

## Phase 6: gws-sync Integration
- [ ] 6.1 Update `syncGwsSkills()` to check OAuth status
- [ ] 6.2 Add validation for OAuth tokens before skill sync
- [ ] 6.3 Update warning messages to reflect auth method
- [ ] 6.4 Test skill sync with OAuth authorized
- [ ] 6.5 Test skill sync with service account (no regression)

## Testing
- [ ] 7.1 Create `src/runtime/__tests__/gws-oauth.test.ts`
  - Test manager singleton behavior
  - Test setup flow (mock gws CLI spawn)
  - Test status detection
  - Test revoke functionality
- [ ] 7.2 Create `src/config/__tests__/gws-config.test.ts`
  - Test schema validation for new fields
  - Test env var overrides
  - Test config precedence
- [ ] 7.3 Create `src/http/__tests__/gws-router.test.ts`
  - Test all endpoint responses
  - Test error cases (missing binary, timeout)
- [ ] 7.4 Manual end-to-end test:
  - Fresh setup with no prior GWS config
  - Authorize via OAuth link
  - Execute GWS skill (e.g., gws-gmail-triage)
  - Verify success
- [ ] 7.5 Regression test:
  - Existing service account setup continues working
  - No errors during daemon startup
  - Config migration doesn't break zaion.yaml

## Documentation
- [ ] 8.1 Update `README.md` with GWS OAuth setup section
- [ ] 8.2 Add migration guide: service account → OAuth
- [ ] 8.3 Document scope requirements per skill
- [ ] 8.4 Update `specs/001-gws-oauth-setup/spec.md` if requirements changed

## Cleanup & Verification
- [ ] 9.1 Run `npm run build` — verify no TypeScript errors
- [ ] 9.2 Run `npm test` — verify all tests pass
- [ ] 9.3 Run `npm run dev:cli` — verify daemon starts without errors
- [ ] 9.4 Test on Windows (current environment)
- [ ] 9.5 Verify cross-platform paths (os.homedir, path.join)
- [ ] 9.6 Check for lint warnings (if linter configured)
- [ ] 9.7 Commit with descriptive message following repo conventions
