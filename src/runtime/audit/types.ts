export type AuditEventType =
  | 'llm_call'
  | 'tool_call'
  | 'mcp_tool'
  | 'task_created'
  | 'task_completed'
  | 'skill_executed'
  | 'chronos_job'
  | 'memory_recovery'
  | 'memory_persist'
  | 'telephonist'
  | 'link_search'
  | 'link_index';

export type AuditAgent =
  | 'oracle'
  | 'apoc'
  | 'neo'
  | 'trinity'
  | 'smith'
  | 'keymaker'
  | 'chronos'
  | 'sati'
  | 'telephonist'
  | 'link';

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

export interface GlobalAuditSummary {
  sessions: {
    total: number;
    active: number;
    paused: number;
    archived: number;
    deleted: number;
    withAudit: number;
  };
  totals: {
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
    linkSearchCount: number;
    linkIndexCount: number;
  };
  byAgent: Array<{
    agent: string;
    llmCalls: number;
    toolCalls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    totalDurationMs: number;
  }>;
  byModel: Array<{
    provider: string;
    model: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
  topTools: Array<{
    tool_name: string;
    agent: string | null;
    event_type: string;
    count: number;
    errorCount: number;
  }>;
  recentSessions: Array<{
    session_id: string;
    title: string | null;
    status: string;
    started_at: number | null;
    event_count: number;
    estimatedCostUsd: number;
    totalDurationMs: number;
    llmCallCount: number;
    memoryRecoveryCount: number;
    memoryPersistCount: number;
  }>;
  dailyActivity: Array<{
    date: string;
    eventCount: number;
    llmCallCount: number;
    memoryRecoveryCount: number;
    memoryPersistCount: number;
    estimatedCostUsd: number;
  }>;
}

export interface AuditSessionSummary {
  totalCostUsd: number;
  totalDurationMs: number;
  totalAudioSeconds: number;
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
