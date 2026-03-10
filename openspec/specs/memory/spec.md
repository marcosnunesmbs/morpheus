# Memory Specification

## Purpose
The memory system persists conversation history, session metadata, and long-term semantic memories. It provides Oracle with context across turns and powers the Chat UI, session management, and usage statistics.

## Scope
Included:
- SQLite chat message history (short-memory.db)
- Session CRUD: create, list, archive, delete
- Token tracking per message (input, output, cache_read)
- Sati long-term memory: semantic evaluation and retrieval
- Session embedding worker: background embedding generation
- Usage stats API

Out of scope:
- Trinity database registry (trinity.db — covered in `subagents` spec)
- Link document database (link.db — covered in `subagents` spec)
- Audit events (short-memory.db audit_events table — covered in `audit` spec)

## Requirements

### Requirement: Message persistence
The system SHALL persist every Oracle message (human and AI) to SQLite with: session ID, type, content, tokens (input/output/total/cache_read), provider, model, and timestamp.

#### Scenario: AI message persisted with tokens
- GIVEN Oracle completes a turn with token usage
- WHEN the AI message is saved
- THEN the record includes `input_tokens`, `output_tokens`, `cache_read_tokens`, `provider`, and `model`

#### Scenario: Token extraction fallback chain
- GIVEN a provider returns usage in a non-standard format
- WHEN token extraction runs
- THEN a 4-fallback chain is attempted: `usage_metadata`, `response_metadata.usage`, message content parsing, and zero as default

### Requirement: Session management
The system SHALL support creating, listing, renaming, archiving, and soft-deleting sessions.

#### Scenario: Session created
- GIVEN no session exists for a given ID
- WHEN the first message is received for that session
- THEN a session record is inserted with `status = 'active'`

#### Scenario: Session archived
- GIVEN a session is active
- WHEN `PATCH /api/sessions/:id/archive` is called
- THEN `status` becomes `'archived'` and `archived_at` is set

#### Scenario: Session soft-deleted
- GIVEN a session exists
- WHEN `DELETE /api/sessions/:id` is called
- THEN `deleted_at` is set and the session no longer appears in active listings

### Requirement: Schema migration
The system SHALL apply non-destructive `ALTER TABLE` migrations on startup when new columns are added to existing tables.

#### Scenario: New column added to messages
- GIVEN an existing `messages` table without `audio_duration_seconds`
- WHEN the daemon starts after a version upgrade
- THEN the column is added via `ALTER TABLE` and existing rows are unaffected

### Requirement: Sati long-term memory
The system SHALL evaluate conversation history at a configurable turn frequency and persist relevant memories to the Sati database (sati-memory.db) as semantic embeddings.

#### Scenario: Memory evaluated at configured frequency
- GIVEN `sati.evaluation_frequency` is 5
- WHEN the 5th turn in a session completes
- THEN `SatiMemoryMiddleware.evaluateAndPersist()` is called with the session's messages

#### Scenario: Memory retrieved for context
- GIVEN relevant memories exist for the current session topic
- WHEN Oracle processes a new message
- THEN relevant Sati memories are injected into the system prompt

### Requirement: Session embedding
The system SHALL generate embeddings for session messages in the background to enable semantic search across sessions.

#### Scenario: Embeddings generated asynchronously
- GIVEN new messages are added to a session
- WHEN the session embedding worker processes the queue
- THEN embeddings are computed and stored in sati-memory.db without blocking Oracle's response

#### Scenario: Backfill on startup
- GIVEN existing sessions have messages without embeddings
- WHEN the daemon starts
- THEN the backfill process generates embeddings for unprocessed messages in the background

### Requirement: Usage statistics API
The system SHALL aggregate token usage and estimated cost across sessions, grouped by provider and model.

#### Scenario: Global usage totals
- GIVEN messages across 3 sessions with various providers
- WHEN `GET /api/stats/usage` is called
- THEN totals for input_tokens, output_tokens, and estimated cost are returned

#### Scenario: Usage grouped by model
- GIVEN messages from `claude-3-5-sonnet` and `gpt-4o`
- WHEN `GET /api/stats/usage/grouped` is called
- THEN separate entries are returned per provider/model with token counts and cost
