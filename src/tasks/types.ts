export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'awaiting_approval';

export type TaskCreator = 'architect' | 'keymaker' | 'user' | 'oracle';
export type TaskAssignee = 'apoc' | 'merovingian';

export interface Task {
  id: string;
  project_id?: string;
  session_id: string;
  parent_task_id?: string;
  created_by: TaskCreator;
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

export interface CreateTaskInput {
  project_id?: string;
  session_id: string;
  parent_task_id?: string;
  created_by: TaskCreator;
  assigned_to?: TaskAssignee;
  title: string;
  description?: string;
  blueprint?: string;
  requires_approval?: boolean;
  working_dir?: string;
}

export interface UpdateTaskInput {
  assigned_to?: TaskAssignee;
  status?: TaskStatus;
  blueprint?: string;
  result?: string;
  error?: string;
  started_at?: number;
  completed_at?: number;
  approved_at?: number;
  approved_by?: string;
}

export interface TaskFilter {
  session_id?: string;
  project_id?: string;
  status?: TaskStatus;
  assigned_to?: TaskAssignee;
}
