# Feature Specification: Unified Terminal Output Manager

**Feature Branch**: `003-terminal-ui-manager`
**Created**: 2026-01-29
**Status**: Draft
**Input**: User description: "o bot está rodando porém o console log não é visível quando o morpheus está rodando no terminal. precisamos de uma interface que possamos enviar mensagens pro terminal (feedback pro usuário) dos canais, do langchain e do painel web"

## User Scenarios & Testing

### User Story 1 - Clear Logging During Spinner Activity (Priority: P1)

The user wants to see logs (Telegram messages, system events) clearly in the terminal, even when the main "Agent is thinking/waiting" spinner is active. Currently, logs might be overwritten or hidden.

**Why this priority**: It solves the immediate visibility bug reported by the user.

**Independent Test**: Can be tested by starting the agent (spinner active) and simulating a log event (e.g., config change or incoming message). The log should appear above the spinner without breaking the layout.

**Acceptance Scenarios**:

1. **Given** the agent is running with a spinner active, **When** a new log message arrives, **Then** the spinner should pause, the message should print on a new line, and the spinner should resume at the bottom.
2. **Given** the agent is running, **When** multiple messages arrive rapidly, **Then** all should be legible and sequential.

---

### User Story 2 - Source-Tagged Feedback (Priority: P1)

The user needs to know where a message is coming from (Telegram, Internal System, Web UI, LangChain).

**Why this priority**: Essential for debugging and user awareness of who is talking.

**Independent Test**: Can be tested by invoking the logging API with different source labels.

**Acceptance Scenarios**:

1. **Given** a message from Telegram, **When** it is logged, **Then** it should display with a `[Telegram]` prefix (or similar visual distinction).
2. **Given** a message from the Web UI, **When** it is logged, **Then** it should display with a `[Web]` prefix.

---

### User Story 3 - Unified Logging Interface (Priority: P2)

Developers need a simple, unified interface to send messages to the terminal from any part of the application (Channels, LangChain, etc.) without managing `console.log` or `ora` directly.

**Why this priority**: Ensures maintainability and consistent behavior across the codebase.

**Independent Test**: Can be tested by replacing `console.log` in `TelegramAdapter` with the new interface.

**Acceptance Scenarios**:

1. **Given** the `TelegramAdapter`, **When** it receives a message, **Then** it calls `DisplayManager.log()` instead of `console.log`.

---

### Edge Cases

- **Concurrent Logs**: What happens if two sources log at the exact same millisecond? (Should be serialized by nature of Node.js event loop, but UI should handle it).
- **Spinner Not Active**: What if the spinner isn't running? (Logs should just print normally).
- **Error States**: How are stack traces handled? (Should probably bypass spinner logic or be printed clearly).

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a singleton `DisplayManager` (or similar) to handle all terminal output.
- **FR-002**: `DisplayManager` MUST be able to start, stop, and update a global operation spinner.
- **FR-003**: `DisplayManager` MUST expose methods for logging at different levels: `info`, `success`, `warning`, `error`.
- **FR-004**: `DisplayManager` MUST strictly handle output collision with the spinner (Stop Spinner -> Print Log -> Restart Spinner).
- **FR-005**: Logs MUST support a "Source" field to prefix messages (e.g., `[Telegram]`, `[AI]`).
- **FR-006**: Existing components (`TelegramAdapter`, `start` command) MUST be refactored to use `DisplayManager` instead of `console.log` or direct `ora` usage.

### Success Criteria

- **SC-001**: 100% of Telegram messages received during an active spinner session are visible in the terminal.
- **SC-002**: Zero visual artifacts (half-written spinner lines) when logging occurs.
- **SC-003**: The output includes clear source attribution (e.g. `[Telegram]`) for all messages.

### Key Entities

- **DisplayManager**: The central class managing CLI state.
- **LogEntry**: Internal representation (optional) of a log with `timestamp`, `source`, `level`, `message`.
