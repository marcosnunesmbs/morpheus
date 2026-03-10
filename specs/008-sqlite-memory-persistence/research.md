# Research: SQLite Memory Persistence for LangChain

## 1. Technical Approach

### Custom SQLite Message History
LangChain.js does not provide a built-in `SQLiteChatMessageHistory` class in the core package (unlike Python). We will implement a custom class extending `BaseListChatMessageHistory` from `@langchain/core/chat_history`.

**Implementation Strategy:**
- Class `SQLiteChatMessageHistory` implements `BaseListChatMessageHistory`.
- Uses `better-sqlite3` for synchronous, reliable, and fast file-based database access.
- **Schema**:
  - Table: `message_store`
  - Columns: `id` (INTEGER PK), `sessionId` (TEXT), `role` (TEXT), `content` (TEXT), `type` (TEXT), `created_at` (DATETIME).
- **Serialization**: 
  - Messages will be serialized/deserialized including their type (Human/AI/System) to reconstruct the correct classes from `@langchain/core/messages`.

### Integration with Agent
The `Agent` class currently uses an in-memory array `this.history: BaseMessage[]`.
We will replace this with:
- A `history` property of type `BaseListChatMessageHistory`.
- The `initialize()` method will instantiate `SQLiteChatMessageHistory`.
- The `chat()` method will use `this.history.addMessage()` instead of `push()`.
- The `getHistory()` method will wrap `this.history.getMessages()`.

### Location
- Database file: `~/.morpheus/memory/short-memory.db`.
- Code: `src/runtime/memory/sqlite.ts`.

## 2. Technology Selection

### Database Driver: `better-sqlite3`
- **Decision**: Use `better-sqlite3`.
- **Rationale**:
  - Fastest SQLite driver for Node.js.
  - Synchronous API simplifies the internal implementation of the history class (though the LangChain interface is async, underlying ops can be sync).
  - Robust and well-maintained.
- **Alternatives Considered**:
  - `sqlite3`: Asynchronous API (callback-based), often messier to wrap in Promises, slower.
  - `sqlite`: Wrapper around `sqlite3`.

### LangChain Integration
- **Decision**: Implement `BaseListChatMessageHistory`.
- **Rationale**: Standard interface for all LangChain history providers. Allows swapping implementations later if needed (e.g., to Redis).

## 3. Unknowns Resolved

- **Built-in Support**: None found for SQLite in JS core. Custom implementation required.
- **Async/Sync**: LangChain history methods are async (`getMessages`, `addMessage`), but `better-sqlite3` is sync. This is fine; we simply return `Promise.resolve(...)`.

## 4. Risks & Mitigations

- **Concurrency**: `better-sqlite3` is synchronous. If the agent does expensive DB ops, it blocks the event loop.
  - *Mitigation*: Chat history is small (text). Writes are negligible.
- **Migration**: Schema changes in future.
  - *Mitigation*: This is a local development tool. We can provide a basic versioning check or just recreate DB if schema is invalid for MVP.
