# Feature Specification: Chat History Configuration

**Feature Branch**: `017-chat-memory-config`
**Created**: 2026-02-01
**Status**: Draft
**Input**: User description: "coloque nas configurações as configurações de chat, e coloque a opção de modificar o vamor de memory.limit: que é a quantidade de mensagens a serem carregadas como histórico em cada iteração de conversa"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Chat History Limit (Priority: P1)

The user wants to control the "short-term memory" of the agent by defining how many previous messages are sent to the LLM during a conversation. This allows balancing context relevance against token costs and latency.

**Why this priority**: Core configuration for regulating agent behavior and cost.

**Independent Test**: Can be tested by changing the "History Message Limit" in Settings, saving, and verifying the `config.yaml` is updated.

**Acceptance Scenarios**:

1. **Given** the user is on the Settings page, **When** they navigate to the "Memory" (or "Chat") section, **Then** they see an input for "History Limit" (Messages).
2. **Given** the user enters a valid number (e.g., 10), **When** they save, **Then** the value is persisted.
3. **Given** the user enters an invalid number (e.g., 0 or negative), **When** they save, **Then** an error is shown.

### Edge Cases

- **Extremely high limit**: System should allow it, but performance might degrade (SQLite query time).
- **Limit = 1**: Minimal memory (last message only).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: UI MUST provide a configuration field for `memory.limit`.
- **FR-002**: The setting MUST be labeled clearly as "Message History Limit" (or similar) to distinguish it from "Token Limit".
- **FR-003**: The input MUST only accept positive integers (minimum 1).
- **FR-004**: The default value matches the system default (100).

### Key Entities *(include if feature involves data)*

- **Configuration**: Uses existing `memory.limit` path in `MorpheusConfig`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can successfully update the `memory.limit` value via the UI.
- **SC-002**: The UI accurately reflects the current value from `config.yaml`.
