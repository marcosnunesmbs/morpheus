## Context

The current webhook implementation strictly enforces API key validation via the `x-api-key` header. This limits the usability of webhooks with external services that do not support custom headers. We need to introduce a mechanism to make this validation optional per webhook.

## Goals / Non-Goals

**Goals:**
- Allow users to configure webhooks that do not require an API key.
- Maintain backward compatibility (existing webhooks require API key).
- secure default (new webhooks default to requiring API key).
- Provide visual indication in UI for unsecured webhooks.

**Non-Goals:**
- Implementing other authentication methods (e.g., Basic Auth, HMAC).
- Changing the existing URL structure for triggers.

## Decisions

### Database Schema
We will add a `requires_api_key` column to the `webhooks` table.
- Type: `INTEGER` (0 or 1, representing boolean).
- Default: `1` (true).
- Migration: We will update `ensureTables` in `WebhookRepository` to add this column if it doesn't exist.

### API Logic
The `/trigger/:webhook_name` endpoint logic will be modified:
1. Retrieve webhook by name.
2. Check `requires_api_key` flag.
3. If `true`: require `x-api-key` header and validate against stored key.
4. If `false`: proceed without header validation.

### UI / UX
- **Create/Edit Modal**: Add a "Require API Key" toggle switch. Default state is "On".
- **List View**: Add an icon or badge indicating "Public" status for webhooks without API key requirement.
- **cURL Example**: Conditionally render the `-H "x-api-key: ..."` line based on the setting.

### Prompt Safety (Payload Isolation)
To mitigate prompt injection from incoming payloads (especially in public webhooks), the `WebhookDispatcher` will wrap the user prompt and payload in a structured format:
1. It will clearly label the user-defined prompt as the source of instructions.
2. It will explicitly mark the payload as DATA only.
3. It will add a system-level directive to the Oracle to ignore any instructions found within the payload data.

## Risks / Trade-offs

- **Security Risk**: Webhooks without API keys are publicly triggerable by anyone who knows the URL slug.
    - *Mitigation*: The default setting will be "Require API Key". The UI will clearly label unsecured webhooks.
- **Migration**: Existing rows in SQLite need the new column.
    - *Mitigation*: The `ensureTables` method typically handles `CREATE TABLE IF NOT EXISTS`. For adding a column to an existing table, we might need a specific `ALTER TABLE` check or rely on `user_version` migration if the repository supported it. Given the current simple `ensureTables` pattern, we can check for the column's existence using `PRAGMA table_info` and run `ALTER TABLE` if missing.
