export type AuditEventType =
  | 'llm_call'
  | 'tool_call'
  | 'mcp_tool'
  | 'task_created'
  | 'task_completed'
  | 'skill_executed'
  | 'chronos_job';

export type AuditAgent =
  | 'oracle'
  | 'apoc'
  | 'neo'
  | 'trinity'
  | 'smith'
  | 'keymaker'
  | 'chronos'
  | 'sati';

export type AuditStatus = 'success' | 'error';

export interface AuditEvent {
  id: string;
  session_id: string;
  task_id: string | null;
  event_type: AuditEventType;
  agent: AuditAgent | null;
  tool_name: string | null;
  provider: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  status: AuditStatus | null;
  metadata: string | null; // JSON string
  created_at: number;
  // Computed — not stored in DB
  estimated_cost_usd?: number | null;
}

export interface AuditEventInsert {
  session_id: string;
  task_id?: string | null;
  event_type: AuditEventType;
  agent?: AuditAgent | null;
  tool_name?: string | null;
  provider?: string | null;
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  duration_ms?: number | null;
  status?: AuditStatus | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditSessionSummary {
  totalCostUsd: number;
  totalDurationMs: number;
  llmCallCount: number;
  toolCallCount: number;
  byAgent: Array<{
    agent: string;
    llmCalls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
  byModel: Array<{
    provider: string;
    model: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
}
