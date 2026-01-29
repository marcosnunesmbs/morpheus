import { useStatus } from '@/lib/api';

export function Footer() {
  const { data: status } = useStatus();

  return (
    <footer className="h-8 bg-zinc-950 border-t border-matrix-primary flex items-center px-4 text-xs justify-between select-none z-10 shrink-0">
      <div className="flex gap-4">
        <span className={status ? 'text-matrix-highlight' : 'text-red-500'}>
           ● {status?.status.toUpperCase() || 'OFFLINE'}
        </span>
        <span>PID: {status?.pid || '-'}</span>
        <span>UPTIME: {status ? Math.floor(status.uptimeSeconds / 60) + 'm' : '-'}</span>
      </div>
      <div className="flex gap-4 opacity-70">
        <span>v{status?.projectVersion || '0.0.0'}</span>
        <span>{status?.agentName || 'Morpheus'}</span>
      </div>
    </footer>
  );
}
