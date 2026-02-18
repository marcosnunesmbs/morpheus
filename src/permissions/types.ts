export type ActionType =
  | 'read_file'
  | 'write_file'
  | 'delete_file'
  | 'run_command'
  | 'git_push'
  | 'git_commit'
  | 'network_request'
  | 'leave_working_dir'
  | 'kill_process'
  | 'download_file';

export type PermissionScope = 'session' | 'project' | 'global';

export interface Permission {
  id: string;
  action_type: ActionType;
  scope: PermissionScope;
  scope_id?: string;
  granted_at: number;
  expires_at?: number;
}

export interface GrantPermissionInput {
  action_type: ActionType;
  scope: PermissionScope;
  scope_id?: string;
  expires_at?: number;
}

// ApprovalRequest types
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'approved_always';
export type ApprovalScope = 'once' | 'session' | 'project' | 'global';

export interface ApprovalRequest {
  id: string;
  task_id: string;
  session_id: string;
  action_type: string;
  action_description: string;
  status: ApprovalStatus;
  scope?: ApprovalScope;
  created_at: number;
  resolved_at?: number;
  resolved_by?: string;
}

export interface CreateApprovalRequestInput {
  task_id: string;
  session_id: string;
  action_type: string;
  action_description: string;
}
