## 1. Backend Implementation

- [x] 1.1 Update `Webhook` interface in `src/runtime/webhooks/types.ts` to include `requires_api_key` (boolean).
- [x] 1.2 Update `WebhookRepository` in `src/runtime/webhooks/repository.ts` to handle schema migration (add `requires_api_key` column if missing).
- [x] 1.3 Update `WebhookRepository.createWebhook` to persist `requires_api_key`.
- [x] 1.4 Update `WebhookRepository.updateWebhook` to persist `requires_api_key`.
- [x] 1.5 Update `WebhookRepository.getAndValidateWebhook` to retrieve the webhook even if `api_key` is not provided, but only if `requires_api_key` is false.
- [x] 1.6 Update `CreateWebhookSchema` and `UpdateWebhookSchema` in `src/http/webhooks-router.ts` to include the new field.
- [x] 1.7 Update `POST /trigger/:webhook_name` logic in `src/http/webhooks-router.ts` to conditionally validate the API key.
- [x] 1.8 Update `WebhookDispatcher.buildPrompt` in `src/runtime/webhooks/dispatcher.ts` to implement payload isolation and guard against prompt injection.


## 2. Frontend Implementation

- [x] 2.1 Update `Webhook` interface and payloads in `src/ui/src/services/webhooks.ts` to include `requires_api_key`.
- [x] 2.2 Update `WebhookManager.tsx` component state to initialize `requires_api_key` (default true).
- [x] 2.3 Add "Require API Key" toggle to the Create/Edit Webhook modal in `WebhookManager.tsx`.
- [x] 2.4 Update the Webhook list in `WebhookManager.tsx` to indicate if a webhook is public/unsecured.
- [x] 2.5 Update the cURL command generator in `WebhookManager.tsx` to conditionally include the `x-api-key` header.
