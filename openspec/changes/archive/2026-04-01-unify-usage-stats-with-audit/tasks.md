## 1. Audit Coverage Verification

- [x] 1.1 Verify and confirm `TaskWorker.ts` correctly emits `llm_call` for subagents.
- [x] 1.2 Verify `buildDelegationTool` in `src/runtime/tools/delegation-utils.ts` correctly audits sync subagent calls.
- [x] 1.3 Verify `src/runtime/oracle.ts` correctly audits its own LLM calls.

## 2. API Route Refactoring

- [x] 2.1 Update `GET /api/stats/usage` in `src/http/api.ts` to use `AuditRepository.getGlobalSummary().totals`.
- [x] 2.2 Update `GET /api/stats/usage/grouped` in `src/http/api.ts` to use `AuditRepository.getGlobalSummary().byModel`.
- [x] 2.3 Update `GET /api/stats/usage/by-agent` in `src/http/api.ts` to use `AuditRepository.getGlobalSummary().byAgent`.

## 3. Deprecation and Cleanup

- [x] 3.1 Mark `SQLiteChatMessageHistory.getGlobalUsageStats` as deprecated in `src/runtime/memory/sqlite.ts`.
- [x] 3.2 Mark `SQLiteChatMessageHistory.getUsageStatsByAgent` as deprecated in `src/runtime/memory/sqlite.ts`.

## 4. Verification

- [x] 4.1 Verify `/api/stats/usage` response structure matches previous API for frontend compatibility.
- [x] 4.2 Verify `/api/stats/usage/grouped` and `/api/stats/usage/by-agent` structures are correct.
- [x] 4.3 Build the backend to ensure no compilation errors.
