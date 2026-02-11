import { useStatus } from '@/lib/api';
import { formatUptime } from '@/lib/formatUptime';

export function Footer() {
  const { data: status } = useStatus();

  return (
    <footer className="h-8 bg-azure-bg dark:bg-zinc-950 border-t border-azure-border dark:border-matrix-primary flex items-center px-4 text-xs justify-between select-none z-10 shrink-0">
      <div className="flex gap-4">
        <span className={status ? 'text-azure-primary dark:text-matrix-highlight' : 'text-red-500'}>
           ● {status?.status.toUpperCase() || 'OFFLINE'}
        </span>
        <span>PID: {status?.pid || '-'}</span>
        <span>UPTIME: {status ? formatUptime(status.uptimeSeconds) : '-'}</span>
      </div>
      <div className="flex gap-4 opacity-70">
        <span>v{status?.projectVersion || '0.0.0'}</span>
        <span>{status?.agentName || 'Morpheus'}</span>
      </div>
    </footer>
  );
}
