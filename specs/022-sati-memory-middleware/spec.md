# Feature Specification: Sati Memory Middleware

**Feature Branch**: `022-sati-memory-middleware`
**Created**: 2026-02-04
**Status**: Draft
**Input**: User description: "Implementação da Middleware de Memória (Sati) no Morpheus"

## Architectural Constraint *(Critical)*

**Sati vs Middleware Separation**:
- **Sati** is an independent sub-agent/service, NOT the middleware itself.
- **Middleware** belongs to the Oracle (Main Agent infrastructure) and solely orchestrates Sati invocations.
- **Oracle** (Main Agent) makes decisions based on context provided by Middleware.
- **Sati** only analyzes data and returns structured decisions (Retrieval/Persistence). using its own LLM lifecycle.
- Sati NEVER executes directly in the Oracle's main flow; it is invoked programmatically by the middleware in `beforeAgent` and `afterAgent` hooks.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contextual Memory Retrieval (Priority: P1)

As the Architect (user), I want the system to automatically recall relevant details from our past interactions (such as my coding preferences, project context, or personal details) when I send a new message, so that I don't have to repeat myself and the assistant feels continuous.

**Why this priority**: Core value proposition of long-term memory; without this, the system is amnesic between sessions.

**Independent Test**: Can be tested by manually inserting a memory record into the database and verifying if the agent retrieves and mentions it when prompted with a relevant query.

**Acceptance Scenarios**:

1. **Given** a stored memory that "User prefers TypeScript", **When** the user asks "Generate a hello world script", **Then** the system generates code in TypeScript or mentions the preference.
2. **Given** multiple stored memories, **When** the user sends a message, **Then** only the most relevant (up to 5) memories are retrieved and injected into the context.
3. **Given** sensitive information in history, **When** retrieving memory, **Then** no secrets or API keys are injected.

---

### User Story 2 - Automated Memory Consolidation (Priority: P1)

As the Architect, I want the system to analyze our conversations and save important persistent information (like decisions, preferences, and facts) into long-term storage automatically, so that this knowledge is preserved for the future.

**Why this priority**: Essential for populating the memory database; without this, memories must be manually added, which is not scalable.

**Independent Test**: Can be tested by having a conversation where the user states a clear preference, then checking the database to see if a structured record was created.

**Acceptance Scenarios**:

1. **Given** a conversation where the user says "I primarily use React", **When** the agent finishes responding, **Then** a new memory record categorizing this as a "preference" or "technology" is created.
2. **Given** a conversation with casual chit-chat, **When** the agent finishes, **Then** no trivial information is stored as long-term memory.
3. **Given** the user states a secret (e.g., "My API key is 123"), **When** the memory is processed, **Then** the secret is NOT stored in the long-term memory.

---

### User Story 3 - Memory Deduplication and Evolution (Priority: P2)

As the Architect, I want the system to recognize when I repeat information or update existing details, so that the memory database doesn't become filled with duplicates or outdated conflicts.

**Why this priority**: Keeps the context clean and efficient; prevents token wastage on redundant info.

**Independent Test**: State the same fact twice in different conversations and verify only one record exists or the existing one is updated.

**Acceptance Scenarios**:

1. **Given** an existing memory "User likes blue", **When** the user says "I really like blue", **Then** the system detects the duplicate and does not create a new entry (or updates the existing one's importance).
2. **Given** an existing memory, **When** a similar but slightly different fact is presented, **Then** the system updates the existing record rather than creating a near-duplicate.

---

### User Story 4 - Isolated Storage Infrastructure (Priority: P3)

As a System Administrator, I want the long-term memory to be stored in a dedicated file separate from the short-term session memory, so that I can manage, backup, or reset them independently.

**Why this priority**: Technical requirement for system stability and data management.

**Independent Test**: Verify that `santi-memory.db` is created and populated while `short-memory.db` remains untouched during Sati operations.

**Acceptance Scenarios**:

1. **Given** a fresh installation, **When** the system starts, **Then** the long-term memory storage file is created if it doesn't exist.
2. **Given** an existing short-term memory file, **When** Sati operates, **Then** the short-term memory file is not modified/deleted by Sati processes.
3. **Given** the `morpheus init` command is run, **When** completion, **Then** the `santi-memory.db` file and valid schema are created alongside other config files.

### Edge Cases

- **Cold Start**: What happens when `santi-memory.db` does not exist? (System must create it silently).
- **Empty Memory**: What happens when no relevant memories are found? (No System Message injected, flow continues normally).
- **Sensitive Data Input**: What happens if the user says "My password is 12345"? (Sati evaluates and explicitly decides NOT to store it).
- **Database Lock**: What happens if the SQLite file is locked by another process? (Middleware logs error but allows the main agent flow to proceed without memory - fail open).
- **Token Overflow**: What happens if Sati retrieves 50 long memories? (Limit enforces max 5 items to prevent context overflow).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST intercept the agent's execution cycle BEFORE the main handler (`beforeAgent`) to perform memory retrieval.
- **FR-002**: System MUST intercept the agent's execution cycle AFTER the main handler (`afterAgent`) to perform memory evaluation and persistence.
- **FR-003**: System MUST provide a dedicated valid SQLite database specifically for long-term memory, distinct from the session memory.
- **FR-004**: System MUST semantic/keyword search the long-term memory store using the current user input to find relevant entries.
- **FR-005**: System MUST inject retrieved memories into the main agent's context (e.g., as System Messages) before the agent generates a response.
- **FR-006**: System MUST classify potential memories into predefined categories (Preference, Project, Identity, Personal Data, etc.).
- **FR-007**: System MUST evaluate the importance (Low, Medium, High) of a memory before storing it.
- **FR-008**: System MUST deduplicate memories using hash comparison and content similarity checks to prevent redundancy.
- **FR-009**: System MUST automatically initialize the long-term memory storage infrastructure (tables, files) on startup if missing.
- **FR-010**: System MUST strictly exclude sensitive data (API keys, secrets, tokens) from being persisted in long-term memory.
- **FR-011**: System MUST limit the number of retrieved memories injected into context (e.g., max 5) to preserve context window.
- **FR-012**: System MUST explicitly scaffold the long-term memory database and directory structure during the `morpheus init` command execution.

### Key Entities *(include if feature involves data)*

- **MemoryRecord**: Represents a single unit of long-term knowledge.
  - **Summary**: Concise text content of the memory.
  - **Category**: Classification (e.g., Preference, Project, Identity).
  - **Importance**: Weight of the memory (Low/Medium/High).
  - **Hash**: Unique identifier derived from content for deduplication.
  - **Source/Context**: Origin of the memory (optional, for traceability).
  - **Timestamps**: Creation and update times.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: System retrieves relevant memories defined in previous sessions in 100% of test cases where keywords match.
- **SC-002**: System generates zero (0) duplicate memory records when the exact same information is provided multiple times.
- **SC-003**: System initialization creates the required database file structure 100% of the time on a fresh install.
- **SC-004**: Retrieval latency added to the request processing is within acceptable limits (e.g., < 2 seconds).
- **SC-005**: Sensitive patterns (like 'sk-...') are never present in the `santi-memory.db` text fields.
