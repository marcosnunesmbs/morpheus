# Webhooks Specification

## Purpose
The webhook system allows external services to trigger Oracle via HTTP. Each webhook has a user-authored prompt and a list of notification channels. When triggered, the payload is appended to the prompt and sent to Oracle for processing.

## Scope
Included:
- Webhook registration and management (CRUD via HTTP API)
- Incoming webhook trigger via HTTP POST
- Prompt + payload composition
- Session ID resolution for webhook context
- Notification delivery to configured channels
- Stale notification recovery on startup

Out of scope:
- Oracle execution logic (covered in `oracle` spec)
- Channel delivery (covered in `channels` spec)
- Task lifecycle (covered in `tasks` spec)

## Requirements

### Requirement: Webhook trigger
The system SHALL accept HTTP POST requests to a webhook's unique URL, extract the body as JSON payload, and dispatch it to Oracle with the webhook's configured prompt.

#### Scenario: Webhook triggered with payload
- GIVEN a webhook `w-abc` exists with prompt "Analyze the following event:"
- WHEN `POST /webhooks/w-abc` is called with `{"event": "deploy.success"}`
- THEN Oracle receives: prompt + JSON payload formatted as a code block

#### Scenario: Unknown webhook
- GIVEN no webhook with the given ID exists
- WHEN the HTTP request arrives
- THEN a 404 response is returned

#### Scenario: Disabled webhook
- GIVEN webhook `w-abc` exists but is disabled
- WHEN the HTTP request arrives
- THEN a 404 or 400 response is returned and no dispatch occurs

### Requirement: Prompt composition
The system SHALL compose the final Oracle prompt by concatenating the webhook's prompt, a separator, and the received payload formatted as a JSON code block with instructions to "Analyze the payload and follow the instructions."

#### Scenario: Prompt built correctly
- GIVEN webhook prompt is "Check if this is a critical alert:"
- WHEN the payload `{"severity": "high"}` is received
- THEN Oracle receives a message combining both, with the payload in a fenced JSON block

### Requirement: Session ID resolution
The system SHALL resolve the session ID for a webhook execution by:
1. Looking for the most recent session associated with the webhook's notification channels (excluding `ui`)
2. Falling back to the most recent active/paused session globally
3. Falling back to `webhook-<webhook_id>`

#### Scenario: Channel session used when available
- GIVEN the webhook has `notification_channels: ['telegram']` and a recent Telegram session exists
- WHEN the webhook fires
- THEN Oracle is called with the most recent Telegram session ID

### Requirement: Result routing
The system SHALL determine whether Oracle delegated the task to a subagent (async) or responded directly, and route accordingly:
- If a task was created with the notification ID: TaskNotifier delivers the result when the task completes
- If no task was created (direct Oracle response): result is persisted immediately and channels are notified

#### Scenario: Async delegation — notifier delivers result
- GIVEN Oracle delegates to Apoc and creates a task tagged with the notification ID
- WHEN the task completes
- THEN TaskNotifier updates the webhook notification and sends the result to configured channels

#### Scenario: Direct Oracle response — immediate notification
- GIVEN Oracle responds directly without delegation
- WHEN dispatch completes
- THEN the notification is marked `completed` and channels are notified immediately

### Requirement: Channel notifications
The system SHALL send the webhook result to all `notification_channels` configured on the webhook, skipping `ui` (which is served via session polling).

#### Scenario: Notification sent to Telegram
- GIVEN `notification_channels: ['telegram', 'ui']` and Telegram is registered
- WHEN the webhook result is ready
- THEN Telegram receives the result message prefixed with `✅ Webhook: <name>`
- AND `ui` is silently skipped

#### Scenario: Failed webhook notified
- GIVEN the webhook execution throws an exception
- WHEN the error is caught
- THEN channels receive `❌ Webhook: <name>` with the error message

### Requirement: Stale notification recovery
The system SHALL recover webhook notifications stuck in `pending` state for more than 2 minutes on startup, re-dispatching them unless an active task already exists.

#### Scenario: Stale notification re-dispatched
- GIVEN a notification has been `pending` for 3 minutes (from a previous crash)
- WHEN the daemon starts and `WebhookDispatcher.recoverStale()` runs
- THEN the notification is re-dispatched to Oracle sequentially

#### Scenario: Active task skips recovery
- GIVEN a stale notification has a task with `status = 'running'`
- WHEN recovery runs
- THEN the notification is skipped (task is still in progress)

### Requirement: Webhook CRUD
The system SHALL expose HTTP endpoints to create, list, update, enable/disable, and delete webhooks.

#### Scenario: Webhook created
- GIVEN valid webhook data (name, prompt, notification_channels)
- WHEN `POST /api/webhooks` is called
- THEN a webhook is created with a unique ID and a unique trigger URL is returned

#### Scenario: Webhook deleted
- GIVEN a webhook exists
- WHEN `DELETE /api/webhooks/:id` is called
- THEN the webhook and its notification history are removed
