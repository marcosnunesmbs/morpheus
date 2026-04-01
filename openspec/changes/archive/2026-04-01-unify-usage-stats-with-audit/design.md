## Context

Currently, the Morpheus dashboard and various stats endpoints retrieve usage data from multiple sources:
1.  `/api/stats/usage`: Queries `messages` table via `SQLiteChatMessageHistory`.
2.  `/api/stats/usage/grouped`: Queries `messages` table via `SQLiteChatMessageHistory`.
3.  `/api/stats/usage/by-agent`: Merges `messages` and `audit_events`.

The `messages` table only records chat messages, while `audit_events` records LLM calls, tool executions, and audio costs. To provide a truly global usage summary, we must use the `audit_events` data as the definitive source.

## Goals / Non-Goals

**Goals:**
- Migrate `/api/stats/usage` and related endpoints to use the `AuditRepository` as the primary data source.
- Eliminate double-counting of Oracle LLM usage in agent-based reporting.
- Ensure all usage reporting includes non-message costs (e.g., audio, Sati).

**Non-Goals:**
- Deleting token usage data from the `messages` table (still needed for session-specific UI displays).
- Changing the `audit_events` table schema.

## Decisions

### 1. Route Refactoring in `src/http/api.ts`
- **Decision**: Update routes `/api/stats/usage`, `/api/stats/usage/grouped`, and `/api/stats/usage/by-agent` to use `AuditRepository.getGlobalSummary()`.
- **Rationale**: `AuditRepository` already implements a comprehensive `getGlobalSummary` method that handles complex cost calculations and cross-agent aggregation correctly.
- **Alternative**: Updating the queries in `SQLiteChatMessageHistory`, but that would duplicate the logic already present in the Audit repository.

### 2. Standardize Audit Emission in Subagents
- **Decision**: Verify and ensure all subagents emit `llm_call` events to the `AuditRepository`.
- **Rationale**: Subagents like Apoc currently rely on `persistAgentMessage`, which only writes to the `messages` table. For a unified stats view, they must also write to `audit_events`.
- **Implementation**: `TaskWorker.ts` already handles audit emission for async tasks. For sync subagent calls, `buildDelegationTool` in `src/runtime/tools/delegation-utils.ts` should be confirmed to ensure it emits `llm_call` events correctly.

### 3. Deprecate Redundant History Methods
- **Decision**: Mark `SQLiteChatMessageHistory.getGlobalUsageStats` and `getUsageStatsByAgent` as deprecated once the API is switched.
- **Rationale**: These methods are legacy and provide incomplete data. Centralizing in `AuditRepository` reduces maintenance overhead.

## Risks / Trade-offs

- **[Risk]** → Differences in how `messages` and `audit_events` record usage might cause a visible jump in stats for existing users.
  - **Mitigation** → This is expected, as the new numbers will be more accurate (including audio and subagent costs previously hidden).
- **[Risk]** → Performance of `getGlobalSummary()` on very large audit tables.
  - **Mitigation** → The method uses optimized SQL aggregations with indexed columns.
