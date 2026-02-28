import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Clock, XCircle, LoaderCircle, Eye, ListChecks, Ban,
  X, RefreshCw, AlertCircle,
} from 'lucide-react';
import { taskService, type OriginChannel, type TaskAgent, type TaskRecord, type TaskStatus } from '../services/tasks';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

const statusLabel: Record<TaskStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const base = 'inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 border';
  if (status === 'completed') return (
    <span className={`${base} text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/50`}>
      <CheckCircle2 className="w-3 h-3" />Completed
    </span>
  );
  if (status === 'failed') return (
    <span className={`${base} text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50`}>
      <XCircle className="w-3 h-3" />Failed
    </span>
  );
  if (status === 'running') return (
    <span className={`${base} text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50`}>
      <LoaderCircle className="w-3 h-3 animate-spin" />Running
    </span>
  );
  if (status === 'cancelled') return (
    <span className={`${base} text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700`}>
      <XCircle className="w-3 h-3" />Cancelled
    </span>
  );
  return (
    <span className={`${base} text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/50`}>
      <Clock className="w-3 h-3" />Pending
    </span>
  );
}

function AgentBadge({ agent }: { agent: string }) {
  return (
    <span className="inline-flex items-center text-[10px] font-medium font-mono rounded px-1.5 py-0.5 border border-azure-primary/20 dark:border-matrix-primary/40 bg-azure-primary/5 dark:bg-matrix-primary/10 text-azure-primary dark:text-matrix-secondary uppercase">
      {agent}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span className="inline-flex items-center text-[10px] font-medium rounded px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 uppercase">
      {channel}
    </span>
  );
}

const formatDateShort = (ts: number | null) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

const formatDateFull = (ts: number | null) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
};

// ─── Detail Modal ────────────────────────────────────────────────────────────

