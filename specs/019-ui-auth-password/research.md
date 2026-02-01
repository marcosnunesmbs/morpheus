# Research: UI Authentication with Environment Variable

**Feature Branch**: `019-ui-auth-password`
**Status**: Completed

## 1. Authentication Source
**Decision**: Use `process.env.THE_ARCHITECT_PASS` directly in the backend middleware.
**Rationale**: 
- Simplicity: Does not require changing the public `config.yaml` schema or risking exposure of the password in the `/api/config` endpoint.
- Security: Keeps secrets out of the persisted user configuration file.
**Alternatives Considered**:
- *Hash in config.yaml*: Would allow changing password via UI, but adds complexity (salt/hash management) and potential for lockout.
- *Separate auth.json*: Overkill for a single password.

## 2. API Protection Strategy
**Decision**: Middleware applied specifically to `/api` routes.
**Rationale**: The frontend static assets (`index.html`, `js`, `css`) must remain public so the Login page can actually load.
**Implementation Detail**:
```typescript
// src/http/server.ts
this.app.use('/api', authMiddleware, createApiRouter());
```

## 3. Frontend Architecture
**Decision**: Introduce `src/ui/src/services/api.ts` (or `client.ts`) as a singleton wrapper around `fetch`.
**Rationale**: 
- Currently, services use raw `fetch`. We need a centralized place to inject the `X-Architect-Pass` header and catch 401 errors globally.
- Avoids scattering auth logic across every component/service.

## 4. Session Persistence
**Decision**: `localStorage` in the browser.
**Key**: `morpheus.auth.token`
**Rationale**: Standard practice for non-sensitive local apps. Persists across refreshing.

## 5. Unknowns Resolved
- **Express Setup**: Confirmed `setupRoutes` in `server.ts` is the correct injection point.
- **Router**: Confirmed `react-router-dom` is used. Easy to add `/login` route.
- **Config**: Confirmed `ConfigManager` is distinct from Env handling, so we'll bypass it for this specific secret.