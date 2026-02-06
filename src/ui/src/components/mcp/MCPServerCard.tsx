import type { MCPServerRecord } from '../../types/mcp';

type MCPServerCardProps = {
  server: MCPServerRecord;
  onEdit: (server: MCPServerRecord) => void;
  onDelete: (server: MCPServerRecord) => void;
  onToggle: (server: MCPServerRecord, enabled: boolean) => void;
};

export const MCPServerCard = ({ server, onEdit, onDelete, onToggle }: MCPServerCardProps) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{server.name}</div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{server.config.transport}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              server.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
            onClick={() => onToggle(server, !server.enabled)}
          >
            {server.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        {server.config.transport === 'stdio' && (
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Command:</span> {server.config.command}
          </div>
        )}
        {server.config.transport === 'http' && (
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-200">URL:</span> {server.config.url}
          </div>
        )}
        {server.config.args && server.config.args.length > 0 && (
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Args:</span> {server.config.args.join(' ')}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-200"
          onClick={() => onEdit(server)}
        >
          Edit
        </button>
        <button
          type="button"
          className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:border-red-400 hover:text-red-500 dark:border-red-900 dark:text-red-300"
          onClick={() => onDelete(server)}
        >
          Delete
        </button>
      </div>
    </div>
  );
};
