import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
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
import { projectsService } from '../services/projects';
import { ApprovalPanel } from '../components/ApprovalPanel';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; icon: React.ElementType; classes: string }
> = {
  pending: { label: 'Pending', icon: Clock, classes: 'bg-gray-800 text-gray-300 border-gray-600' },
  in_progress: {
    label: 'Running',
    icon: Loader2,
    classes: 'bg-blue-900/40 text-blue-300 border-blue-500/50 animate-pulse',
  },
  done: { label: 'Done', icon: CheckCircle2, classes: 'bg-green-900/40 text-green-300 border-green-500/50' },
  failed: { label: 'Failed', icon: XCircle, classes: 'bg-red-900/40 text-red-300 border-red-500/50' },
  cancelled: { label: 'Cancelled', icon: Ban, classes: 'bg-gray-900/40 text-gray-500 border-gray-700' },
  awaiting_approval: {
    label: 'Awaiting Approval',
    icon: ShieldAlert,
    classes: 'bg-yellow-900/40 text-yellow-300 border-yellow-500/50',
  },
};

const AGENT_CONFIG: Record<string, { label: string; classes: string }> = {
  apoc: { label: 'Apoc', classes: 'bg-red-900/30 text-red-300 border-red-500/40' },
  merovingian: { label: 'Merovingian', classes: 'bg-purple-900/30 text-purple-300 border-purple-500/40' },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded border ${cfg.classes}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function AgentBadge({ assignee }: { assignee?: string }) {
  if (!assignee) return null;
  const cfg = AGENT_CONFIG[assignee] ?? { label: assignee, classes: 'bg-gray-800 text-gray-400 border-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono rounded border ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onRefresh }: { task: Task; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const canApprove = task.status === 'awaiting_approval';
  const canCancel = task.status === 'pending' || task.status === 'in_progress';

  const handleApprove = async () => {
    setLoading(true);
    try {
      await tasksService.approve(task.id);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await tasksService.cancel(task.id);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-green-500/20 rounded-lg bg-gray-900/40 hover:border-green-500/30 transition-colors">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-gray-500 hover:text-gray-300">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-green-300 font-mono text-sm font-medium truncate">{task.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AgentBadge assignee={task.assigned_to} />
          <StatusBadge status={task.status} />
          {canApprove && (
            <button
              onClick={(e) => { e.stopPropagation(); handleApprove(); }}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 bg-green-700/50 hover:bg-green-600/60 text-green-300 text-xs font-mono rounded border border-green-500/40 transition-colors disabled:opacity-50"
            >
              <Check className="w-3 h-3" />
              Approve
            </button>
          )}
          {canCancel && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 bg-red-900/30 hover:bg-red-800/40 text-red-300 text-xs font-mono rounded border border-red-500/30 transition-colors disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-green-500/10 p-4 space-y-3">
          {task.description && (
            <div>
              <p className="text-gray-500 text-xs font-mono mb-1">Description</p>
              <p className="text-gray-300 text-sm font-mono whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
          {task.blueprint && (
            <div>
              <p className="text-gray-500 text-xs font-mono mb-1">Blueprint</p>
              <pre className="text-gray-300 text-xs font-mono bg-black/40 rounded p-3 overflow-auto max-h-40">
                {task.blueprint}
              </pre>
            </div>
          )}
          {task.result && (
            <div>
              <p className="text-gray-500 text-xs font-mono mb-1">Result</p>
              <pre className="text-green-300 text-xs font-mono bg-black/40 rounded p-3 overflow-auto max-h-40">
                {task.result}
              </pre>
            </div>
          )}
          {task.error && (
            <div>
              <p className="text-red-400 text-xs font-mono mb-1">Error</p>
              <pre className="text-red-300 text-xs font-mono bg-red-900/10 border border-red-500/20 rounded p-3 overflow-auto max-h-40">
                {task.error}
              </pre>
            </div>
          )}
          <div className="text-xs text-gray-600 font-mono space-y-0.5">
            {task.working_dir && <p>Dir: {task.working_dir}</p>}
            <p>Created: {new Date(task.created_at).toLocaleString()}</p>
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

  const statuses: TaskStatus[] = [
    'pending',
    'in_progress',
    'awaiting_approval',
    'done',
    'failed',
    'cancelled',
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ListTodo className="w-6 h-6 text-green-400" />
        <h1 className="text-2xl font-bold text-green-400 font-mono">Tasks</h1>
        {tasks.length > 0 && (
          <span className="text-sm text-gray-400 font-mono">({tasks.length})</span>
        )}
      </div>

      {/* Approval Panel */}
      <ApprovalPanel />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filter.project_id ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, project_id: e.target.value || undefined }))}
          className="bg-black border border-green-500/30 text-green-300 text-xs font-mono rounded px-3 py-2 focus:outline-none"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={filter.status ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, status: (e.target.value || undefined) as any }))}
          className="bg-black border border-green-500/30 text-green-300 text-xs font-mono rounded px-3 py-2 focus:outline-none"
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
          onChange={(e) => setFilter((f) => ({ ...f, assigned_to: (e.target.value || undefined) as any }))}
          className="bg-black border border-green-500/30 text-green-300 text-xs font-mono rounded px-3 py-2 focus:outline-none"
        >
          <option value="">All Agents</option>
          <option value="apoc">Apoc</option>
          <option value="merovingian">Merovingian</option>
        </select>

        <button
          onClick={() => setFilter({})}
          className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200 font-mono border border-gray-700 hover:border-gray-500 rounded transition-colors"
        >
          Clear filters
        </button>
      </div>

      {/* Task List */}
      {isLoading ? (
        <p className="text-gray-400 font-mono text-sm">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="border border-green-500/20 rounded-lg p-8 text-center">
          <ListTodo className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-mono">No tasks found.</p>
          <p className="text-gray-600 font-mono text-sm mt-1">
            Ask the Oracle to create a plan to generate tasks.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onRefresh={() => refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}
