import React, { useState } from 'react';
import { Download, FileJson, FileText, ChevronDown } from 'lucide-react';
import type { SessionAuditResponse } from '../../services/audit';

interface ExportButtonProps {
  sessionId: string;
  data: SessionAuditResponse | undefined;
}

function exportJson(sessionId: string, data: SessionAuditResponse): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-${sessionId.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(sessionId: string, data: SessionAuditResponse): void {
  const headers = ['id', 'created_at', 'event_type', 'agent', 'tool_name', 'provider', 'model', 'input_tokens', 'output_tokens', 'duration_ms', 'status', 'estimated_cost_usd'];
  const rows = data.events.map((e) => [
    e.id,
    new Date(e.created_at).toISOString(),
    e.event_type,
    e.agent ?? '',
    e.tool_name ?? '',
    e.provider ?? '',
    e.model ?? '',
    e.input_tokens ?? '',
    e.output_tokens ?? '',
    e.duration_ms ?? '',
    e.status ?? '',
    e.estimated_cost_usd ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-${sessionId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const ExportButton: React.FC<ExportButtonProps> = ({ sessionId, data }) => {
  const [open, setOpen] = useState(false);

  if (!data) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-matrix-primary text-gray-600 dark:text-matrix-secondary hover:text-gray-900 dark:hover:text-matrix-highlight hover:border-gray-300 dark:hover:border-matrix-highlight transition-colors"
      >
        <Download size={14} />
        Export
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-black border border-gray-200 dark:border-matrix-primary rounded-lg shadow-xl min-w-[140px] py-1">
            <button
              onClick={() => { exportJson(sessionId, data); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-matrix-secondary hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <FileJson size={14} className="text-blue-500" />
              Export JSON
            </button>
            <button
              onClick={() => { exportCsv(sessionId, data); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-matrix-secondary hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <FileText size={14} className="text-green-500" />
              Export CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
};
