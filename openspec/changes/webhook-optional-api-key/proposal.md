## Why

Currently, webhooks require an `x-api-key` header for authentication. This restriction prevents integration with third-party services that do not support custom headers in their webhook configuration (e.g., legacy systems, simple notification services). Making the API key requirement optional allows broader compatibility while maintaining security by default.

## What Changes

- Add `requires_api_key` boolean field to the `Webhook` model (default: `true`).
- Update `POST /trigger/:webhook_name` to validate the API key only if `requires_api_key` is true.
- Update `POST /api/webhooks` and `PUT /api/webhooks/:id` to accept `requires_api_key`.
- Update the UI (`WebhookManager`) to allow toggling this setting.
- Update the UI to dynamically show/hide the `x-api-key` header in the cURL example.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `webhooks`: Allow configuring webhooks to trigger without an API key.

## Impact

- **Backend**: `src/http/webhooks-router.ts`, `src/runtime/webhooks/repository.ts`, `src/runtime/webhooks/types.ts`.
- **Frontend**: `src/ui/src/pages/WebhookManager.tsx`, `src/ui/src/services/webhooks.ts`.
- **Database**: Migration needed to add `requires_api_key` column to `webhooks` table.
