# Research: Advanced UI Configuration and Statistics

**Feature**: [016-ui-config-stats](../spec.md)
**Status**: Complete

## DECISION: Configuration Schema Updates
**Question**: How should we model "Memory Limit" and "Audio Settings"?
**Decision**:
1.  **LLM Memory Limit**: Add `llm.max_tokens` (integer) to the `ConfigSchema`. This explicitly controls the context window size per request, distinct from `memory.limit` (which controls message history count).
2.  **Audio Configuration**: Enhance `AudioConfigSchema` to include a `provider` field (enum: `['google']` initially) to satisfy the requirement for "selecting a Provider". Existing fields (`apiKey`, `enabled`) are sufficient.

**Rationale**:
- `max_tokens` is the industry standard term for context limits.
- The current `memory.limit` (history size) serves a different purpose than what the user requested ("limit memory" in LLM config context usually implies cost/token control).
- Future-proofing Audio config allows us to switch triggers/providers later.

## DECISION: Usage Statistics Aggregation
**Question**: How do we efficiently calculate total token usage?
**Decision**: Use direct SQLite aggregation queries.
**Implementation**:
- The `messages` table already contains `input_tokens` and `output_tokens` columns.
- Query: `SELECT SUM(input_tokens) as total_input, SUM(output_tokens) as total_output FROM messages`.

**Rationale**:
- Data exists; no schema migration required for historic data (assuming metadata was populated).
- SQLite is fast enough for this aggregation on typical local-agent dataset sizes (< 1M rows).

## DECISION: UI Architecture
**Question**: How to structure the new settings and dashboard?
**Decision**:
1.  **Settings**:
    - **LLM Tab**: Add input for `max_tokens` (mapped to `llm.max_tokens`).
    - **Audio Tab**: Create a new tab. Move Audio-related fields there.
2.  **Dashboard**:
    - Add a "UsageStats" component sourcing data from a new `/api/stats/usage` endpoint.

**Alternatives Considered**:
- *Client-side aggregation*: Fetching all messages to sum tokens in the browser. Rejected due to performance impact on large histories.

## COMPLETED TASKS
- Verified `SQLiteChatMessageHistory` schema includes token columns.
- Verified `AudioConfigSchema` exists but needs a `provider` field to match spec.
