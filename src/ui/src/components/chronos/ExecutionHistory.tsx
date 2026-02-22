import { useChronosExecutions, type ExecutionStatus } from '../../services/chronos';

const STATUS_COLORS: Record<ExecutionStatus, string> = {
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  timeout: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

interface ExecutionHistoryProps {
  jobId: string;
}

export function ExecutionHistory({ jobId }: ExecutionHistoryProps) {
  const { data: executions, isLoading } = useChronosExecutions(jobId, 50);

  if (isLoading) {
    return (
      <div className="p-4 dark:bg-zinc-900 rounded text-sm dark:text-matrix-secondary animate-pulse">
        Loading history…
      </div>
    );
  }

  if (!executions || executions.length === 0) {
    return (
      <div className="p-4 dark:bg-zinc-900 rounded text-sm dark:text-matrix-secondary italic">
        No executions yet.
      </div>
    );
  }

  return (
    <div className="rounded border border-azure-border dark:border-matrix-primary dark:bg-zinc-900 overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-azure-border dark:border-matrix-primary">
            <th className="text-left px-3 py-2 text-azure-text-muted dark:text-matrix-tertiary">Triggered At</th>
            <th className="text-left px-3 py-2 text-azure-text-muted dark:text-matrix-tertiary">Completed At</th>
            <th className="text-left px-3 py-2 text-azure-text-muted dark:text-matrix-tertiary">Status</th>
            <th className="text-left px-3 py-2 text-azure-text-muted dark:text-matrix-tertiary">Error</th>
          </tr>
        </thead>
        <tbody>
          {executions.map((exec) => (
            <tr
              key={exec.id}
              className="border-b border-azure-border dark:border-matrix-primary/30 last:border-0"
            >
              <td className="px-3 py-2 dark:text-matrix-secondary">
                {new Date(exec.triggered_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 dark:text-matrix-secondary">
                {exec.completed_at ? new Date(exec.completed_at).toLocaleString() : '—'}
              </td>
              <td className="px-3 py-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[exec.status]}`}>
                  {exec.status}
                </span>
              </td>
              <td className="px-3 py-2 dark:text-red-400 max-w-xs truncate">
                {exec.error ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
