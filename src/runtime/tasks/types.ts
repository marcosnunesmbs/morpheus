export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskNotifyStatus = 'pending' | 'sending' | 'sent' | 'failed';

export type TaskAgent = 'apoc' | 'neo' | 'trinit';
export type OriginChannel = 'telegram' | 'discord' | 'ui' | 'api' | 'webhook' | 'cli';

export interface TaskCreateInput {
  agent: TaskAgent;
  input: string;
  context?: string | null;
  origin_channel: OriginChannel;
  session_id: string;
  origin_message_id?: string | null;
  origin_user_id?: string | null;
  max_attempts?: number;
  /** Earliest timestamp (ms) at which the notifier may send this task's result. */
  notify_after_at?: number | null;
}

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
  notify_status: TaskNotifyStatus;
  notify_attempts: number;
  notify_last_error: string | null;
  notified_at: number | null;
  /** Earliest timestamp (ms) at which the notifier may send this task's result. */
  notify_after_at: number | null;
}

export interface TaskFilters {
  status?: TaskStatus;
  agent?: TaskAgent;
  origin_channel?: OriginChannel;
  session_id?: string;
  limit?: number;
}

export interface TaskStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface TaskAck {
  task_id: string;
  status: TaskStatus;
  agent: TaskAgent;
  message: string;
}

export interface OracleTaskContext {
  origin_channel: OriginChannel;
  session_id?: string;
  origin_message_id?: string;
  origin_user_id?: string;
}

