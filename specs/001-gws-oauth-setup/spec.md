# GWS OAuth Setup — Functional Specification

## Overview
Replace the mandatory service account JSON requirement for Google Workspace (GWS) with an interactive OAuth 2.0 flow. Users can authorize GWS access by clicking a link, approving scopes in their browser, and having tokens automatically saved — matching the existing MCP OAuth UX.

## Problem Statement
Today, GWS skills require users to:
1. Create a Google Cloud Project manually
2. Configure OAuth consent screen
3. Create a service account
4. Download JSON key file
5. Paste JSON into zaion.yaml or upload via UI

This is error-prone, requires technical knowledge, and blocks non-admin users from using GWS features.

## Solution
Leverage the `gws` CLI's built-in OAuth flow (`gws auth login`) to provide a guided setup experience:
- User clicks "Connect Google Account" in UI or asks Oracle to set up GWS
- System generates OAuth authorization URL
- User clicks link, approves scopes in browser
- System detects completion and validates auth
- Skills work immediately after authorization

## Functional Requirements

### FR-1: Auth Method Selection
**Priority:** Must Have

The system MUST support two authentication methods for GWS:
- `service_account` — legacy mode using JSON key file (existing behavior)
- `oauth` — new mode using interactive OAuth 2.0 (PKCE flow)

Users can switch between modes via zaion.yaml, env vars, or Settings UI.

### FR-2: OAuth Setup Flow
**Priority:** Must Have

When `auth_method` is `oauth` or not configured, the system MUST:

1. Check if `gws` binary is available in PATH
2. Initiate OAuth flow by running `gws auth login --scopes <scopes>`
3. Capture the authorization URL printed by gws CLI
4. Send URL to user via notification (Telegram, Discord, or UI)
5. Poll or detect when tokens are obtained by gws CLI
6. Validate that tokens exist and are active
7. Report success to user

### FR-3: Scope Selection
**Priority:** Must Have

Default scopes MUST include core GWS services:
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/contacts`
- `https://www.googleapis.com/auth/docs`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/presentations`

Users can customize scopes via:
- `gws.oauth_scopes` array in zaion.yaml (short names: `gmail`, `drive`, etc.)
- Environment variable `MORPHEUS_GWS_OAUTH_SCOPES` (comma-separated)
- UI multi-select in Settings → Channels → Google Workspace

### FR-4: Status Monitoring
**Priority:** Must Have

The system MUST expose GWS OAuth status via API:
```
GET /api/gws/oauth/status
Response: {
  "auth_method": "oauth",
  "status": "authorized" | "pending" | "expired" | "error",
  "scopes": ["gmail", "drive", ...],
  "expires_at": 1234567890,
  "binary_available": true
}
```

### FR-5: Setup Endpoint
**Priority:** Must Have

New API endpoint to initiate OAuth setup:
```
POST /api/gws/oauth/setup
Request: { "scopes": ["gmail", "drive"] }  // optional, uses defaults if omitted
Response: { 
  "url": "https://accounts.google.com/o/oauth2/...",
  "status": "pending_auth",
  "message": "Click to authorize..."
}
```

### FR-6: Revoke Endpoint
**Priority:** Should Have

```
DELETE /api/gws/oauth/revoke
Response: { "status": "revoked", "message": "GWS OAuth tokens revoked" }
```

Removes tokens from `~/.config/gws/` and resets local auth state.

### FR-7: Refresh Endpoint
**Priority:** Should Have

```
POST /api/gws/oauth/refresh
Response: { "status": "refreshed", "expires_at": 1234567890 }
```

Forces token refresh by calling `gws auth login` again (non-blocking if tokens still valid).

### FR-8: Fallback to Service Account
**Priority:** Must Have

If `gws` binary is not available or OAuth fails, the system MUST fall back to service account authentication if `service_account_json` is configured.

### FR-9: Oracle Integration
**Priority:** Must Have

Oracle MUST detect when GWS auth is missing and guide users:
- If user asks GWS-related task and auth is not configured, respond with setup instructions
- Provide authorization URL directly if channel supports it (Telegram, Discord, UI)
- Notify user when authorization is complete

### FR-10: Skill Validation
**Priority:** Must Have

Before executing GWS skills, Apoc MUST verify:
- `gws` binary is available
- Auth tokens are present and not expired
- Required scopes for the specific skill are authorized

If validation fails, the skill MUST return an error with setup instructions.

## Non-Functional Requirements

### NFR-1: Security
- Tokens MUST remain encrypted at rest (gws CLI handles this via AES-256-GCM)
- Never log or expose token values in API responses
- Authorization URLs MUST be sent only to the originating channel

### NFR-2: Performance
- OAuth setup MUST NOT block daemon startup
- Status checks MUST complete in <100ms
- Skill execution MUST fail fast (<500ms) if auth is missing

### NFR-3: Compatibility
- Existing service account setups MUST continue working without migration
- Both auth methods can coexist (OAuth takes precedence if configured)
- Windows, macOS, and Linux MUST be supported

## Error Handling

### E-1: Binary Not Found
When `gws` is not in PATH:
```json
{
  "error": "gws_binary_not_found",
  "message": "Google Workspace CLI (gws) not found in system PATH. Install with: npm install -g @googleworkspace/cli",
  "fallback": "service_account"
}
```

### E-2: OAuth Timeout
If user doesn't complete auth within 5 minutes:
```json
{
  "error": "oauth_timeout",
  "message": "OAuth authorization timed out. Please run setup again.",
  "action": "retry_setup"
}
```

### E-3: Insufficient Scopes
If required scope is not authorized:
```json
{
  "error": "insufficient_scopes",
  "message": "Gmail access requires authorization. Run GWS OAuth setup with 'gmail' scope.",
  "missing_scopes": ["gmail"]
}
```

### E-4: Token Expired
When refresh token is invalid or expired:
```json
{
  "error": "token_expired",
  "message": "GWS OAuth tokens expired. Please re-authorize.",
  "action": "refresh_oauth"
}
```

## Migration Path

Existing service account users are NOT affected. OAuth is opt-in via:
1. Setting `gws.auth_method: oauth` in zaion.yaml
2. Clicking "Connect Google Account" in Settings UI
3. Asking Oracle to set up GWS with OAuth

No automatic migration occurs — users choose when to switch.

## Success Metrics
- GWS OAuth setup completes in <30 seconds (user action time)
- Zero blocking errors during daemon startup
- Skills fail fast with actionable messages when auth is missing
- Both auth methods coexist without conflicts
