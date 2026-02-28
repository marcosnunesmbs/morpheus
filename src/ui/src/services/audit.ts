import useSWR from 'swr';
import { httpClient } from './httpClient';

export interface AuditEvent {
  id: string;
  session_id: string;
  task_id: string | null;
  event_type: 'llm_call' | 'tool_call' | 'mcp_tool' | 'task_created' | 'task_completed' | 'skill_executed' | 'chronos_job';
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
  llmCallCount: number;
  toolCallCount: number;
  byAgent: AuditAgentSummary[];
  byModel: AuditModelSummary[];
}

export interface SessionAuditResponse {
  events: AuditEvent[];
  summary: AuditSessionSummary;
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
