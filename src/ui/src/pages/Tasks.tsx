import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, XCircle, LoaderCircle, Eye, ListChecks, Ban } from 'lucide-react';
import { taskService, type OriginChannel, type TaskAgent, type TaskRecord, type TaskStatus } from '../services/tasks';
import { Dialog, DialogHeader, DialogTitle } from '../components/Dialog';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

const statusLabel: Record<TaskStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function StatusBadge({ status }: { status: TaskStatus }) {
  if (status === 'completed') {
    return <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="w-4 h-4" />Completed</span>;
  }
  if (status === 'failed') {
    return <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><XCircle className="w-4 h-4" />Failed</span>;
  }
  if (status === 'running') {
    return <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><LoaderCircle className="w-4 h-4 animate-spin" />Running</span>;
  }
  if (status === 'cancelled') {
    return <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400"><XCircle className="w-4 h-4" />Cancelled</span>;
  }
  return <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400"><Clock className="w-4 h-4" />Pending</span>;
}

const formatDate = (ts: number | null) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
};

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

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center gap-3">
        <ListChecks className="w-6 h-6 text-azure-primary dark:text-matrix-highlight" />
        <div>
          <h1 className="text-2xl font-bold text-azure-text-primary dark:text-matrix-highlight">Tasks</h1>
          <p className="text-sm text-azure-text-secondary dark:text-matrix-dim">Async tasks delegated by Oracle and processed by workers.</p>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Pending" value={stats?.pending ?? 0} />
        <StatCard label="Running" value={stats?.running ?? 0} />
        <StatCard label="Completed" value={stats?.completed ?? 0} />
        <StatCard label="Failed" value={stats?.failed ?? 0} />
        <StatCard label="Cancelled" value={stats?.cancelled ?? 0} />
        <StatCard label="Total" value={stats?.total ?? 0} />
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-azure-border dark:border-matrix-primary p-4 bg-azure-surface dark:bg-zinc-950 grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          className="px-3 py-2 rounded border border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-black text-azure-text-primary dark:text-matrix-secondary"
          value={status}
          onChange={(e) => setStatus((e.target.value || '') as TaskStatus | '')}
        >
          <option value="">All status</option>
          {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select
          className="px-3 py-2 rounded border border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-black text-azure-text-primary dark:text-matrix-secondary"
          value={agent}
          onChange={(e) => setAgent((e.target.value || '') as TaskAgent | '')}
        >
          <option value="">All agents</option>
          <option value="apoc">Apoc</option>
          <option value="neo">Neo</option>
          {/* <option value="trinit">Trinit</option> */}
        </select>

        <select
          className="px-3 py-2 rounded border border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-black text-azure-text-primary dark:text-matrix-secondary"
          value={originChannel}
          onChange={(e) => setOriginChannel((e.target.value || '') as OriginChannel | '')}
        >
          <option value="">All channels</option>
          <option value="telegram">Telegram</option>
          <option value="ui">UI</option>
          <option value="api">API</option>
          <option value="webhook">Webhook</option>
          <option value="cli">CLI</option>
          {/* <option value="discord">Discord</option> */}
        </select>

        <input
          className="px-3 py-2 rounded border border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-black text-azure-text-primary dark:text-matrix-secondary"
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          placeholder="Filter by session id"
        />
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-azure-border dark:border-matrix-primary overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-azure-surface dark:bg-zinc-900 border-b border-azure-border dark:border-matrix-primary">
            <tr>
              {['Task ID', 'Status', 'Agent', 'Channel', 'Session', 'Attempts', 'Created', 'Finished', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-azure-text-secondary dark:text-matrix-dim">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-azure-text-secondary dark:text-matrix-dim">No tasks found.</td>
              </tr>
            ) : tasks.map((task) => (
              <tr key={task.id} className="border-b border-azure-border dark:border-matrix-primary/30 hover:bg-azure-surface/50 dark:hover:bg-zinc-900/40 transition-colors">
                <td className="px-4 py-3 font-mono">{task.id.slice(0, 8)}</td>
                <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                <td className="px-4 py-3">{task.agent.toUpperCase()}</td>
                <td className="px-4 py-3">{task.origin_channel.toUpperCase()}</td>
                <td className="px-4 py-3 font-mono">{task.session_id}</td>
                <td className="px-4 py-3">{task.attempt_count}/{task.max_attempts}</td>
                <td className="px-4 py-3">{formatDate(task.created_at)}</td>
                <td className="px-4 py-3">{formatDate(task.finished_at)}</td>
                <td className="px-4 py-3 flex items-center gap-1">
                  <button
                    onClick={() => setDetail(task)}
                    className="p-1.5 rounded hover:bg-azure-border dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-dim"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {(task.status === 'pending' || task.status === 'running') && (
                    <button
                      onClick={async () => {
                        await taskService.cancel(task.id);
                        await mutate();
                      }}
                      title="Cancel task"
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogHeader>
          <DialogTitle className="text-azure-text-primary dark:text-matrix-highlight">Task Details</DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh] text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-azure-text-secondary dark:text-matrix-dim">
              <div><b>ID:</b> <span className="font-mono">{detail.id}</span></div>
              <div><b>Status:</b> {detail.status}</div>
              <div><b>Agent:</b> {detail.agent}</div>
              <div><b>Origin:</b> {detail.origin_channel}</div>
              <div><b>Session:</b> <span className="font-mono">{detail.session_id}</span></div>
              <div><b>Attempts:</b> {detail.attempt_count}/{detail.max_attempts}</div>
            </div>

            <section>
              <p className="font-medium mb-1">Input</p>
              <pre className="text-xs whitespace-pre-wrap rounded-lg border border-azure-border dark:border-matrix-primary/30 p-3 bg-azure-bg dark:bg-zinc-950">{detail.input}</pre>
            </section>

            {detail.output && (
              <section>
                <p className="font-medium mb-1">Output</p>
                <pre className="text-xs whitespace-pre-wrap rounded-lg border border-azure-border dark:border-matrix-primary/30 p-3 bg-azure-bg dark:bg-zinc-950">{detail.output}</pre>
              </section>
            )}

            {detail.error && (
              <section>
                <p className="font-medium mb-1 text-red-600 dark:text-red-400">Error</p>
                <pre className="text-xs whitespace-pre-wrap rounded-lg border border-red-200 dark:border-red-900/50 p-3 bg-red-50 dark:bg-red-950/40">{detail.error}</pre>
              </section>
            )}

            {(detail.status === 'failed' || detail.status === 'pending' || detail.status === 'running') && (
              <div className="flex justify-end gap-2">
                {(detail.status === 'pending' || detail.status === 'running') && (
                  <button
                    onClick={async () => {
                      await taskService.cancel(detail.id);
                      setDetail(null);
                      await mutate();
                    }}
                    className="px-4 py-2 rounded-lg border border-red-400 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                  >
                    Cancel Task
                  </button>
                )}
                {detail.status === 'failed' && (
                  <button
                    onClick={async () => {
                      await taskService.retry(detail.id);
                      setDetail(null);
                      await mutate();
                    }}
                    className="px-4 py-2 rounded-lg bg-azure-primary text-white dark:bg-matrix-highlight dark:text-black text-sm"
                  >
                    Retry Task
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-zinc-950 px-4 py-3">
      <p className="text-xs text-azure-text-secondary dark:text-matrix-dim">{label}</p>
      <p className="text-xl font-semibold text-azure-text-primary dark:text-matrix-highlight">{value}</p>
    </div>
  );
}

