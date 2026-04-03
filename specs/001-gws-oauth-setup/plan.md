# GWS OAuth Setup — Implementation Plan

## Technical Strategy

### Approach: CLI Wrapper + Status Detection

Since GWS skills call the `gws` CLI binary directly (not our code), we wrap its OAuth flow rather than reimplementing OAuth 2.0 from scratch. The `gws` CLI already handles:
- PKCE code challenge/verifier generation
- Browser redirect and callback server
- Token encryption (AES-256-GCM)
- Automatic refresh token rotation

We build a thin orchestration layer on top.

---

## Architecture

### New Components

```
src/runtime/gws-oauth/
├─ manager.ts        # GwsOAuthManager — singleton orchestrator
├─ types.ts          # TypeScript types for GWS OAuth state
└─ scopes.ts         # Scope name mapping (short → full Google scope)

src/http/routers/
└─ gws.ts            # POST /api/gws/oauth/setup, status, revoke, refresh
```

### Modified Components

```
src/types/config.ts          # Add auth_method, oauth_scopes to GwsConfig
src/config/schemas.ts        # Add GwsConfigSchema fields
src/config/manager.ts        # Handle env var overrides, validation
src/runtime/gws-sync.ts      # Check OAuth status, validate tokens
src/runtime/subagents/apoc.ts # Pre-flight auth check before GWS skills
src/ui/src/pages/Settings.tsx # Add OAuth setup section under Channels tab
```

---

## Implementation Phases

### Phase 1: Config & Types

#### 1.1 Update GwsConfig
```typescript
// src/types/config.ts
export interface GwsConfig {
  service_account_json?: string;
  service_account_json_content?: string;
  enabled?: boolean;
  // NEW:
  auth_method?: 'oauth' | 'service_account';
  oauth_scopes?: string[];  // ['gmail', 'drive', 'calendar', ...]
}
```

#### 1.2 Update Zod Schema
```typescript
// src/config/schemas.ts
export const GwsConfigSchema = z.object({
  service_account_json: z.string().optional(),
  service_account_json_content: z.string().optional(),
  enabled: z.boolean().optional(),
  auth_method: z.enum(['oauth', 'service_account']).optional(),
  oauth_scopes: z.array(z.string()).optional(),
});
```

#### 1.3 Scope Mapping
```typescript
// src/runtime/gws-oauth/scopes.ts
export const GWS_SCOPE_MAP: Record<string, string> = {
  gmail: 'https://www.googleapis.com/auth/gmail.modify',
  drive: 'https://www.googleapis.com/auth/drive',
  calendar: 'https://www.googleapis.com/auth/calendar',
  contacts: 'https://www.googleapis.com/auth/contacts',
  docs: 'https://www.googleapis.com/auth/docs',
  sheets: 'https://www.googleapis.com/auth/spreadsheets',
  presentations: 'https://www.googleapis.com/auth/presentations',
  chat: 'https://www.googleapis.com/auth/chat',
  tasks: 'https://www.googleapis.com/auth/tasks',
  people: 'https://www.googleapis.com/auth/userinfo.profile',
};

export function resolveGwsScopes(shortNames: string[]): string[] {
  return shortNames.map(s => GWS_SCOPE_MAP[s] ?? s);
}
```

---

### Phase 2: GwsOAuthManager

#### 2.1 Core Manager
```typescript
// src/runtime/gws-oauth/manager.ts
export class GwsOAuthManager {
  private static instance: GwsOAuthManager | null = null;
  private setupInProgress = false;
  private setupTimeout: NodeJS.Timeout | null = null;
  
  // Main methods:
  async setup(scopes?: string[]): Promise<{ url: string; status: string }>
  async getStatus(): Promise<GwsOAuthStatus>
  async revoke(): Promise<void>
  async refresh(scopes?: string[]): Promise<{ status: string }>
  
  // Internal:
  private async pollForTokens(timeoutMs: number): Promise<boolean>
  private async detectAuthStatus(): Promise<GwsAuthStatus>
  private getGwsCredentialsDir(): string  // ~/.config/gws/
}
```

#### 2.2 Setup Flow
```typescript
async setup(scopes?: string[]): Promise<{ url: string; status: string }> {
  // 1. Check if gws binary exists
  if (!isBinaryAvailable('gws')) {
    throw new Error('gws_binary_not_found');
  }
  
  // 2. Resolve scopes (from config or defaults)
  const resolvedScopes = resolveGwsScopes(scopes ?? DEFAULT_GWS_SCOPES);
  
  // 3. Start gws auth login --scopes <list> --export
  const child = spawn('gws', ['auth', 'login', '--scopes', resolvedScopes.join(',')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GOOGLE_WORKSPACE_CLI_FORCE_OAUTH: '1' }
  });
  
  // 4. Capture authorization URL from stdout
  const url = await captureAuthUrl(child);
  
  // 5. Start polling for token completion
  this.setupInProgress = true;
  this.setupTimeout = setTimeout(() => {
    this.setupInProgress = false;
    child.kill();
  }, 300_000); // 5 min timeout
  
  this.pollForTokens(300_000).then(() => {
    this.setupInProgress = false;
    display.log('✅ GWS OAuth setup complete');
  });
  
  return { url, status: 'pending_auth' };
}
```

