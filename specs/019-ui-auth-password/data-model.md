# Data Model: UI Authentication

## Entities

### Session (Client-Side)
*Represents the authenticated state of the UI.*

| Field | Type | Description | Storage |
|-------|------|-------------|---------|
| `token` | string | The password value provided by the user. | `localStorage` |

### Configuration (Server-Side)
*Represents the source of truth for authentication.*

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `THE_ARCHITECT_PASS` | string | The master password to unlock the UI. | `process.env` |

## Validation Rules

### Password Logic
1.  **Empty Environment Variable**:
    - Auth is **DISABLED**.
    - All requests are allowed.
2.  **Set Environment Variable**:
    - Auth is **ENABLED**.
    - Requests without matching `X-Architect-Pass` header are rejected.
    - Comparison is **case-insensitive** (typically headers are, but the value should be case-sensitive. Let's make the *value* case-sensitive for security).

### Header Validation
- Header Name: `X-Architect-Pass` (or `x-architect-pass`)
- Header Value: Must match `process.env.THE_ARCHITECT_PASS` exactly.