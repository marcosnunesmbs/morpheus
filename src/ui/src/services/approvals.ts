import { httpClient } from './httpClient';

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'approved_always';

export interface ApprovalRequest {
  id: string;
  task_id: string;
  session_id: string;
  action_type: string;
  action_description: string;
  status: ApprovalStatus;
  scope?: string;
  created_at: number;
  resolved_at?: number;
  resolved_by?: string;
}

export type ApprovalDecision = 'approve' | 'deny' | 'approve_always';
export type ApprovalScope = 'session' | 'project' | 'global';

export const approvalsService = {
  list: (status?: ApprovalStatus, session_id?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (session_id) params.set('session_id', session_id);
    const query = params.toString();
    return httpClient.get<ApprovalRequest[]>(`/approvals${query ? `?${query}` : ''}`);
  },

  resolve: (id: string, decision: ApprovalDecision, scope?: ApprovalScope) =>
    httpClient.post<ApprovalRequest>(`/approvals/${id}/resolve`, { decision, scope }),
};