#### 2.3 Status Detection
```typescript
async getStatus(): Promise<GwsOAuthStatus> {
  // Check if ~/.config/gws/credentials.json exists (encrypted tokens)
  const credsPath = path.join(os.homedir(), '.config', 'gws', 'credentials.json');
  
  if (!await fs.pathExists(credsPath)) {
    return { auth_method: 'oauth', status: 'pending', scopes: [] };
  }
  
  // Check token expiry via gws auth status
  const status = await execAsync('gws auth status --json');
  const parsed = JSON.parse(status.stdout);
  
  return {
    auth_method: 'oauth',
    status: parsed.valid ? 'authorized' : 'expired',
    scopes: parsed.scopes ?? [],
    expires_at: parsed.expires_at,
    binary_available: true,
  };
}
```

---

### Phase 3: HTTP Router

#### 3.1 Router Definition
```typescript
// src/http/routers/gws.ts
export function createGwsRouter(gwsManager: GwsOAuthManager): Router {
  const router = Router();
  
  // GET /api/gws/oauth/status
  router.get('/oauth/status', async (req, res) => {
    const status = await gwsManager.getStatus();
    res.json(status);
  });
  
  // POST /api/gws/oauth/setup
  router.post('/oauth/setup', async (req, res) => {
    const { scopes } = req.body ?? {};
    const result = await gwsManager.setup(scopes);
    res.json(result);
  });
  
  // DELETE /api/gws/oauth/revoke
  router.delete('/oauth/revoke', async (req, res) => {
    await gwsManager.revoke();
    res.json({ status: 'revoked' });
  });
  
  // POST /api/gws/oauth/refresh
  router.post('/oauth/refresh', async (req, res) => {
    const { scopes } = req.body ?? {};
    const result = await gwsManager.refresh(scopes);
    res.json(result);
  });
  
  return router;
}
```

#### 3.2 Mount in API
```typescript
// src/http/api.ts
import { createGwsRouter } from './routers/gws.js';
import { GwsOAuthManager } from '../runtime/gws-oauth/manager.js';

const gwsManager = GwsOAuthManager.getInstance();
app.use('/api/gws', createGwsRouter(gwsManager));
```

---

### Phase 4: Oracle Integration

#### 4.1 Pre-flight Check in Apoc
```typescript
// src/runtime/subagents/apoc.ts
async function validateGwsAuth(skillName: string): Promise<{ valid: boolean; error?: string }> {
  const config = ConfigManager.getInstance().get();
  
  if (config.gws?.auth_method !== 'oauth') {
    return { valid: true }; // Service account mode, skip OAuth checks
  }
  
  const status = await GwsOAuthManager.getInstance().getStatus();
  
  if (status.status !== 'authorized') {
    return {
      valid: false,
      error: `GWS OAuth not configured. Run setup or ask user to authorize.`,
    };
  }
  
  // Check if skill requires specific scopes
  const requiredScopes = getSkillRequiredScopes(skillName);
  const missingScopes = requiredScopes.filter(s => !status.scopes.includes(s));
  
  if (missingScopes.length > 0) {
    return {
      valid: false,
      error: `Missing scopes: ${missingScopes.join(', ')}. Refresh OAuth setup.`,
    };
  }
  
  return { valid: true };
}
```

#### 4.2 Oracle Prompt Enhancement
```typescript
// src/runtime/oracle.ts — system prompt addition
14.1. If the user asks about Google Workspace (Gmail, Drive, Calendar, etc.):
  - Check GWS auth status via GwsOAuthManager
  - If not authorized, respond with:
    "🔐 To access Google Workspace, I need authorization. 
    Click to connect: [setup URL from /api/gws/oauth/setup]
    Or run: 'Set up GWS OAuth' in the UI Settings."
```

---

### Phase 5: UI Integration

#### 5.1 Settings Page — Channels Tab
Add new section under existing GWS configuration:

