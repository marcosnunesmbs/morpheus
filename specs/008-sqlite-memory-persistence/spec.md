# Feature Specification: SQLite Memory Persistence for LangChain

**Feature Branch**: `008-sqlite-memory-persistence`
**Created**: 2026-01-29
**Status**: Draft
**Input**: User description: "Agora precisamos gerenciar as memórias de curto prazo do LangChain https://docs.langchain.com/oss/javascript/langchain/short-term-memory Vamos usar sqlite com o arquivo short-memory.db salvo em ~/.mortpheus/memory/ Pesquise com context7 se preciso for sobre shor term memory em langchain A ideia é salvar o hisórico de conversas do usuário para ser carregado ao iniciar o Morpheus e manter atualizado durante as conversas"

## User Scenarios & Testing

### User Story 1 - Persist Conversation History (Priority: P1)

As a user, I want my conversation history to be saved to a persistent storage as I chat, so that I don't lose the context of my work if I restart the application or computer.

**Why this priority**: Core requirement for long-running assistant usage. Without persistence, the agent is amnesic between sessions.

**Independent Test**:
1. Run `morpheus start`.
2. Send a message "My name is Alice".
3. Wait for reply.
4. Stop `morpheus`.
5. Check if `~/.morpheus/memory/short-memory.db` exists and has grown in size or contains the text (using sqlite tool).

**Acceptance Scenarios**:

1. **Given** a new installation, **When** I start a chat and send "Hello", **Then** a `short-memory.db` file is created in `~/.morpheus/memory/` and the message is saved.
2. **Given** an existing chat session with history, **When** I send a new message, **Then** both the user message and the agent response are appended to the database immediately.

### User Story 2 - Restore Context on Startup (Priority: P1)

As a user, I want the agent to remember what we discussed in previous sessions when I start it up again, so that I don't have to repeat information.

**Why this priority**: Essential for continuity of tasks.

**Independent Test**:
1. Start `morpheus`.
2. Say "Remember the secret code is 1234".
3. Stop `morpheus`.
4. Start `morpheus`.
5. Ask "What is the secret code?".
6. Agent replies "The secret code is 1234".

**Acceptance Scenarios**:

1. **Given** a persisted history with "My name is Bob", **When** I restart Morpheus and ask "What is my name?", **Then** the agent replies "Your name is Bob".
2. **Given** a corrupted or missing database file, **When** I start Morpheus, **Then** it starts with a fresh empty memory and MUST log a warning to the console, but doesn't crash.

### User Story 3 - Memory Management (Priority: P2)

As a user, I want to be able to clear the memory, so that I can start a fresh context when switching tasks.

**Why this priority**: Users need control over the context window and privacy.

**Independent Test**:
1. Having populated history.
2. Trigger the "clear memory" functionality (via available command or internal method).

**Acceptance Scenarios**:

1. **Given** a populated database, **When** I trigger a memory clear (e.g. internal command or programmatic call), **Then** the database table is truncated and the agent acts as if it's the first execution.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST use SQLite as the backing store for conversation history.
- **FR-002**: The database file MUST be located at `~/.morpheus/memory/short-memory.db` (expanding `~` to the user's home directory).
- **FR-003**: The system MUST automatically create the `memory` directory and the database file if they do not exist on startup.
- **FR-004**: The system MUST load all previous conversation messages from the database into the Agent's context upon initialization.
- **FR-005**: The system MUST save every new HumanMessage and AIMessage to the database as soon as they are generated/received.
- **FR-006**: The system MUST support standard LangChain message types (Human, AI, System).
- **FR-007**: The system SHOULD use a lightweight SQLite driver compatible with the runtime environment.
- **FR-008**: The memory clearing capability MUST wipe the data from the underlying SQLite database.

### Assumptions

- The user works in a local environment where writing to the home directory is permitted.
- The conversation history size fits reasonably within SQLite limits (no automatic truncation/summary required for this MVP, though recommended for future).
- Single user usage (no multi-tenancy support needed for the local DB yet, though the schema should support it if easy).

### Key Entities

- **ShortMemoryDB**: The SQLite database instance.
- **StoredMessage**: A record in the database representing a message.
  - `id`: Unique identifier (auto-increment or UUID).
  - `role`: "user" | "assistant" | "system".
  - `content`: The text content of the message.
  - `created_at`: Timestamp.

## Success Criteria

1. **Persistence**: Messages survive a process restart.
2. **Correct Location**: The file is found at `%HOME%/.morpheus/memory/short-memory.db`.
3. **Recall**: Agent correctly answers questions based on information provided in a previous session (e.g., "What is my name?").
