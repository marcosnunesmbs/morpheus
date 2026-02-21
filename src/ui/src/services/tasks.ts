import { httpClient } from './httpClient';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskAgent = 'apoc' | 'neo' | 'trinit';
export type OriginChannel = 'telegram' | 'discord' | 'ui' | 'api' | 'webhook' | 'cli';

export interface TaskRecord {
  id: string;
  agent: TaskAgent;
  status: TaskStatus;
  input: string;
  context: string | null;
  output: string | null;
  error: string | null;
  origin_channel: OriginChannel;
  session_id: string;
  origin_message_id: string | null;
  origin_user_id: string | null;
  attempt_count: number;
  max_attempts: number;
  available_at: number;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  updated_at: number;
  worker_id: string | null;
  notify_status: 'pending' | 'sending' | 'sent' | 'failed';
  notify_attempts: number;
  notify_last_error: string | null;
  notified_at: number | null;
}

export interface TaskStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

export const taskService = {
  list: (params?: {
    status?: TaskStatus;
    agent?: TaskAgent;
    origin_channel?: OriginChannel;
    session_id?: string;
    limit?: number;
  }): Promise<TaskRecord[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.agent) qs.set('agent', params.agent);
    if (params?.origin_channel) qs.set('origin_channel', params.origin_channel);
    if (params?.session_id) qs.set('session_id', params.session_id);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return httpClient.get<TaskRecord[]>(`/tasks${suffix}`);
  },

  get: (id: string): Promise<TaskRecord> =>
    httpClient.get<TaskRecord>(`/tasks/${id}`),

  stats: (): Promise<TaskStats> =>
    httpClient.get<TaskStats>('/tasks/stats'),

  retry: (id: string): Promise<{ success: boolean }> =>
    httpClient.post<{ success: boolean }>(`/tasks/${id}/retry`, {}),

  cancel: (id: string): Promise<{ success: boolean }> =>
    httpClient.post<{ success: boolean }>(`/tasks/${id}/cancel`, {}),
};