```tsx
// src/ui/src/pages/Settings.tsx — Channels tab
{config.gws?.auth_method === 'oauth' && (
  <div className="rounded-xl border dark:border-matrix-primary p-6">
    <h3 className="text-lg font-semibold dark:text-matrix-highlight">
      Google Workspace OAuth
    </h3>
    
    {gwsStatus.status === 'authorized' ? (
      <div>
        <p className="text-green-600">✅ Authorized</p>
        <p>Scopes: {gwsStatus.scopes.join(', ')}</p>
        <p>Expires: {new Date(gwsStatus.expires_at!).toLocaleString()}</p>
        <button onClick={() => revokeGws()}>Revoke Access</button>
        <button onClick={() => refreshGws()}>Refresh Tokens</button>
      </div>
    ) : (
      <div>
        <p>Connect your Google Account to enable GWS skills.</p>
        <button onClick={() => setupGws()}>Connect Google Account</button>
        {setupUrl && (
          <a href={setupUrl} target="_blank" rel="noopener noreferrer">
            Open Authorization Link
          </a>
        )}
      </div>
    )}
  </div>
)}
```

#### 5.2 Auth Method Selector
```tsx
// Toggle between OAuth and Service Account
<SelectInput
  label="Auth Method"
  value={config.gws?.auth_method ?? 'service_account'}
  onChange={(val) => updateConfig('gws.auth_method', val)}
  options={[
    { label: 'OAuth (Recommended)', value: 'oauth' },
    { label: 'Service Account', value: 'service_account' },
  ]}
/>
```

---

### Phase 6: gws-sync Integration

#### 6.1 Enhanced Validation
```typescript
// src/runtime/gws-sync.ts
export async function syncGwsSkills(destOverride?: string): Promise<void> {
  const config = ConfigManager.getInstance().getGwsConfig();
  if (config.enabled === false) return;
  
  // Check gws binary
  if (!isBinaryAvailable('gws')) {
    display.log(`⚠️ gws CLI not found. GWS skills will not function.`);
    return; // Skip sync if binary not available
  }
  
  // Check auth status based on method
  if (config.auth_method === 'oauth') {
    const status = await GwsOAuthManager.getInstance().getStatus();
    if (status.status === 'pending') {
      display.log(`⚠️ GWS OAuth not configured. Skills will prompt for auth on first use.`);
    }
  } else {
    // Service account validation (existing logic)
    if (config.service_account_json && !await fs.pathExists(config.service_account_json)) {
      display.log(`⚠️ Service account JSON not found at: ${config.service_account_json}`);
    }
  }
  
  // ... rest of existing sync logic ...
}
```

---

## File Structure

### New Files
```
src/runtime/gws-oauth/
├─ manager.ts          # Main orchestration logic
├─ types.ts            # GwsOAuthStatus, GwsSetupResult types
└─ scopes.ts           # Scope name mapping constants

src/http/routers/
└─ gws.ts              # GWS OAuth API endpoints
```

### Modified Files
```
src/types/config.ts              # Add auth_method, oauth_scopes
src/config/schemas.ts            # Update GwsConfigSchema
src/config/manager.ts            # Add env var overrides for new fields
src/runtime/gws-sync.ts          # Validate OAuth status
src/runtime/subagents/apoc.ts    # Pre-flight auth check for GWS skills
src/cli/commands/start.ts        # Initialize GwsOAuthManager
src/http/api.ts                  # Mount GWS router
src/ui/src/pages/Settings.tsx    # Add OAuth setup section
```

---

## Testing Strategy

### Unit Tests
- `src/runtime/__tests__/gws-oauth.test.ts` — Manager setup, status, revoke
- `src/config/__tests__/gws-config.test.ts` — Schema validation, env var overrides
- `src/http/__tests__/gws-router.test.ts` — Endpoint request/response shapes

### Integration Tests
- Test `gws auth login --scopes` capture and polling
- Verify token detection against `~/.config/gws/credentials.json`
- Test fallback to service account when OAuth not configured

### Manual Testing
1. Fresh install without any GWS config → run setup → authorize → verify skills work
2. Existing service account setup → confirm no breakage
3. Switch from service account to OAuth → verify both coexist
4. Revoke tokens → verify skills fail gracefully with setup prompt

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `gws` CLI not installed | Clear error message + fallback to service account |
| User abandons OAuth flow | 5-minute timeout + cleanup + retry option |
| Token encryption changes in gws | Read-only detection via `gws auth status` command |
| Windows path differences | Use `os.homedir()` + `path.join()` for cross-platform |
| Scope limitations | Unverified apps limited to ~25 scopes — document in UI |

---

## Rollout Plan

1. **Backend first** — config, manager, router (no UI changes needed initially)
2. **API testing** — manual curl/Postman verification of endpoints
3. **Oracle integration** — add pre-flight checks to Apoc
4. **UI** — Settings page section with status + setup button
5. **Documentation** — update README with OAuth setup guide
6. **Migration guide** — document how to switch from service account to OAuth
