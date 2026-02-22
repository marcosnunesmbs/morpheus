import { useState } from 'react';
import { mutate } from 'swr';
import { Play, Pause, Trash2, Edit2, History, ChevronUp } from 'lucide-react';
import { useChronosJobs, chronosService, type ChronosJob } from '../../services/chronos';
import { ExecutionHistory } from './ExecutionHistory';
import { DeleteConfirmationModal } from '../dashboard/DeleteConfirmationModal';

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
        enabled
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-matrix-tertiary'
      }`}
    >
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatTs(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface ChronosTableProps {
  onEdit: (job: ChronosJob) => void;
}

export function ChronosTable({ onEdit }: ChronosTableProps) {
  const { data: jobs, isLoading } = useChronosJobs();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<ChronosJob | null>(null);

  const handleToggle = async (job: ChronosJob) => {
    setBusy(job.id);
    try {
      if (job.enabled) {
        await chronosService.disableJob(job.id);
      } else {
        await chronosService.enableJob(job.id);
      }
      await mutate((key: string) => typeof key === 'string' && key.startsWith('/chronos'));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;
    setBusy(jobToDelete.id);
    try {
      await chronosService.deleteJob(jobToDelete.id);
      await mutate((key: string) => typeof key === 'string' && key.startsWith('/chronos'));
    } finally {
      setBusy(null);
      setJobToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded border border-azure-border dark:border-matrix-primary p-8 text-center dark:text-matrix-secondary animate-pulse">
        Loading jobs…
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="rounded border border-azure-border dark:border-matrix-primary p-8 text-center dark:text-matrix-secondary">
        No Chronos jobs yet. Click <strong className="dark:text-matrix-highlight">New Job</strong> to get started.
      </div>
    );
  }

  return (
    <div className="rounded border border-azure-border dark:border-matrix-primary overflow-hidden">
      <table className="w-full text-sm font-mono">
        <thead>
          <tr className="border-b border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-zinc-900">
            <th className="text-left px-4 py-3 text-azure-text-muted dark:text-matrix-tertiary font-medium">Prompt</th>
            <th className="text-left px-4 py-3 text-azure-text-muted dark:text-matrix-tertiary font-medium hidden md:table-cell">Schedule</th>
            <th className="text-left px-4 py-3 text-azure-text-muted dark:text-matrix-tertiary font-medium hidden lg:table-cell">Next Run</th>
            <th className="text-left px-4 py-3 text-azure-text-muted dark:text-matrix-tertiary font-medium hidden lg:table-cell">Last Run</th>
            <th className="text-left px-4 py-3 text-azure-text-muted dark:text-matrix-tertiary font-medium">Status</th>
            <th className="px-4 py-3 text-azure-text-muted dark:text-matrix-tertiary font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <>
              <tr
                key={job.id}
                className="border-b border-azure-border dark:border-matrix-primary/30 last:border-0 hover:bg-azure-hover dark:hover:bg-matrix-primary/10 transition-colors"
              >
                <td className="px-4 py-3 dark:text-matrix-secondary max-w-xs">
                  <span title={job.prompt}>{truncate(job.prompt, 50)}</span>
                  <div className="text-xs text-azure-text-muted dark:text-matrix-tertiary">{job.created_by}</div>
                </td>
                <td className="px-4 py-3 dark:text-matrix-secondary hidden md:table-cell text-xs">
                  <div className="capitalize">{job.schedule_type}</div>
                  <div className="text-azure-text-muted dark:text-matrix-tertiary truncate max-w-[140px]" title={job.schedule_expression}>
                    {job.schedule_expression}
                  </div>
                </td>
                <td className="px-4 py-3 dark:text-matrix-secondary hidden lg:table-cell text-xs">
                  {formatTs(job.next_run_at)}
                </td>
                <td className="px-4 py-3 dark:text-matrix-secondary hidden lg:table-cell text-xs">
                  {formatTs(job.last_run_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge enabled={job.enabled} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title={expandedJobId === job.id ? 'Hide history' : 'View history'}
                      onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                      className="p-1.5 rounded dark:text-matrix-tertiary dark:hover:text-matrix-highlight hover:bg-azure-hover dark:hover:bg-matrix-primary/20 transition-colors"
                    >
                      {expandedJobId === job.id ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
                    </button>
                    <button
                      title="Edit"
                      onClick={() => onEdit(job)}
                      className="p-1.5 rounded dark:text-matrix-tertiary dark:hover:text-matrix-highlight hover:bg-azure-hover dark:hover:bg-matrix-primary/20 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      title={job.enabled ? 'Disable' : 'Enable'}
                      onClick={() => handleToggle(job)}
                      disabled={busy === job.id}
                      className="p-1.5 rounded dark:text-matrix-tertiary dark:hover:text-matrix-highlight hover:bg-azure-hover dark:hover:bg-matrix-primary/20 transition-colors disabled:opacity-40"
                    >
                      {job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      title="Delete"
                      onClick={() => setJobToDelete(job)}
                      disabled={busy === job.id}
                      className="p-1.5 rounded text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
              {expandedJobId === job.id && (
                <tr key={`${job.id}-history`} className="bg-azure-surface dark:bg-zinc-900/50">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="text-xs font-bold dark:text-matrix-highlight mb-2">Execution History</div>
                    <ExecutionHistory jobId={job.id} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      <DeleteConfirmationModal
        isOpen={!!jobToDelete}
        onClose={() => setJobToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Chronos Job"
        message={
          jobToDelete
            ? `Delete job "${truncate(jobToDelete.prompt, 60)}"? This action cannot be undone.`
            : ''
        }
      />
    </div>
  );
}
