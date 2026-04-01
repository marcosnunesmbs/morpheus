## Why

The current `/api/stats/usage` route relies exclusively on the `messages` table, which ignores subagent usage, audio costs, and internal LLM calls (e.g., Sati). Furthermore, the `by-agent` stats route currently double-counts Oracle's data by merging `messages` and `audit_events`. This change establishes `audit_events` as the single source of truth for all global usage and cost reporting.

## What Changes

- **Global Stats**: Refactor `/api/stats/usage` to use `AuditRepository.getGlobalSummary().totals` instead of `SQLiteChatMessageHistory.getGlobalUsageStats()`.
- **Grouped Stats**: Refactor `/api/stats/usage/grouped` to use `AuditRepository.getGlobalSummary().byModel`.
- **Agent Stats**: Refactor `/api/stats/usage/by-agent` to use `AuditRepository.getGlobalSummary().byAgent`.
- **Consistency**: Ensure all subagent LLM calls are correctly emitted to `audit_events` (via `persistAgentMessage` or `buildAgentResult`).

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `stats`: The system SHALL use the unified Audit system as the primary source for all usage, token, and cost reporting.

## Impact

- `src/http/api.ts`: Route logic updates.
- `src/runtime/memory/sqlite.ts`: Deprecation of redundant stats methods.
- `src/runtime/subagents/utils.ts`: Verification of audit emission for subagents.
