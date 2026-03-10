# Data Model: Sati Memory Middleware

## Database Schema (`santi-memory.db`)

### Table: `long_term_memory`

Stores the persistent memories derived from user interactions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `category` | TEXT | NOT NULL | Enum: preference, project, identity, constraint, context, personal_data, languages, favorite_things, relationships, pets, naming, professional_profile |
| `importance` | TEXT | NOT NULL | Enum: low, medium, high |
| `summary` | TEXT | NOT NULL | The actual memory content |
| `details` | TEXT | NULL | JSON or text with extra context |
| `hash` | TEXT | NOT NULL UNIQUE | Deterministic hash for deduplication |
| `source` | TEXT | NULL | Origin identifier (e.g. conversation ID) |
| `created_at` | DATETIME | NOT NULL | Default current timestamp |
| `updated_at` | DATETIME | NOT NULL | Default current timestamp |
| `last_accessed_at` | DATETIME | NULL | Timestamp of last retrieval |
| `access_count` | INTEGER | DEFAULT 0 | Number of times retrieved |
| `version` | INTEGER | DEFAULT 1 | For optimistic locking/updates |
| `archived` | BOOLEAN | DEFAULT 0 | Soft delete flag |

### Indices

- `idx_memory_category` on `category`
- `idx_memory_importance` on `importance`
- `idx_memory_archived` on `archived`

## In-Memory Entities

### SatiRetrievalInput

Input for the "Recovery" mode (before agent).

```typescript
{
  current_message: string;
  recent_messages: string[]; // Summarized or raw last N messages
  memory_limit: number;
}
```

### SatiEvaluationInput

Input for the "Evaluation" mode (after agent).

```typescript
{
  recent_conversation: {
    role: "user" | "assistant";
    content: string;
  }[];
  existing_memory_summaries: string[];
}
```

### SatiMemoryResult

Output from Sati analysis.

```typescript
// Retrieval Mode
{
  relevant_memories: {
    summary: string;
    category: string;
    importance: string;
  }[];
}

// Evaluation Mode
{
  should_store: boolean;
  category?: string;
  importance?: string;
  summary?: string;
  reason?: string;
}
```
