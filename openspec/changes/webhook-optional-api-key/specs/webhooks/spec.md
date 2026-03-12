## ADDED Requirements

### Requirement: Optional API Key Authentication
The system SHALL allow configuring a webhook to accept requests without an API key. By default, all webhooks MUST require an API key.

#### Scenario: Create webhook with optional authentication
- **WHEN** a user creates a new webhook with `requires_api_key` set to `false`
- **THEN** the webhook is persisted with the flag disabled
- **AND** the UI indicates that the webhook is public/unsecured.

#### Scenario: Trigger webhook without API Key
- **GIVEN** a webhook configured with `requires_api_key: false`
- **WHEN** a POST request is sent to the trigger URL without the `x-api-key` header
- **THEN** the system accepts the request (HTTP 202)
- **AND** a notification is created.

#### Scenario: Enforce API Key when required
- **GIVEN** a webhook configured with `requires_api_key: true`
- **WHEN** a POST request is sent to the trigger URL without the `x-api-key` header
- **THEN** the system rejects the request (HTTP 401).

#### Scenario: UI Display of Public Webhooks
- **GIVEN** a webhook with `requires_api_key: false`
- **WHEN** the user views the webhook details or list
- **THEN** the cURL example does NOT include the `-H "x-api-key: ..."` header.
