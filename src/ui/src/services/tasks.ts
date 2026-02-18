import { httpClient } from './httpClient';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'awaiting_approval';

export type TaskAssignee = 'apoc' | 'merovingian';

export interface Task {
  id: string;
  project_id?: string;
  session_id: string;
  parent_task_id?: string;
  created_by: string;
  assigned_to?: TaskAssignee;
  title: string;
  description?: string;
  blueprint?: string;
  status: TaskStatus;
  requires_approval: boolean;
  approved_at?: number;
  approved_by?: string;
  result?: string;
  error?: string;
  working_dir?: string;
  started_at?: number;
  completed_at?: number;
  created_at: number;
  updated_at: number;
}

export interface TaskFilter {
  project_id?: string;
  session_id?: string;
  status?: TaskStatus;
  assigned_to?: TaskAssignee;
}

export const tasksService = {
  list: (filter?: TaskFilter) => {
    const params = new URLSearchParams();
    if (filter?.project_id) params.set('project_id', filter.project_id);
    if (filter?.session_id) params.set('session_id', filter.session_id);
    if (filter?.status) params.set('status', filter.status);
    if (filter?.assigned_to) params.set('assigned_to', filter.assigned_to);
    const query = params.toString();
    return httpClient.get<Task[]>(`/tasks${query ? `?${query}` : ''}`);
  },

  get: (id: string) => httpClient.get<Task>(`/tasks/${id}`),

  approve: (id: string) =>
    httpClient.post<Task>(`/tasks/${id}/approve`, {}),

  cancel: (id: string) =>
    httpClient.post<Task>(`/tasks/${id}/cancel`, {}),
};
