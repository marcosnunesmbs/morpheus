import type { MCPProbeResult, MCPServerRecord } from '../../types/mcp';

type MCPServerCardProps = {
  server: MCPServerRecord;
  probeResult?: MCPProbeResult;
  onEdit: (server: MCPServerRecord) => void;
  onDelete: (server: MCPServerRecord) => void;
  onToggle: (server: MCPServerRecord, enabled: boolean) => void;
};

export const MCPServerCard = ({ server, probeResult, onEdit, onDelete, onToggle }: MCPServerCardProps) => {
  return (
    <div className="rounded-2xl border border-azure-border bg-azure-surface/80 p-4 shadow-sm overflow-hidden dark:border-matrix-primary dark:bg-zinc-950/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-azure-text-primary break-words dark:text-matrix-highlight">{server.name}</div>
          <div className="text-xs uppercase tracking-wide text-azure-text-muted dark:text-matrix-secondary">{server.config.transport}</div>
        </div>
        <div className="flex items-center gap-2">
          {probeResult && (
            <span
              title={probeResult.ok ? `${probeResult.toolCount} tools` : probeResult.error}
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                probeResult.ok
                  ? 'bg-green-500/20 text-green-600 dark:bg-green-400/20 dark:text-green-400'
                  : 'bg-red-500/20 text-red-600 dark:bg-red-400/20 dark:text-red-400'
              }`}
            >
              {probeResult.ok ? `✓ ${probeResult.toolCount} tools` : '✗ Failed'}
            </span>
          )}
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              server.enabled ? 'bg-matrix-highlight dark:text-matrix-primary' : 'bg-azure-border text-azure-text-secondary dark:bg-matrix-primary/50 dark:text-matrix-secondary'
            }`}
            onClick={() => onToggle(server, !server.enabled)}
          >
            {server.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-azure-text-secondary dark:text-matrix-secondary">
        {server.config.transport === 'stdio' && (
          <div className="break-all">
            <span className="font-semibold text-azure-text-primary dark:text-matrix-highlight">Command:</span> {server.config.command}
          </div>
        )}
        {server.config.transport === 'http' && (
          <div className="break-all">
            <span className="font-semibold text-azure-text-primary dark:text-matrix-highlight">URL:</span> {server.config.url}
          </div>
        )}
        {server.config.args && server.config.args.length > 0 && (
          <div className="break-all">
            <span className="font-semibold text-azure-text-primary dark:text-matrix-highlight">Args:</span> {server.config.args.join(' ')}
          </div>
        )}
        {probeResult && !probeResult.ok && probeResult.error && (
          <div className="mt-1 break-all rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {probeResult.error.length > 120 ? probeResult.error.slice(0, 120) + '…' : probeResult.error}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="rounded-md border border-azure-border px-3 py-2 text-sm text-azure-text-primary hover:border-azure-primary hover:text-azure-primary dark:border-matrix-primary dark:text-matrix-secondary hover:dark:border-matrix-highlight hover:dark:text-matrix-highlight"
          onClick={() => onEdit(server)}
        >
          Edit
        </button>
        <button
          type="button"
          className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:border-red-400 hover:text-red-500 dark:border-red-900 dark:text-red-400"
          onClick={() => onDelete(server)}
        >
          Delete
        </button>
      </div>
    </div>
  );
};
