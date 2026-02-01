# Feature Specification: Advanced UI Configuration and Statistics

**Feature Branch**: `016-ui-config-stats`
**Created**: 2026-02-01
**Status**: Draft
**Input**: User description: "Precisamos colocar na ui a configuração de limit memory (pode ser na sessão de configuração de llm) e a configuração de áudio em sessãos eparada, além disso colocque no dash board um somatório dos metadados de total de inputs, total de outputs de todas as mensagens já trocadas"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure LLM Memory Limit (Priority: P1)

The user needs to control the memory usage (context window) of the LLM to manage costs and performance. They should be able to set a specific limit on the memory (tokens) used during interactions.

**Why this priority**: managing context size is critical for cost control and preventing errors with limited-context models.

**Independent Test**: Can be fully tested by changing the "Memory Limit" setting in the UI, ensuring it persists after a reload, and verifying the Agent respects this limit during conversation (conceptually).

**Acceptance Scenarios**:

1. **Given** the user is on the Settings > LLM page, **When** they enter a valid number in "Memory Limit", **Then** the save button becomes active.
2. **Given** a valid memory limit is entered, **When** the user clicks Save, **Then** the value is persisted and reloads correctly.
3. **Given** the user enters an invalid number (e.g., negative), **When** they try to save, **Then** an error message is displayed.

---

### User Story 2 - Configure Audio Settings (Priority: P1)

The user wants to configure audio transcription services in a dedicated section, distinct from general LLM settings, to enable voice interaction features.

**Why this priority**: enabling audio capabilities is a core feature expansion for the agent.

**Independent Test**: Can be fully tested by navigating to the new "Audio" settings tab, configuring a provider, and saving.

**Acceptance Scenarios**:

1. **Given** the user is on the Settings page, **When** they look for "Audio" configuration, **Then** they see a dedicated section or tab.
2. **Given** the user is in the Audio settings, **When** they select a valid provider and model, **Then** the settings can be successfully saved.

---

### User Story 3 - View Usage Statistics on Dashboard (Priority: P2)

The user wants to track the total volume of interactions to understand usage patterns and potential costs. They need a summary of total input and output tokens across all history.

**Why this priority**: provides visibility into system usage and helps user estimate costs.

**Independent Test**: Can be tested by sending new messages and observing the counters increment on the dashboard.

**Acceptance Scenarios**:

1. **Given** the user is on the Dashboard, **When** the page loads, **Then** widgets for "Total Input Tokens" and "Total Output Tokens" are displayed.
2. **Given** existing message history, **When** the dashboard loads, **Then** the numbers reflect the sum of tokens from all messages.
3. **Given** the user sends a new message, **When** they refresh the dashboard, **Then** the token counts increase by the amount used in the new transaction.

### Edge Cases

- What happens when no messages exist? Statistics should display 0.
- What happens if a message has no token metadata? It should be treated as 0 or estimated (system should handle null gracefully).
- What happens if "Memory Limit" is set extremely low? The Agent logic should handle it (outside UI scope, but UI should arguably warn or enforce a minimum).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: UI MUST provide a configuration field for "Memory Limit" (Max Context Tokens) within the LLM Settings section.
- **FR-002**: UI MUST provide a separate configuration section/tab for "Audio" settings.
- **FR-003**: Audio configuration MUST allow selecting a Provider and specific configuration (e.g. Model).
- **FR-004**: System MUST aggregate usage statistics (Input Tokens, Output Tokens) from the metadata of all stored messages.
- **FR-005**: Dashboard MUST display the total aggregated "Input Tokens" and "Output Tokens".
- **FR-006**: The statistics aggregation MUST be performant enough to not block dashboard loading.

### Key Entities *(include if feature involves data)*

- **Configuration**: Updated schema to include `llm.memoryLimit` (or equivalent) and `audio` section.
- **Message Metadata**: Source of truth for generic `input_tokens` and `output_tokens` fields.

### Assumptions

- "Limit memory" refers to the maximum context window size (tokens) or maximum history messages.
- Token usage data is available in the message metadata for past messages.
- Audio settings primarily require Provider and Model selection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can successfully save and persist "Memory Limit" setting.
- **SC-002**: User can successfully save and persist Audio configuration in a dedicated section.
- **SC-003**: Dashboard Usage Statistics widgets display non-negative integers representing total token counts.
- **SC-004**: Usage statistics reflect 100% of the token usage recorded in the database metadata.