function TaskDetailModal({ task, onClose, onCancel, onRetry }: {
  task: TaskRecord;
  onClose: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const canCancel = task.status === 'pending' || task.status === 'running';
  const canRetry = task.status === 'failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-black border border-azure-border dark:border-matrix-primary rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-azure-border dark:border-matrix-primary shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-azure-primary/10 dark:bg-matrix-highlight/10 flex items-center justify-center shrink-0">
              <ListChecks className="w-4 h-4 text-azure-primary dark:text-matrix-highlight" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-azure-text dark:text-matrix-highlight">Task Details</h2>
                <StatusBadge status={task.status} />
              </div>
              <p className="text-xs font-mono text-azure-text-secondary dark:text-matrix-tertiary mt-0.5 truncate">{task.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-azure-text-secondary dark:text-matrix-tertiary hover:text-azure-text dark:hover:text-matrix-highlight hover:bg-azure-surface dark:hover:bg-zinc-900 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[
              { label: 'Agent', value: <AgentBadge agent={task.agent} /> },
              { label: 'Channel', value: <ChannelBadge channel={task.origin_channel} /> },
              { label: 'Attempts', value: `${task.attempt_count} / ${task.max_attempts}` },
              { label: 'Session', value: <span className="font-mono text-xs">{task.session_id}</span> },
              { label: 'Created', value: formatDateFull(task.created_at) },
              { label: 'Finished', value: formatDateFull(task.finished_at) },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary">{label}</span>
                <span className="text-azure-text dark:text-matrix-secondary">{value}</span>
              </div>
            ))}
          </div>

          {/* Input */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-2">Input</p>
            <pre className="rounded-lg bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/40 p-4 text-xs text-azure-text-secondary dark:text-matrix-secondary overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed font-mono">
              {task.input}
            </pre>
          </div>

          {/* Output */}
          {task.output && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-2">Output</p>
              <pre className="rounded-lg bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/40 p-4 text-xs text-azure-text-secondary dark:text-matrix-secondary overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed font-mono">
                {task.output}
              </pre>
            </div>
          )}

          {/* Error */}
          {task.error && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Error
              </p>
              <pre className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 p-4 text-xs text-red-600 dark:text-red-400 overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed font-mono">
                {task.error}
              </pre>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(canCancel || canRetry) && (
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-azure-border dark:border-matrix-primary shrink-0">
            {canCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded text-sm border border-red-300 dark:border-red-700/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Cancel Task
              </button>
            )}
            {canRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 rounded text-sm font-medium bg-azure-primary text-white hover:bg-azure-active dark:bg-matrix-highlight dark:text-black dark:hover:bg-matrix-highlight/90 transition-colors"
              >
                Retry Task
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

const statColors: Record<string, string> = {
  Pending:   'text-yellow-600  dark:text-yellow-400',
  Running:   'text-blue-600    dark:text-blue-400',
  Completed: 'text-emerald-600 dark:text-emerald-400',
  Failed:    'text-red-600     dark:text-red-400',
  Cancelled: 'text-zinc-500    dark:text-zinc-400',
  Total:     'text-azure-text  dark:text-matrix-highlight',
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-black px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${statColors[label] ?? 'text-azure-text dark:text-matrix-secondary'}`}>{value}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function TasksPage() {
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [agent, setAgent] = useState<TaskAgent | ''>('');
  const [originChannel, setOriginChannel] = useState<OriginChannel | ''>('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [detail, setDetail] = useState<TaskRecord | null>(null);

  const filters = useMemo(() => ({
    status: status || undefined,
    agent: agent || undefined,
    origin_channel: originChannel || undefined,
    session_id: sessionFilter.trim() || undefined,
    limit: 200,
  }), [status, agent, originChannel, sessionFilter]);

  const { data: stats } = useSWR('/tasks/stats', () => taskService.stats(), { refreshInterval: 5000 });
  const { data: tasks = [], mutate } = useSWR(['/tasks', filters], () => taskService.list(filters), { refreshInterval: 3000 });

  const selectCls = 'px-3 py-2 rounded border border-azure-border dark:border-matrix-primary bg-white dark:bg-black text-azure-text dark:text-matrix-secondary text-sm focus:outline-none focus:border-azure-primary dark:focus:border-matrix-highlight';

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">

      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-azure-primary/10 dark:bg-matrix-highlight/10 border border-azure-primary/20 dark:border-matrix-highlight/30 flex items-center justify-center">
          <ListChecks className="w-5 h-5 text-azure-primary dark:text-matrix-highlight" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-azure-text dark:text-matrix-highlight">Tasks</h1>
          <p className="text-sm text-azure-text-secondary dark:text-matrix-tertiary">Async tasks delegated by Oracle and processed by workers.</p>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatCard label="Pending"   value={stats?.pending   ?? 0} />
        <StatCard label="Running"   value={stats?.running   ?? 0} />
        <StatCard label="Completed" value={stats?.completed ?? 0} />
        <StatCard label="Failed"    value={stats?.failed    ?? 0} />
        <StatCard label="Cancelled" value={stats?.cancelled ?? 0} />
        <StatCard label="Total"     value={stats?.total     ?? 0} />
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="rounded-lg border border-azure-border dark:border-matrix-primary p-4 bg-white dark:bg-black grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select className={selectCls} value={status} onChange={(e) => setStatus((e.target.value || '') as TaskStatus | '')}>
          <option value="">All status</option>
          {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={selectCls} value={agent} onChange={(e) => setAgent((e.target.value || '') as TaskAgent | '')}>
          <option value="">All agents</option>
          <option value="apoc">Apoc</option>
          <option value="neo">Neo</option>
          <option value="smith">Smith</option>
          <option value="trinit">Trinity</option>
        </select>
        <select className={selectCls} value={originChannel} onChange={(e) => setOriginChannel((e.target.value || '') as OriginChannel | '')}>
          <option value="">All channels</option>
          <option value="telegram">Telegram</option>
          <option value="discord">Discord</option>
          <option value="ui">UI</option>
          <option value="api">API</option>
          <option value="webhook">Webhook</option>
          <option value="cli">CLI</option>
        </select>
        <input
          className={`${selectCls} placeholder:text-azure-text-secondary/50 dark:placeholder:text-matrix-secondary/40`}
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          placeholder="Filter by session ID"
        />
      </motion.div>

      {/* Table */}
      <motion.div variants={item} className="rounded-lg border border-azure-border dark:border-matrix-primary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-azure-surface dark:bg-zinc-900 border-b border-azure-border dark:border-matrix-primary">
              <tr>
                {[
                  { label: 'ID',       cls: 'w-24'  },
                  { label: 'Status',   cls: 'w-32'  },
                  { label: 'Agent',    cls: 'w-24'  },
                  { label: 'Channel',  cls: 'w-24'  },
                  { label: 'Session',  cls: 'w-28'  },
                  { label: 'Attempts', cls: 'w-20'  },
                  { label: 'Created',  cls: 'w-36'  },
                  { label: 'Finished', cls: 'w-36'  },
                  { label: '',         cls: 'w-16'  },
                ].map((h) => (
                  <th key={h.label} className={`text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary ${h.cls}`}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-azure-text-secondary dark:text-matrix-tertiary">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 opacity-40" />
                    No tasks found.
                  </td>
                </tr>
              ) : tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-azure-border dark:border-matrix-primary/30 hover:bg-azure-surface/60 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-azure-text-secondary dark:text-matrix-tertiary">
                    {task.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3">
                    <AgentBadge agent={task.agent} />
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={task.origin_channel} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-azure-text-secondary dark:text-matrix-tertiary">
                    {task.session_id ? task.session_id.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-azure-text-secondary dark:text-matrix-secondary text-xs">
                    {task.attempt_count}/{task.max_attempts}
                  </td>
                  <td className="px-4 py-3 text-xs text-azure-text-secondary dark:text-matrix-secondary whitespace-nowrap">
                    {formatDateShort(task.created_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-azure-text-secondary dark:text-matrix-secondary whitespace-nowrap">
                    {formatDateShort(task.finished_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDetail(task)}
                        className="p-1.5 rounded border border-azure-border dark:border-matrix-primary/50 text-azure-text-secondary dark:text-matrix-tertiary hover:text-azure-primary dark:hover:text-matrix-highlight hover:border-azure-primary dark:hover:border-matrix-highlight transition-colors"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {(task.status === 'pending' || task.status === 'running') && (
                        <button
                          onClick={async () => { await taskService.cancel(task.id); mutate(); }}
                          className="p-1.5 rounded border border-red-200 dark:border-red-800/50 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                          title="Cancel task"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Detail modal */}
      {detail && (
        <TaskDetailModal
          task={detail}
          onClose={() => setDetail(null)}
          onCancel={async () => { await taskService.cancel(detail.id); setDetail(null); mutate(); }}
          onRetry={async () => { await taskService.retry(detail.id); setDetail(null); mutate(); }}
        />
      )}
    </motion.div>
  );
}
