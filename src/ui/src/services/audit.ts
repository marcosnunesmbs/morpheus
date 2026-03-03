import useSWR from 'swr';
import { httpClient } from './httpClient';

export interface AuditEvent {
  id: string;
  session_id: string;
  task_id: string | null;
  event_type: 'llm_call' | 'tool_call' | 'mcp_tool' | 'task_created' | 'task_completed' | 'skill_executed' | 'chronos_job' | 'memory_recovery' | 'memory_persist' | 'telephonist';
  agent: string | null;
  tool_name: string | null;
  provider: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  status: string | null;
  metadata: string | null;
  created_at: number;
  estimated_cost_usd: number | null;
}

export interface AuditAgentSummary {
  agent: string;
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AuditModelSummary {
  provider: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AuditSessionSummary {
  totalCostUsd: number;
  totalDurationMs: number;
  totalAudioSeconds: number;
  llmCallCount: number;
  toolCallCount: number;
  byAgent: AuditAgentSummary[];
  byModel: AuditModelSummary[];
}

export interface SessionAuditResponse {
  events: AuditEvent[];
  summary: AuditSessionSummary;
}

export interface GlobalAuditTotals {
  estimatedCostUsd: number;
  totalDurationMs: number;
  totalAudioSeconds: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEventCount: number;
  llmCallCount: number;
  toolCallCount: number;
  mcpToolCount: number;
  skillCount: number;
  memoryRecoveryCount: number;
  memoryPersistCount: number;
  chronosJobCount: number;
  taskCreatedCount: number;
  taskCompletedCount: number;
  telephonistCount: number;
}

export interface GlobalAuditByAgent {
  agent: string;
  llmCalls: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  totalDurationMs: number;
}

export interface GlobalAuditByModel {
  provider: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface GlobalAuditTopTool {
  tool_name: string;
  agent: string | null;
  event_type: string;
  count: number;
  errorCount: number;
}

export interface GlobalAuditRecentSession {
  session_id: string;
  title: string | null;
  status: string;
  started_at: number | null;
  event_count: number;
  estimatedCostUsd: number;
  totalDurationMs: number;
  llmCallCount: number;
}

export interface GlobalAuditDailyActivity {
  date: string;
  eventCount: number;
  llmCallCount: number;
  estimatedCostUsd: number;
}

export interface GlobalAuditSummary {
  sessions: {
    total: number;
    active: number;
    paused: number;
    archived: number;
    deleted: number;
    withAudit: number;
  };
  totals: GlobalAuditTotals;
  byAgent: GlobalAuditByAgent[];
  byModel: GlobalAuditByModel[];
  topTools: GlobalAuditTopTool[];
  recentSessions: GlobalAuditRecentSession[];
  dailyActivity: GlobalAuditDailyActivity[];
}

export function useGlobalAudit() {
  const { data, error, isLoading, mutate } = useSWR<GlobalAuditSummary>(
    '/audit/global',
    (url: string) => httpClient.get<GlobalAuditSummary>(url),
    { revalidateOnFocus: false, refreshInterval: 30_000 }
  );
  return { data, error, isLoading, mutate };
}

export function useSessionAudit(sessionId: string | null, page = 0, pageSize = 100) {
  const limit = pageSize;
  const offset = page * pageSize;
  const { data, error, isLoading } = useSWR<SessionAuditResponse>(
    sessionId ? `/sessions/${sessionId}/audit?limit=${limit}&offset=${offset}` : null,
    (url: string) => httpClient.get<SessionAuditResponse>(url),
    { revalidateOnFocus: false }
  );
  return { data, error, isLoading };
}
