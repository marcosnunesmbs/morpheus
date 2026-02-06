import type { MCPServerRecord } from '../../types/mcp';

type MCPServerCardProps = {
  server: MCPServerRecord;
  onEdit: (server: MCPServerRecord) => void;
  onDelete: (server: MCPServerRecord) => void;
  onToggle: (server: MCPServerRecord, enabled: boolean) => void;
};

export const MCPServerCard = ({ server, onEdit, onDelete, onToggle }: MCPServerCardProps) => {
  return (
    <div className="rounded-2xl border border-azure-border bg-azure-surface/80 p-4 shadow-sm dark:border-matrix-primary dark:bg-zinc-950/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-azure-text-primary dark:text-matrix-highlight">{server.name}</div>
          <div className="text-xs uppercase tracking-wide text-azure-text-muted dark:text-matrix-secondary">{server.config.transport}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              server.enabled ? 'bg-azure-active text-azure-primary dark:bg-matrix-primary dark:text-matrix-highlight' : 'bg-azure-border text-azure-text-secondary dark:bg-matrix-primary/50 dark:text-matrix-secondary'
            }`}
            onClick={() => onToggle(server, !server.enabled)}
          >
            {server.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-azure-text-secondary dark:text-matrix-secondary">
        {server.config.transport === 'stdio' && (
          <div>
            <span className="font-semibold text-azure-text-primary dark:text-matrix-highlight">Command:</span> {server.config.command}
          </div>
        )}
        {server.config.transport === 'http' && (
          <div>
            <span className="font-semibold text-azure-text-primary dark:text-matrix-highlight">URL:</span> {server.config.url}
          </div>
        )}
        {server.config.args && server.config.args.length > 0 && (
          <div>
            <span className="font-semibold text-azure-text-primary dark:text-matrix-highlight">Args:</span> {server.config.args.join(' ')}
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
