import React, { useState } from 'react';
import useSWR from 'swr';
import { ShieldAlert, Check, X, ShieldCheck } from 'lucide-react';
import {
  approvalsService,
  type ApprovalRequest,
  type ApprovalDecision,
  type ApprovalScope,
} from '../services/approvals';

interface ScopeOption {
  label: string;
  value: ApprovalScope;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  { label: 'This session only', value: 'session' },
  { label: 'This project', value: 'project' },
  { label: 'Always (global)', value: 'global' },
];

function ApprovalCard({
  approval,
  onResolved,
}: {
  approval: ApprovalRequest;
  onResolved: () => void;
}) {
  const [scope, setScope] = useState<ApprovalScope>('session');
  const [loading, setLoading] = useState(false);

  const resolve = async (decision: ApprovalDecision, withScope?: ApprovalScope) => {
    setLoading(true);
    try {
      await approvalsService.resolve(approval.id, decision, withScope);
      onResolved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-yellow-300 dark:border-yellow-500/40 bg-yellow-50 dark:bg-yellow-900/10 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 font-mono">
            {approval.action_type}
          </p>
          <p className="text-sm text-azure-text-primary dark:text-matrix-text mt-0.5">
            {approval.action_description}
          </p>
          <p className="text-xs text-azure-text-muted dark:text-matrix-secondary font-mono mt-1">
            Task: {approval.task_id.slice(0, 8)}…
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <button
          onClick={() => resolve('deny')}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          Deny
        </button>

        <button
          onClick={() => resolve('approve')}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50"
        >
          <Check className="w-3 h-3" />
          Approve once
        </button>

        <div className="flex items-center gap-1">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ApprovalScope)}
            disabled={loading}
            className="px-2 py-1.5 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-xs focus:outline-none"
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => resolve('approve_always', scope)}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-azure-surface dark:bg-zinc-800 border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-dim hover:bg-azure-hover dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="w-3 h-3" />
            Always
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApprovalPanel() {
  const { data: approvals = [], mutate: refetch } = useSWR(
    '/api/approvals?status=pending',
    () => approvalsService.list('pending'),
    { refreshInterval: 3000 },
  );

  if (approvals.length === 0) return null;

  return (
    <div className="rounded-lg border border-yellow-300 dark:border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
        <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
          {approvals.length} Pending Approval{approvals.length !== 1 ? 's' : ''}
        </h3>
      </div>
      <div className="space-y-3">
        {approvals.map((a) => (
          <ApprovalCard key={a.id} approval={a} onResolved={() => refetch()} />
        ))}
      </div>
    </div>
  );
}
