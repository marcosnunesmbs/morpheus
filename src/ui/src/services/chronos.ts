import useSWR from 'swr';
import { httpClient } from './httpClient';

export type ScheduleType = 'once' | 'cron' | 'interval';
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'timeout';
export type CreatedBy = 'ui' | 'telegram' | 'api';

export interface ChronosJob {
  id: string;
  prompt: string;
  schedule_type: ScheduleType;
  schedule_expression: string;
  cron_normalized: string | null;
  timezone: string;
  next_run_at: number | null;
  last_run_at: number | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
  created_by: CreatedBy;
  notify_channels: string[];
}

export interface ChronosExecution {
  id: string;
  job_id: string;
  triggered_at: number;
  completed_at: number | null;
  status: ExecutionStatus;
  error: string | null;
  session_id: string;
}

export interface ChronosConfig {
  timezone: string;
  check_interval_ms: number;
  max_active_jobs: number;
}

export interface CreateChronosJobRequest {
  prompt: string;
  schedule_type: ScheduleType;
  schedule_expression: string;
  timezone?: string;
  notify_channels?: string[];
}

export interface UpdateChronosJobRequest {
  prompt?: string;
  schedule_expression?: string;
  enabled?: boolean;
  timezone?: string;
  notify_channels?: string[];
}

export interface CreateChronosJobResponse {
  job: ChronosJob;
  human_readable: string;
  next_run_formatted: string;
}

export interface ChronosPreviewResponse {
  next_run_at: number;
  human_readable: string;
  next_occurrences: string[];
}

// ─── SWR Hooks ────────────────────────────────────────────────────────────────

export function useChronosJobs(filters?: { enabled?: boolean; created_by?: CreatedBy }) {
  const qs = new URLSearchParams();
  if (filters?.enabled !== undefined) qs.set('enabled', String(filters.enabled));
  if (filters?.created_by) qs.set('created_by', filters.created_by);
  const suffix = qs.toString() ? `?${qs}` : '';
  return useSWR<ChronosJob[]>(`/chronos${suffix}`, () =>
    httpClient.get<ChronosJob[]>(`/chronos${suffix}`)
  );
}

export function useChronosJob(id: string | null) {
  return useSWR<ChronosJob>(
    id ? `/chronos/${id}` : null,
    () => httpClient.get<ChronosJob>(`/chronos/${id}`)
  );
}

export function useChronosExecutions(jobId: string | null, limit = 50) {
  return useSWR<ChronosExecution[]>(
    jobId ? `/chronos/${jobId}/executions?limit=${limit}` : null,
    () => httpClient.get<ChronosExecution[]>(`/chronos/${jobId}/executions?limit=${limit}`)
  );
}

export function useChronosConfig() {
  return useSWR<ChronosConfig>('/config/chronos', () =>
    httpClient.get<ChronosConfig>('/config/chronos')
  );
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const chronosService = {
  createJob: (req: CreateChronosJobRequest): Promise<CreateChronosJobResponse> =>
    httpClient.post<CreateChronosJobResponse>('/chronos', req),

  updateJob: (id: string, req: UpdateChronosJobRequest): Promise<ChronosJob> =>
    httpClient.put<ChronosJob>(`/chronos/${id}`, req),

  deleteJob: (id: string): Promise<{ success: boolean; deleted_id: string }> =>
    httpClient.delete<{ success: boolean; deleted_id: string }>(`/chronos/${id}`),

  enableJob: (id: string): Promise<ChronosJob> =>
    httpClient.patch<ChronosJob>(`/chronos/${id}/enable`, {}),

  disableJob: (id: string): Promise<ChronosJob> =>
    httpClient.patch<ChronosJob>(`/chronos/${id}/disable`, {}),

  getConfig: (): Promise<ChronosConfig> =>
    httpClient.get<ChronosConfig>('/config/chronos'),

  updateConfig: (req: Partial<ChronosConfig>): Promise<ChronosConfig> =>
    httpClient.post<ChronosConfig>('/config/chronos', req),

  preview: (expression: string, schedule_type: ScheduleType, timezone?: string): Promise<ChronosPreviewResponse> =>
    httpClient.post<ChronosPreviewResponse>('/chronos/preview', { expression, schedule_type, timezone }),
};
