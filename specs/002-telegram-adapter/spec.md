# Feature Specification: Telegram Channel Adapter

**Feature Branch**: `002-telegram-adapter`
**Created**: 2026-01-29
**Status**: Draft
**Input**: Implement Telegram Channel Adapter and CLI interaction for API key configuration.

## User Scenarios & Testing

### User Story 1 - Secure Configuration (Priority: P1)

So that I can connect my agent to Telegram, I want to easily configure the Bot Token via the CLI without manually editing YAML files.

**Why this priority**: Configuration is the prerequisite for connection. A CLI command is requested by the user and improves DX.

**Independent Test**: Can be tested by running the config command and verifying `config.yaml` is updated correctly.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** I runs `morpheus config set channels.telegram.token <MY_TOKEN>`, **Then** the `config.yaml` is updated with the token.
2. **Given** a configured token, **When** I run `morpheus config set channels.telegram.enabled true`, **Then** the adapter is enabled.
3. **Given** no config file, **When** I configure a value, **Then** the file is created with defaults + my change.

### User Story 2 - Adapter Lifecycle (Priority: P1)

So that my agent is reachable, I want the Telegram Bot to connect automatically when I start Morpheus.

**Why this priority**: Core functionality of the adapter.

**Independent Test**: Can be tested by running `morpheus start` and checking console logs for connection success.

**Acceptance Scenarios**:

1. **Given** enabled telegram config, **When** I run `morpheus start`, **Then** I see "Telegram Adapter: Connected (@BotName)" in the logs.
2. **Given** disabled telegram config, **When** I run `morpheus start`, **Then** the Telegram adapter does not start.
3. **Given** invalid token, **When** I run `morpheus start`, **Then** the process logs an error but does not crash (or crashes gracefully if critical).

### User Story 3 - Message Reception (Priority: P2)

So that I know my agent is listening, I want to see incoming messages logged in the console.

**Why this priority**: Verifies the read-loop is working.

**Independent Test**: Can be tested by sending a message to the bot from a mobile phone and watching the CLI output.

**Acceptance Scenarios**:

1. **Given** running agent, **When** I send "Hello" to the bot on Telegram, **Then** the CLI console shows `[Telegram] User: Hello`.

## Functional Requirements

### CLI
- [ ] Implement `morpheus config set <key> <value>` command.
- [ ] Support dot-notation for keys (e.g., `channels.telegram.token`).
- [ ] Validate value types based on schema (boolean/string/number).

### Runtime
- [ ] Create `TelegramAdapter` class in `src/channels/telegram.ts`.
- [ ] Implement `connect()` method using `telegraf` (polling mode).
- [ ] Implement `disconnect()` method to stop polling.
- [ ] Handle `message` events and log them to stdout.
- [ ] Integrate adapter into `src/cli/commands/start.ts` lifecycle.

## Success Criteria

- **Configuration**: User can fully configure Telegram via CLI commands.
- **Connectivity**: Bot connects successfully `polling_error` handled gracefully.
- **Observability**: Incoming messages are visible in the terminal.

## Assumptions

- We are using `polling` mode (not webhooks) as Morpheus is local-first/behind NAT.
- No conversational logic (LangChain) is implemented in this phase; just "Connectivity & Echo/Log".
- Token is stored in plain text in `config.yaml` (or user can use `env:VAR` pattern, but CLI `set` will write string literal), unless we implement encrypted storage, which is out of scope for now.

## Key Entities

- **TelegramAdapter**: Manages the bot instance.
- **ConfigManager**: updated to support partial updates via key path.
