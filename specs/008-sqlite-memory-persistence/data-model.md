# Data Model: SQLite Memory Persistence

## Database Schema

**File**: `~/.morpheus/memory/short-memory.db`
**Engine**: SQLite3

### Table: `messages`

Stores the conversation history.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique ID of the message. |
| `session_id` | `TEXT` | `NOT NULL` | Session identifier (for future multi-session support). Default: `default`. |
| `type` | `TEXT` | `NOT NULL` | The message type: `human`, `ai`, `system`. |
| `content` | `TEXT` | `NOT NULL` | The text content of the message. |
| `created_at` | `INTEGER` | `NOT NULL` | Timestamp (Unix epoch in milliseconds). |

**Indices**:
- `idx_messages_session_id` on `session_id` to speed up retrieval.

## Class Structure

### `SQLiteChatMessageHistory`

Extends `BaseListChatMessageHistory` from `@langchain/core/chat_history`.

**Properties**:
- `db`: `Database` (better-sqlite3 instance).
- `sessionId`: `string` (Current session ID).

**Methods**:
- `getMessages(): Promise<BaseMessage[]>`: Retrieving all messages for current session.
- `addMessage(message: BaseMessage): Promise<void>`: Saving a message.
- `clear(): Promise<void>`: Deleting all messages for current session.
