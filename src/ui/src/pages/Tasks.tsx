import React, { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  ListTodo,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  ShieldAlert,
  Check,
  X,
} from 'lucide-react';
import { tasksService, type Task, type TaskStatus, type TaskFilter } from '../services/tasks';
import { projectsService, type Project } from '../services/projects';
import { ApprovalPanel } from '../components/ApprovalPanel';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ElementType; classes: string }> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    classes: 'bg-azure-surface dark:bg-zinc-800 text-azure-text-secondary dark:text-matrix-dim border-azure-border dark:border-matrix-primary/50',
  },
  in_progress: {
    label: 'Running',
    icon: Loader2,
    classes: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/50 animate-pulse',
  },
  done: {
    label: 'Done',
    icon: CheckCircle2,
    classes: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/50',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    classes: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/50',
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    classes: 'bg-azure-surface dark:bg-zinc-900 text-azure-text-muted dark:text-matrix-secondary border-azure-border dark:border-matrix-primary/30',
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    icon: ShieldAlert,
    classes: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500/50',
  },
};

const AGENT_CONFIG: Record<string, { label: string; classes: string }> = {
  apoc: {
    label: 'Apoc',
    classes: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40',
  },
  merovingian: {
    label: 'Merovingian',
    classes: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40',
  },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded border ${cfg.classes}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function AgentBadge({ assignee }: { assignee?: string }) {
  if (!assignee) return null;
  const cfg = AGENT_CONFIG[assignee] ?? {
    label: assignee,
    classes: 'bg-azure-surface dark:bg-zinc-800 text-azure-text-secondary dark:text-matrix-dim border-azure-border dark:border-matrix-primary/50',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono rounded border ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  projectName,
  onRefresh,
}: {
  task: Task;
  projectName?: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const canApprove = task.status === 'awaiting_approval';
  const canCancel = task.status === 'pending' || task.status === 'in_progress';

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await tasksService.approve(task.id);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await tasksService.cancel(task.id);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-b border-azure-border dark:border-matrix-primary/30 hover:bg-azure-surface/50 dark:hover:bg-zinc-800/50 transition-colors last:border-b-0">
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-azure-text-muted dark:text-matrix-secondary hover:text-azure-text-primary dark:hover:text-matrix-text transition-colors shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Project + Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            {projectName && (
              <span className="shrink-0 text-xs font-mono text-azure-text-secondary dark:text-matrix-dim bg-azure-surface dark:bg-zinc-800 border border-azure-border dark:border-matrix-primary/50 px-1.5 py-0.5 rounded">
                {projectName}
              </span>
            )}
            <span className="text-sm font-medium text-azure-text-primary dark:text-matrix-highlight truncate">
              {task.title}
            </span>
          </div>
          {task.session_id && (
            <p className="text-xs text-azure-text-muted dark:text-matrix-secondary font-mono mt-0.5">
              {task.id.slice(0, 8)}… · {new Date(task.created_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* Badges + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <AgentBadge assignee={task.assigned_to} />
          <StatusBadge status={task.status} />

          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50"
            >
              <Check className="w-3 h-3" />
              Approve
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 ml-7 space-y-3 border-t border-azure-border dark:border-matrix-primary/20 pt-3">
          {task.description && (
            <div>
              <p className="text-xs font-semibold text-azure-text-secondary dark:text-matrix-dim mb-1 uppercase">
                Description
              </p>
              <p className="text-sm text-azure-text-primary dark:text-matrix-text whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}
          {task.blueprint && (
            <div>
              <p className="text-xs font-semibold text-azure-text-secondary dark:text-matrix-dim mb-1 uppercase">
                Blueprint
              </p>
              <pre className="text-xs font-mono text-azure-text-primary dark:text-matrix-text bg-azure-bg dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/30 rounded-lg p-3 overflow-auto max-h-40">
                {task.blueprint}
              </pre>
            </div>
          )}
          {task.result && (
            <div>
              <p className="text-xs font-semibold text-azure-text-secondary dark:text-matrix-dim mb-1 uppercase">
                Result
              </p>
              <pre className="text-xs font-mono text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/20 rounded-lg p-3 overflow-auto max-h-40">
                {task.result}
              </pre>
            </div>
          )}
          {task.error && (
            <div>
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1 uppercase">
                Error
              </p>
              <pre className="text-xs font-mono text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3 overflow-auto max-h-40">
                {task.error}
              </pre>
            </div>
          )}
          <div className="text-xs text-azure-text-muted dark:text-matrix-secondary font-mono space-y-0.5">
            {task.working_dir && <p>Dir: {task.working_dir}</p>}
            {task.started_at && <p>Started: {new Date(task.started_at).toLocaleString()}</p>}
            {task.completed_at && <p>Completed: {new Date(task.completed_at).toLocaleString()}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tasks Page ───────────────────────────────────────────────────────────────

export function Tasks() {
  const [filter, setFilter] = useState<TaskFilter>({});

  const { data: projects = [] } = useSWR('/api/projects', () => projectsService.list());
  const { data: tasks = [], isLoading, mutate: refetch } = useSWR(
    ['/api/tasks', filter],
    () => tasksService.list(filter),
    { refreshInterval: 5000 },
  );

  const projectMap = Object.fromEntries(projects.map((p: Project) => [p.id, p.name]));

  const statuses: TaskStatus[] = [
    'pending',
    'in_progress',
    'awaiting_approval',
    'done',
    'failed',
    'cancelled',
  ];

  const selectClass =
    'px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-zinc-800 text-azure-text-primary dark:text-matrix-text text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight';

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ListTodo className="w-6 h-6 text-azure-primary dark:text-matrix-highlight" />
          <div>
            <h1 className="text-2xl font-bold text-azure-text-primary dark:text-matrix-highlight">
              Tasks
              {tasks.length > 0 && (
                <span className="ml-2 text-base font-normal text-azure-text-secondary dark:text-matrix-dim">
                  ({tasks.length})
                </span>
              )}
            </h1>
            <p className="text-sm text-azure-text-secondary dark:text-matrix-dim mt-0.5">
              Monitor and manage agent tasks in real time.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Approval Panel */}
      <motion.div variants={item}>
        <ApprovalPanel />
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
        <select
          value={filter.project_id ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, project_id: e.target.value || undefined }))}
          className={selectClass}
        >
          <option value="">All Projects</option>
          {projects.map((p: Project) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={filter.status ?? ''}
          onChange={(e) =>
            setFilter((f) => ({ ...f, status: (e.target.value || undefined) as any }))
          }
          className={selectClass}
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s].label}
            </option>
          ))}
        </select>

        <select
          value={filter.assigned_to ?? ''}
          onChange={(e) =>
            setFilter((f) => ({ ...f, assigned_to: (e.target.value || undefined) as any }))
          }
          className={selectClass}
        >
          <option value="">All Agents</option>
          <option value="apoc">Apoc</option>
          <option value="merovingian">Merovingian</option>
        </select>

        {(filter.project_id || filter.status || filter.assigned_to) && (
          <button
            onClick={() => setFilter({})}
            className="px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-dim text-sm hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
          >
            Clear filters
          </button>
        )}
      </motion.div>

      {/* Task List */}
      <motion.div
        variants={item}
        className="rounded-lg border border-azure-border dark:border-matrix-primary overflow-hidden"
      >
        {isLoading ? (
          <p className="px-4 py-8 text-center text-azure-text-secondary dark:text-matrix-dim text-sm">
            Loading tasks...
          </p>
        ) : tasks.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ListTodo className="w-10 h-10 mx-auto mb-3 text-azure-text-muted dark:text-matrix-secondary" />
            <p className="text-azure-text-secondary dark:text-matrix-dim text-sm">No tasks found.</p>
            <p className="text-azure-text-muted dark:text-matrix-secondary text-xs mt-1">
              Ask the Oracle to create a plan to generate tasks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-azure-border dark:divide-matrix-primary/20">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                projectName={task.project_id ? projectMap[task.project_id] : undefined}
                onRefresh={() => refetch()}
              />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
