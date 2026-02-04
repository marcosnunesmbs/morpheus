# Sati API Endpoints

## Overview
Backend API endpoints for reading and updating Sati agent configuration, mirroring the pattern used for Oracle LLM configuration.

## User Stories

### P1: Fetch Sati Configuration
**As a** Settings UI component  
**I want** to fetch current Sati configuration via API  
**So that** I can populate the form with existing values

**Acceptance Criteria:**
- GET `/api/config/sati` returns Sati config object
- Response includes: `provider`, `model`, `api_key`, `memory_limit`, `context_window`
- Falls back to Oracle config if no Sati config exists (via `ConfigManager.getSantiConfig()`)
- Requires `THE_ARCHITECT_PASS` header if environment variable is set
- Returns 200 on success with JSON body

### P1: Update Sati Configuration
**As a** Settings UI component  
**I want** to save Sati configuration via API  
**So that** users' changes persist to the config file

**Acceptance Criteria:**
- POST `/api/config/sati` with JSON body updates config
- Accepts fields: `provider`, `model`, `api_key`, `memory_limit`, `context_window`
- Validates using `LLMConfigSchema` (same as Oracle config)
- Writes to `santi` key in config file via `ConfigManager.updateConfig()`
- Returns 200 on success
- Returns 400 on validation error with error details
- Requires `THE_ARCHITECT_PASS` header if environment variable is set

### P2: Delete Sati Configuration
**As a** Settings UI component (toggle "Use Oracle config")  
**I want** to remove Sati config to fall back to Oracle  
**So that** users can easily revert to shared configuration

**Acceptance Criteria:**
- DELETE `/api/config/sati` removes `santi` key from config file
- Returns 200 on success
- Requires `THE_ARCHITECT_PASS` header if environment variable is set
- Subsequent GET returns Oracle config (fallback behavior)

## Functional Requirements

**FR-API-01** MUST implement GET `/api/config/sati` endpoint
- Returns current Sati config or Oracle config as fallback
- Schema: `{ provider, model, api_key, memory_limit, context_window }`

**FR-API-02** MUST implement POST `/api/config/sati` endpoint
- Accepts JSON body matching `LLMConfigSchema`
- Validates request body before writing to config
- Updates `santi` key in config file

**FR-API-03** MUST implement DELETE `/api/config/sati` endpoint
- Removes `santi` key from config file
- Allows fallback to Oracle config

**FR-API-04** All endpoints MUST respect `THE_ARCHITECT_PASS` authentication
- Check `x-architect-pass` header if env var is set
- Return 401 Unauthorized if header missing or incorrect
- Skip auth check if env var not set

**FR-API-05** MUST use `ConfigManager` singleton for all config operations
- `ConfigManager.getSantiConfig()` for GET
- `ConfigManager.updateConfig({ santi: {...} })` for POST
- `ConfigManager.updateConfig({ santi: undefined })` for DELETE

**FR-API-06** POST endpoint MUST validate request body using Zod
- Use `LLMConfigSchema.parse()` to validate
- Return 400 with validation errors on failure

## Edge Cases

**EC-01** GET request when no Sati config exists
- Response should return Oracle config values (fallback)
- Should NOT return 404
- Response should match same schema as if Sati config existed

**EC-02** POST with partial config object
- All fields should be optional (schema allows partial updates)
- Missing fields preserve existing values or use Oracle fallback

**EC-03** POST with invalid provider value
- Return 400 with error: "Invalid provider. Must be one of: openai, anthropic, google, ollama"

**EC-04** DELETE when no Sati config exists
- Should succeed (idempotent)
- Return 200

**EC-05** Config file write failure (permissions, disk full, etc.)
- Return 500 Internal Server Error
- Log error with DisplayManager
- Don't corrupt existing config file

**EC-06** Concurrent config updates
- Last write wins (no locking mechanism)
- Acceptable risk (single-user daemon)

## Non-Functional Requirements

**NFR-01** Endpoints MUST respond within 200ms under normal conditions

**NFR-02** Validation errors MUST return clear, actionable messages

**NFR-03** All errors MUST be logged via `DisplayManager` (not `console.log`)

**NFR-04** Config writes MUST be atomic (write to temp file, then rename)

## API Specification

### GET `/api/config/sati`

**Response 200:**
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "api_key": "sk-...",
  "memory_limit": 50,
  "context_window": 100
}
```

**Response 401:**
```json
{
  "error": "Unauthorized"
}
```

### POST `/api/config/sati`

**Request Body:**
```json
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "api_key": "sk-ant-...",
  "memory_limit": 30,
  "context_window": 50
}
```

**Response 200:**
```json
{
  "success": true
}
```

**Response 400:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["provider"],
      "message": "Invalid enum value. Expected 'openai' | 'anthropic' | 'google' | 'ollama', received 'invalid'"
    }
  ]
}
```

**Response 401:**
```json
{
  "error": "Unauthorized"
}
```

### DELETE `/api/config/sati`

**Response 200:**
```json
{
  "success": true
}
```

**Response 401:**
```json
{
  "error": "Unauthorized"
}
```

## Dependencies
- `ConfigManager` singleton (`src/config/manager.ts`)
- `LLMConfigSchema` from `src/config/schemas.ts`
- Express HTTP server (`src/http/server.ts`)
- Authentication middleware for `THE_ARCHITECT_PASS`

## Success Metrics
- GET endpoint returns correct fallback behavior
- POST endpoint validates and persists config correctly
- DELETE endpoint properly removes Sati config
- Authentication works consistently with existing endpoints
