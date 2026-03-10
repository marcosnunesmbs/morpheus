# Feature Specification: Improve Message Persistence & Usage Metadata

**Feature Branch**: `015-persist-tool-usage`  
**Created**: 2026-02-01  
**Status**: Draft  
**Input**: User description: "Vamos melhorar a forma de persistir a mensagens no banco de dados. Queremos agora salvar as mensagens que são de tools no histórico também. Ao receber a resposta do invoke devemos avaliar todas as mensagens depois da mensagem que criamos (userMessage) e adicionar ao histórico e retorna pro canal a última mensagem da IA. Devemos agora salvar no banco de dados usage_metadata (input_tokens, output_tokens, total_tokens, input_token_details.cache_read). Coloque cada tipo de metadata em uma coluna do histórico. Faça isso tanto pra agente quanto pra agente de áudio."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persist Tool Execution History (Priority: P1)

Users (and the system) need a complete record of the conversation, including the intermediate steps where the Agent uses tools to gather information. This ensures context is preserved and the logic is transparent.

**Why this priority**: Essential for debugging, auditing, and maintaining context in long conversations involving multiple tool steps.

**Independent Test**: Can be fully tested by invoking a command that triggers a tool (e.g., "check price of BTC") and verifying that the database contains the User message, the Tool invocation (thought/action), the Tool output, and the final AI response.

**Acceptance Scenarios**:

1. **Given** a user asks a question requiring a tool (e.g., "What is the price of Bitcoin?"), **When** the agent runs the tool and answers, **Then** the system history MUST contain: the user query, the tool call message, the tool result message, and the final agent answer.
2. **Given** a restart of the application, **When** the user views history, **Then** all tool interactions from previous sessions are visible.

---

### User Story 2 - Track Token Usage Metadata (Priority: P1)

Business stakeholders and users need visibility into the cost and resource consumption of their queries, granularly tracked per interaction.

**Why this priority**: Critical for cost monitoring and optimization (cache hits vs misses).

**Independent Test**: Perform a query and check the database record for that interaction to ensure `input_tokens`, `output_tokens`, `total_tokens`, and `cache_read_tokens` are non-zero (or correct values).

**Acceptance Scenarios**:

1. **Given** a standard text interaction, **When** the agent responds, **Then** the associated message record in storage includes valid counts for input, output, and total tokens.
2. **Given** a query that utilizes context caching, **When** processing is complete, **Then** the `cache_read_tokens` field reflects the cached content usage.

---

### User Story 3 - Audio Agent Usage Tracking (Priority: P2)

Audio transcription activities must also be tracked for resource usage, similar to text interactions.

**Why this priority**: To have a unified view of all AI costs, including voice inputs.

**Independent Test**: Send a voice note, wait for transcription/response, and verify usage metadata is recorded for the audio processing step.

**Acceptance Scenarios**:

1. **Given** a voice message is sent to the system, **When** it is transcribed by the Audio Agent, **Then** the inputs/outputs used for transcription are recorded in the usage history.

### Edge Cases

- **Tool Failure**: If a tool fails (throws error), the error message/state should still be persisted in history to show what happened.
- **Zero Usage**: If an interaction somehow reports zero tokens (e.g. mock), the system should record 0 rather than failing or null.
- **Provider API Changes**: If the provider changes usage keys, the system should default to 0 or mapping available fields.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist all intermediate messages generated during an Agent execution chain (specifically Tool Calls and Tool Outputs) to the persistent storage.
- **FR-002**: System MUST capture the logic flow: evaluate all messages generated *after* the initial User Message and append them to the history in order.
- **FR-003**: System MUST return the final AI message (the answer) to the output channel (CLI/Telegram) after persisting the full chain.
- **FR-004**: System MUST extend the message storage schema to include specific columns for usage metadata: `input_tokens`, `output_tokens`, `total_tokens`, and `cache_read_tokens`.
- **FR-005**: System MUST extract and save these usage metrics from the LLM provider's response for every text generation interaction.
- **FR-006**: System MUST persist usage metadata for Audio Agent transcription tasks (input/output tokens associated with the transcription request).
- **FR-007**: System MUST handle cases where `input_token_details` or `cache_read` are missing from the response (defaulting to 0/null as appropriate).

### Success Criteria

1. **Completeness**: 100% of tool invocations in a test session are retrievable from the database.
2. **Data Integrity**: Usage metadata is present for >95% of successful LLM interactions (allowing for provider outages/missing headers).
3. **Visibility**: Usage costs (tokens) can be queried and summed up per user or session from the database.

### Key Entities

- **ChatMessage Record**:
  - **Role**: (user, assistant, tool, system)
  - **Content**: Text payload
  - **Input Tokens**: Count of tokens sent to model (Integer, nullable)
  - **Output Tokens**: Count of tokens generated (Integer, nullable)
  - **Total Tokens**: Sum of tokens (Integer, nullable)
  - **Cache Read Tokens**: Count of tokens read from cache (Integer, nullable)
  - **Timestamp**: Time of creation

## Assumptions

- The underlying database (SQLite) supports adding new columns or the user accepts a migration/schema update.
- The LLM provider (Gemini/others) returns usage metadata in a standard format or the `generateContent` response payload is accessible.
- Audio transcription via Google GenAI returns compatible usage metadata.
