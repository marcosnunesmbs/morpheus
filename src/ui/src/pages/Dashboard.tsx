import { useStatus } from '@/lib/api';
import {
  Activity, Cpu, Clock, Brain, Box, LayoutDashboard,
  ListChecks, Puzzle, HatGlasses, DollarSign, Wand2,
  ChevronRight, CheckCircle2, XCircle, LoaderCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/dashboard/StatCard';
import { formatUptime } from '@/lib/formatUptime';
import useSWR from 'swr';
import { taskService } from '../services/tasks';
import { statsService } from '../services/stats';
import { mcpService } from '../services/mcp';
import { skillsService } from '../services/skills';
import { httpClient } from '../services/httpClient';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

// ─── Module Card ─────────────────────────────────────────────────────────────

function ModuleCard({
  icon: Icon,
  title,
  to,
  children,
  status = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  to: string;
  children: React.ReactNode;
  status?: 'ok' | 'warn' | 'error' | 'neutral';
}) {
  const border =
    status === 'ok'    ? 'border-emerald-300/60 dark:border-emerald-700/40' :
    status === 'warn'  ? 'border-amber-300/60  dark:border-amber-700/40'   :
    status === 'error' ? 'border-red-300/60    dark:border-red-700/40'     :
    'border-azure-border dark:border-matrix-primary/50';

  return (
    <Link
      to={to}
      className={`group flex flex-col gap-3 rounded-lg border bg-white dark:bg-black p-4 hover:border-azure-primary dark:hover:border-matrix-highlight transition-colors ${border}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-azure-primary dark:text-matrix-highlight" />
          <span className="text-sm font-semibold text-azure-text dark:text-matrix-highlight">{title}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-azure-text-secondary dark:text-matrix-tertiary group-hover:text-azure-primary dark:group-hover:text-matrix-highlight transition-colors" />
      </div>
      <div className="space-y-1.5">{children}</div>
    </Link>
  );
}

function ModuleStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-azure-text-secondary dark:text-matrix-tertiary">{label}</span>
      <span className={highlight
        ? 'font-semibold text-azure-text dark:text-matrix-highlight'
        : 'text-azure-text-secondary dark:text-matrix-secondary'
      }>
        {value}
      </span>
    </div>
  );
}

// ─── Recent task row ──────────────────────────────────────────────────────────

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  if (status === 'failed')    return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  if (status === 'running')   return <LoaderCircle className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { data: status } = useStatus();

  const { data: taskStats } = useSWR(
    '/tasks/stats',
    () => taskService.stats(),
    { refreshInterval: 5_000 },
  );
  const { data: globalStats } = useSWR(
    '/api/stats/usage',
    () => statsService.fetchUsageStats(),
    { refreshInterval: 30_000 },
  );
  const { data: mcpStats } = useSWR(
    '/api/mcp/stats',
    () => mcpService.fetchStats(),
    { refreshInterval: 30_000 },
  );
  const { data: smithsData } = useSWR<{ online: number; total: number; enabled: boolean }>(
    '/smiths',
    () => httpClient.get('/smiths'),
    { refreshInterval: 10_000 },
  );
  const { data: chronosJobs = [] } = useSWR<{ id: string; enabled: boolean; next_run_at: number | null }[]>(
    '/chronos',
    () => httpClient.get('/chronos'),
    { refreshInterval: 30_000 },
  );
  const { data: skillsData } = useSWR(
    '/api/skills',
    () => skillsService.fetchSkills(),
    { refreshInterval: 60_000 },
  );
  const { data: recentTasks = [] } = useSWR(
    ['/tasks', { limit: 5 }],
    () => taskService.list({ limit: 5 }),
    { refreshInterval: 5_000 },
  );

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalTokens = (globalStats?.totalInputTokens ?? 0) + (globalStats?.totalOutputTokens ?? 0);
  const hasCost     = globalStats?.totalEstimatedCostUsd != null;
  const totalCost   = globalStats?.totalEstimatedCostUsd ?? 0;

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `${(n / 1_000).toFixed(1)}k`
    : String(n);

  const enabledJobs  = chronosJobs.filter(j => j.enabled);
  const nextJob      = enabledJobs.filter(j => j.next_run_at).sort((a, b) => a.next_run_at! - b.next_run_at!)[0];
  const nextRunIn    = nextJob?.next_run_at
    ? (() => {
        const d = nextJob.next_run_at! - Date.now();
        if (d < 0)          return 'due now';
        if (d < 60_000)     return `${Math.floor(d / 1_000)}s`;
        if (d < 3_600_000)  return `${Math.floor(d / 60_000)}m`;
        return `${Math.floor(d / 3_600_000)}h`;
      })()
    : null;

  const activeTasks    = (taskStats?.pending ?? 0) + (taskStats?.running ?? 0);
  const taskStatus     = taskStats?.failed ? 'warn' : activeTasks > 0 ? 'ok' : 'neutral';
  const mcpStatus      = (mcpStats?.totalTools ?? 0) > 0 ? 'ok' : 'neutral';
  const smithStatus    = (smithsData?.online ?? 0) > 0 ? 'ok' : (smithsData?.total ?? 0) > 0 ? 'warn' : 'neutral';
  const chronosStatus  = enabledJobs.length > 0 ? 'ok' : 'neutral';
  const skillsStatus   = (skillsData?.enabled ?? 0) > 0 ? 'ok' : 'neutral';

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">

      {/* ── Header ──────────────────────────────────────── */}
      <motion.div variants={item} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-azure-primary/10 dark:bg-matrix-highlight/10 border border-azure-primary/20 dark:border-matrix-highlight/30 flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-azure-primary dark:text-matrix-highlight" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-azure-text dark:text-matrix-highlight">Dashboard</h1>
          <p className="text-sm text-azure-text-secondary dark:text-matrix-tertiary">Overview of the Morpheus agent runtime.</p>
        </div>
      </motion.div>

      {/* ── System Status ───────────────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Agent Status"
          value={status?.status.toUpperCase() ?? 'CONNECTING...'}
          icon={Activity}
          subValue={status ? `PID: ${status.pid}` : ''}
        />
        <StatCard
          title="Uptime"
          value={status ? formatUptime(status.uptimeSeconds) : '-'}
          icon={Clock}
          subValue={status ? `${status.uptimeSeconds.toFixed(0)}s elapsed` : ''}
        />
        <StatCard
          title="Version"
          value={status?.projectVersion ?? '-'}
          icon={Cpu}
          subValue={`Node ${status?.nodeVersion ?? '-'}`}
        />
      </motion.div>

      {/* ── LLM & Usage ─────────────────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Provider */}
        <div className="rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-black p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-2">Provider</p>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-azure-primary dark:text-matrix-highlight shrink-0" />
            <p className="text-base font-bold text-azure-text dark:text-matrix-highlight truncate">
              {status?.llmProvider?.toUpperCase() ?? '—'}
            </p>
          </div>
        </div>

        {/* Model */}
        <div className="rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-black p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-2">Model</p>
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-azure-primary dark:text-matrix-highlight shrink-0" />
            <p className="text-sm font-bold text-azure-text dark:text-matrix-highlight truncate leading-tight">
              {status?.llmModel ?? '—'}
            </p>
          </div>
        </div>

        {/* Tokens */}
        <div className="rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-black p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-2">Total Tokens</p>
          <p className="text-xl font-bold text-azure-text dark:text-matrix-highlight">
            {totalTokens > 0 ? fmt(totalTokens) : '—'}
          </p>
          <p className="text-[10px] text-azure-text-secondary dark:text-matrix-tertiary mt-1">
            {fmt(globalStats?.totalInputTokens ?? 0)} in · {fmt(globalStats?.totalOutputTokens ?? 0)} out
          </p>
        </div>

        {/* Cost */}
        <div className="rounded-lg border border-azure-border dark:border-matrix-primary bg-white dark:bg-black p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-2">Est. Cost</p>
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-xl font-bold text-azure-text dark:text-matrix-highlight">
              {hasCost ? `$${totalCost.toFixed(4)}` : '—'}
            </p>
          </div>
          <p className="text-[10px] text-azure-text-secondary dark:text-matrix-tertiary mt-1">
            {hasCost ? 'accumulated total' : 'configure pricing to track'}
          </p>
        </div>
      </motion.div>

      {/* ── Platform ────────────────────────────────────── */}
      <motion.div variants={item}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-3">Platform</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

          <ModuleCard icon={Wand2} title="Skills" to="/skills" status={skillsStatus}>
            <ModuleStat
              label="Enabled"
              value={skillsData ? `${skillsData.enabled} / ${skillsData.total}` : '—'}
              highlight={(skillsData?.enabled ?? 0) > 0}
            />
            <ModuleStat label="Total" value={skillsData?.total ?? '—'} />
          </ModuleCard>


          <ModuleCard icon={Puzzle} title="MCP Servers" to="/mcp-servers" status={mcpStatus}>
            <ModuleStat label="Tools loaded" value={mcpStats?.totalTools ?? '—'} highlight={!!mcpStats?.totalTools} />
            <ModuleStat label="Servers"      value={mcpStats?.servers?.length ?? '—'} />
            {mcpStats?.lastLoadedAt && (
              <ModuleStat
                label="Last loaded"
                value={new Date(mcpStats.lastLoadedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              />
            )}
          </ModuleCard>
          
          <ModuleCard icon={HatGlasses} title="Smiths" to="/smiths" status={smithStatus}>
            <ModuleStat
              label="Online"
              value={smithsData ? `${smithsData.online} / ${smithsData.total}` : '—'}
              highlight={(smithsData?.online ?? 0) > 0}
            />
            <ModuleStat label="System" value={smithsData?.enabled ? 'enabled' : 'disabled'} />
          </ModuleCard>

          <ModuleCard icon={ListChecks} title="Tasks" to="/tasks" status={taskStatus}>
            <ModuleStat label="Running"   value={taskStats?.running   ?? '—'} highlight={!!taskStats?.running} />
            <ModuleStat label="Pending"   value={taskStats?.pending   ?? '—'} />
            <ModuleStat label="Completed" value={taskStats?.completed ?? '—'} />
            {(taskStats?.failed ?? 0) > 0 && (
              <ModuleStat label="Failed" value={taskStats!.failed} />
            )}
          </ModuleCard>

          <ModuleCard icon={Clock} title="Chronos" to="/chronos" status={chronosStatus}>
            <ModuleStat label="Active jobs" value={enabledJobs.length} highlight={enabledJobs.length > 0} />
            <ModuleStat label="Total jobs"  value={chronosJobs.length} />
            {nextRunIn && <ModuleStat label="Next run" value={`in ${nextRunIn}`} />}
          </ModuleCard>

          

        </div>
      </motion.div>

      {/* ── Recent Activity ──────────────────────────────── */}
      {recentTasks.length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary">
              Recent Tasks
            </p>
            <Link
              to="/tasks"
              className="flex items-center gap-0.5 text-xs text-azure-primary dark:text-matrix-highlight hover:underline"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="rounded-lg border border-azure-border dark:border-matrix-primary overflow-hidden">
            {recentTasks.map((task, i) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  i < recentTasks.length - 1 ? 'border-b border-azure-border dark:border-matrix-primary/30' : ''
                } hover:bg-azure-surface/60 dark:hover:bg-zinc-900/50 transition-colors`}
              >
                <TaskStatusIcon status={task.status} />
                <span className="font-mono text-[10px] text-azure-text-secondary dark:text-matrix-tertiary w-16 shrink-0">
                  {task.id.slice(0, 8)}
                </span>
                <span className="flex-1 text-xs text-azure-text dark:text-matrix-secondary truncate">
                  {task.input.slice(0, 100)}
                </span>
                <span className="text-[10px] font-mono uppercase text-azure-text-secondary dark:text-matrix-tertiary shrink-0">
                  {task.agent}
                </span>
                <span className="text-[10px] text-azure-text-secondary dark:text-matrix-tertiary shrink-0">
                  {new Date(task.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

    </motion.div>
  );
}
