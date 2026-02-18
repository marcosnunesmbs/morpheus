import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
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

function ApprovalCard({ approval, onResolved }: { approval: ApprovalRequest; onResolved: () => void }) {
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
    <div className="border border-yellow-500/40 rounded-lg p-4 bg-yellow-900/10">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-yellow-300 font-mono text-sm font-bold">{approval.action_type}</p>
          <p className="text-gray-300 font-mono text-xs mt-1">{approval.action_description}</p>
          <p className="text-gray-500 font-mono text-xs mt-1">Task: {approval.task_id.slice(0, 8)}...</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        {/* Deny */}
        <button
          onClick={() => resolve('deny')}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-900/40 hover:bg-red-700/50 border border-red-500/40 text-red-300 text-xs font-mono rounded transition-colors disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          Deny
        </button>

        {/* Approve once */}
        <button
          onClick={() => resolve('approve')}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-900/40 hover:bg-green-700/50 border border-green-500/40 text-green-300 text-xs font-mono rounded transition-colors disabled:opacity-50"
        >
          <Check className="w-3 h-3" />
          Approve once
        </button>

        {/* Approve always */}
        <div className="flex items-center gap-1">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ApprovalScope)}
            disabled={loading}
            className="bg-black border border-green-500/30 text-green-300 text-xs font-mono rounded px-2 py-1.5 focus:outline-none"
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
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-900/40 hover:bg-blue-700/50 border border-blue-500/40 text-blue-300 text-xs font-mono rounded transition-colors disabled:opacity-50"
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
    <div className="bg-yellow-950/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-5 h-5 text-yellow-400" />
        <h3 className="text-yellow-300 font-bold font-mono text-sm">
          {approvals.length} Pending Approval{approvals.length !== 1 ? 's' : ''}
        </h3>
      </div>
      <div className="space-y-3">
        {approvals.map((a) => (
          <ApprovalCard
            key={a.id}
            approval={a}
            onResolved={() => refetch()}
          />
        ))}
      </div>
    </div>
  );
}
