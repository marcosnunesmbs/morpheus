import { Pencil, Trash2, ToggleLeft, ToggleRight, Terminal, Globe, CheckCircle, XCircle, Wrench, AlertCircle } from 'lucide-react';
import type { MCPProbeResult, MCPServerRecord } from '../../types/mcp';

type MCPServerCardProps = {
  server: MCPServerRecord;
  probeResult?: MCPProbeResult;
  onEdit: (server: MCPServerRecord) => void;
  onDelete: (server: MCPServerRecord) => void;
  onToggle: (server: MCPServerRecord, enabled: boolean) => void;
};

function TransportBadge({ transport }: { transport: 'stdio' | 'http' }) {
  if (transport === 'stdio') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 text-amber-500 bg-amber-500/10 border-amber-500/30">
        <Terminal className="w-2.5 h-2.5" />
        stdio
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 text-cyan-500 bg-cyan-500/10 border-cyan-500/30">
      <Globe className="w-2.5 h-2.5" />
      http
    </span>
  );
}

function ProbeStatus({ result }: { result?: MCPProbeResult }) {
  if (!result) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-600">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
        unchecked
      </span>
    );
  }
  if (result.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500">
        <CheckCircle className="w-3 h-3" />
        {result.toolCount} tool{result.toolCount !== 1 ? 's' : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-500">
      <XCircle className="w-3 h-3" />
      failed
    </span>
  );
}

export const MCPServerCard = ({ server, probeResult, onEdit, onDelete, onToggle }: MCPServerCardProps) => {
  const isOk = probeResult?.ok;
  const isFailed = probeResult && !probeResult.ok;

  const envEntries = server.config.env ? Object.entries(server.config.env) : [];

  return (
    <div className={`rounded-lg border flex flex-col bg-white dark:bg-black transition-all ${
      !server.enabled
        ? 'border-azure-border dark:border-matrix-primary/30'
        : isFailed
        ? 'border-red-400/40 dark:border-red-500/30'
        : isOk
        ? 'border-emerald-400/50 dark:border-emerald-500/30'
        : 'border-azure-primary/40 dark:border-matrix-primary'
    }`}>

      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          !server.enabled
            ? 'bg-azure-surface dark:bg-zinc-900'
            : isOk
            ? 'bg-emerald-500/10'
            : isFailed
            ? 'bg-red-500/10'
            : 'bg-azure-primary/10 dark:bg-matrix-highlight/10'
        }`}>
          <Wrench className={`w-4 h-4 ${
            !server.enabled
              ? 'text-azure-text-secondary dark:text-matrix-tertiary'
              : isOk
              ? 'text-emerald-500'
              : isFailed
              ? 'text-red-500'
              : 'text-azure-primary dark:text-matrix-highlight'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-semibold truncate ${
              server.enabled
                ? 'text-azure-text dark:text-matrix-highlight'
                : 'text-azure-text-secondary dark:text-matrix-secondary'
            }`}>
              {server.name}
            </h3>
            <TransportBadge transport={server.config.transport} />
            {!server.enabled && (
              <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 shrink-0">
                disabled
              </span>
            )}
          </div>
          <div className="mt-1">
            <ProbeStatus result={probeResult} />
          </div>
        </div>
      </div>

      {/* Body — connection details */}
      <div className="px-4 pb-4 space-y-2">
        {server.config.transport === 'stdio' && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-1">Command</p>
            <code className="block text-xs font-mono text-azure-text dark:text-matrix-secondary bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/40 rounded px-2.5 py-1.5 break-all">
              {server.config.command}
              {server.config.args && server.config.args.length > 0 && (
                <span className="text-azure-text-secondary dark:text-matrix-tertiary"> {server.config.args.join(' ')}</span>
              )}
            </code>
          </div>
        )}

        {server.config.transport === 'http' && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-1">URL</p>
            <code className="block text-xs font-mono text-azure-text dark:text-matrix-secondary bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/40 rounded px-2.5 py-1.5 break-all">
              {server.config.url}
            </code>
          </div>
        )}

        {envEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-1">
              Env vars ({envEntries.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {envEntries.map(([key]) => (
                <span
                  key={key}
                  className="text-[10px] font-mono text-azure-text-secondary dark:text-matrix-tertiary bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/30 rounded px-1.5 py-0.5"
                >
                  {key}
                </span>
              ))}
            </div>
          </div>
        )}

        {isFailed && probeResult.error && (
          <div className="flex items-start gap-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="break-all line-clamp-2" title={probeResult.error}>
              {probeResult.error}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto px-4 py-3 border-t border-azure-border dark:border-matrix-primary/30 flex items-center justify-between gap-2">
        {server.config._comment ? (
          <p className="text-xs text-azure-text-secondary dark:text-matrix-tertiary truncate min-w-0">
            {server.config._comment}
          </p>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(server)}
            className="p-1.5 rounded border border-azure-border dark:border-matrix-primary/50 text-azure-text-secondary dark:text-matrix-tertiary hover:text-azure-primary dark:hover:text-matrix-highlight hover:border-azure-primary dark:hover:border-matrix-highlight transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggle(server, !server.enabled)}
            className={`p-1.5 rounded border transition-colors ${
              server.enabled
                ? 'border-emerald-300 dark:border-emerald-700/60 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                : 'border-azure-border dark:border-matrix-primary/40 text-zinc-400 dark:text-zinc-600 hover:text-azure-text dark:hover:text-matrix-secondary hover:border-azure-border dark:hover:border-matrix-primary'
            }`}
            title={server.enabled ? 'Disable' : 'Enable'}
          >
            {server.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => onDelete(server)}
            className="p-1.5 rounded border border-red-200 dark:border-red-800/50 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
