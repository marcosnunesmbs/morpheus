import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Zap,
  Wrench,
  Brain,
  Mic,
  Clock,
  Bot,
  Play,
  CheckCircle2,
  DollarSign,
  Activity,
  BarChart3,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { useGlobalAudit } from '../services/audit';
import type { GlobalAuditDailyActivity } from '../services/audit';
import { useAgentMetadata } from '../services/agents';
import { useCurrency } from '../hooks/useCurrency';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function fmtDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function pct(a: number, b: number): string {
  if (!b) return '0%';
  return `${Math.round((a / b) * 100)}%`;
}

// ─── Mini bar chart for daily activity ────────────────────────────────────────

function ActivityBars({ data }: { data: GlobalAuditDailyActivity[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!data.length) return <p className="text-xs text-gray-400 dark:text-matrix-secondary/50 py-4">No activity in the last 30 days.</p>;

  const maxEvents = Math.max(...data.map(d => d.eventCount), 1);

  return (
    <div className="flex items-end gap-0.5 h-24 w-full relative">
      {data.map((d, i) => {
        const h = Math.max(4, Math.round((d.eventCount / maxEvents) * 88));
        const isHov = hovered === i;
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center justify-end group"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {isHov && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 bg-gray-900 dark:bg-zinc-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap pointer-events-none shadow-lg">
                {d.date}: {d.eventCount} events · {fmtCost(d.estimatedCostUsd)}
              </div>
            )}
            <div
              style={{ height: h }}
              className={`w-full rounded-t transition-colors ${
                isHov
                  ? 'bg-blue-500 dark:bg-matrix-highlight'
                  : 'bg-blue-300/70 dark:bg-matrix-highlight/40 group-hover:bg-blue-400 dark:group-hover:bg-matrix-highlight/60'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, color = 'blue',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'teal';
}) {
  const colors = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-matrix-highlight border-green-200 dark:border-green-800/40',
    amber:  'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40',
    rose:   'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40',
    teal:   'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/40',
  };
  return (
    <div className={`rounded-lg border p-4 flex gap-3 items-start ${colors[color]}`}>
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium opacity-70 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-xl font-bold font-mono leading-tight">{value}</p>
        {sub && <div className="text-[11px] opacity-60 mt-0.5 leading-snug">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-matrix-primary overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
      <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-matrix-primary flex items-center gap-2">
        <span className="text-gray-500 dark:text-matrix-secondary/70">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-matrix-secondary uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Agent badge ──────────────────────────────────────────────────────────────

function AgentBadge({ agent }: { agent: string }) {
  const { getByKey } = useAgentMetadata();
  const meta = getByKey(agent);
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded ${meta.badgeClass}`}>
      {meta.emoji} {agent.toUpperCase()}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-matrix-highlight',
    paused:   'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-matrix-secondary',
    archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    deleted:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    unknown:  'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-matrix-secondary/60',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${map[status] ?? map.unknown}`}>
      {status}
    </span>
  );
}

// ─── Event type breakdown row ─────────────────────────────────────────────────

const EVENT_ICONS: Record<string, React.ReactNode> = {
  llm_call:        <Zap size={13} />,
  tool_call:       <Wrench size={13} />,
  mcp_tool: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.49994 11.7501L11.6717 3.57855C12.7762 2.47398 14.5672 2.47398 15.6717 3.57855C16.7762 4.68312 16.7762 6.47398 15.6717 7.57855M15.6717 7.57855L9.49994 13.7501M15.6717 7.57855C16.7762 6.47398 18.5672 6.47398 19.6717 7.57855C20.7762 8.68312 20.7762 10.474 19.6717 11.5785L12.7072 18.543C12.3167 18.9335 12.3167 19.5667 12.7072 19.9572L13.9999 21.2499" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.4999 9.74921L11.3282 15.921C10.2237 17.0255 8.43272 17.0255 7.32823 15.921C6.22373 14.8164 6.22373 13.0255 7.32823 11.921L13.4999 5.74939" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  memory_recovery: <Brain size={13} />,
  memory_persist:  <Brain size={13} />,
  telephonist:     <Mic size={13} />,
  skill_loaded:  <Bot size={13} />,
  chronos_job:     <Clock size={13} />,
  task_created:    <Play size={13} />,
  task_completed:  <CheckCircle2 size={13} />,
};
const EVENT_COLORS: Record<string, string> = {
  llm_call:        'text-blue-500 dark:text-blue-400',
  tool_call:       'text-amber-500 dark:text-amber-400',
  mcp_tool:        'text-purple-500 dark:text-purple-400',
  memory_recovery: 'text-emerald-500 dark:text-emerald-400',
  memory_persist:  'text-violet-500 dark:text-violet-400',
  telephonist:     'text-rose-500 dark:text-rose-400',
  skill_loaded:  'text-teal-500 dark:text-teal-400',
  chronos_job:     'text-orange-500 dark:text-orange-400',
  task_created:    'text-gray-500 dark:text-matrix-secondary',
  task_completed:  'text-green-600 dark:text-matrix-highlight',
};
function ToolTypeIcon({ eventType }: { eventType: string }) {
  if (eventType === 'mcp_tool') {
    return (
      <span className="flex-shrink-0 text-purple-500 dark:text-purple-400">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.49994 11.7501L11.6717 3.57855C12.7762 2.47398 14.5672 2.47398 15.6717 3.57855C16.7762 4.68312 16.7762 6.47398 15.6717 7.57855M15.6717 7.57855L9.49994 13.7501M15.6717 7.57855C16.7762 6.47398 18.5672 6.47398 19.6717 7.57855C20.7762 8.68312 20.7762 10.474 19.6717 11.5785L12.7072 18.543C12.3167 18.9335 12.3167 19.5667 12.7072 19.9572L13.9999 21.2499" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M17.4999 9.74921L11.3282 15.921C10.2237 17.0255 8.43272 17.0255 7.32823 15.921C6.22373 14.8164 6.22373 13.0255 7.32823 11.921L13.4999 5.74939" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }
  return <Wrench size={13} className="flex-shrink-0 text-amber-500 dark:text-amber-400" />;
}

const EVENT_BAR_COLORS: Record<string, string> = {
  llm_call:        'bg-blue-400 dark:bg-blue-500',
  tool_call:       'bg-amber-400 dark:bg-amber-500',
  mcp_tool:        'bg-purple-400 dark:bg-purple-500',
  memory_recovery: 'bg-emerald-400 dark:bg-emerald-500',
  memory_persist:  'bg-violet-400 dark:bg-violet-500',
  telephonist:     'bg-rose-400 dark:bg-rose-500',
  skill_loaded:  'bg-teal-400 dark:bg-teal-500',
  chronos_job:     'bg-orange-400 dark:bg-orange-500',
  task_created:    'bg-gray-300 dark:bg-matrix-secondary/50',
  task_completed:  'bg-green-400 dark:bg-matrix-highlight/70',
};

// ─── Main page ────────────────────────────────────────────────────────────────

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export const AuditDashboard: React.FC = () => {
  const { data, isLoading, mutate } = useGlobalAudit();
  const { fmtCost } = useCurrency();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-400 dark:text-matrix-secondary">
        <RefreshCw size={20} className="animate-spin" />
        <span className="text-sm font-mono">Loading audit data…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-gray-400 dark:text-matrix-secondary">
        <AlertTriangle size={24} />
        <span className="text-sm">Failed to load audit data.</span>
      </div>
    );
  }

  const { sessions, totals, byAgent, byModel, topTools, recentSessions, dailyActivity } = data;

  // Event breakdown entries sorted by count
  const eventBreakdown = ([
    ['llm_call',        totals.llmCallCount],
    ['tool_call',       totals.toolCallCount],
    ['mcp_tool',        totals.mcpToolCount],
    ['memory_recovery', totals.memoryRecoveryCount],
    ['memory_persist',  totals.memoryPersistCount],
    ['telephonist',     totals.telephonistCount],
    ['skill_loaded',  totals.skillCount],
    ['chronos_job',     totals.chronosJobCount],
    ['task_created',    totals.taskCreatedCount],
    ['task_completed',  totals.taskCompletedCount],
  ] as [string, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  const maxEventCount = Math.max(...eventBreakdown.map(([, n]) => n), 1);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">

      {/* ── Header ── */}
      <motion.div variants={item} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-matrix-highlight">Global Audit</h1>
            <p className="text-sm text-gray-500 dark:text-matrix-secondary/60 mt-0.5">
              {sessions.withAudit} sessions with audit data · {totals.totalEventCount.toLocaleString()} events total
            </p>
          </div>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-matrix-primary text-sm text-gray-500 dark:text-matrix-secondary hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </motion.div>

      {/* ── Top stat cards ── */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<DollarSign size={16} />}  label="Total Cost"    value={fmtCost(totals.estimatedCostUsd)} color="green" />
        <StatCard icon={<Zap size={16} />}          label="LLM Calls"    value={totals.llmCallCount.toLocaleString()} color="blue" />
        <StatCard icon={<Wrench size={16} />}       label="Tool Calls"   value={(totals.toolCallCount + totals.mcpToolCount).toLocaleString()} sub={<><span>{totals.toolCallCount} native</span><br /><span>{totals.mcpToolCount} MCP</span></>} color="amber" />
        <StatCard icon={<Brain size={16} />}        label="Memory Hits"  value={totals.memoryRecoveryCount.toLocaleString()} color="teal" />
        <StatCard icon={<Activity size={16} />}     label="Total Tokens" value={fmtTokens(totals.totalInputTokens + totals.totalOutputTokens)} sub={<><span>↑{fmtTokens(totals.totalInputTokens)} in</span><br /><span>↓{fmtTokens(totals.totalOutputTokens)} out</span></>} color="purple" />
        <StatCard icon={<Clock size={16} />}        label="Total Time"   value={fmtMs(totals.totalDurationMs)} color="rose" />
      </motion.div>

      {/* ── Sessions overview + Daily activity ── */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Sessions by status */}
        <Section title="Sessions" icon={<Layers size={14} />}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Total',    value: sessions.total,    cls: 'text-gray-700 dark:text-matrix-secondary' },
              { label: 'With Audit', value: sessions.withAudit, cls: 'text-blue-600 dark:text-blue-400' },
              { label: 'Active',   value: sessions.active,   cls: 'text-green-600 dark:text-matrix-highlight' },
              { label: 'Paused',   value: sessions.paused,   cls: 'text-gray-500 dark:text-matrix-secondary' },
              { label: 'Archived', value: sessions.archived, cls: 'text-amber-600 dark:text-amber-400' },
              { label: 'Deleted',  value: sessions.deleted,  cls: 'text-red-500 dark:text-red-400' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-matrix-secondary/50">{label}</span>
                <span className={`text-2xl font-bold font-mono ${cls}`}>{value}</span>
              </div>
            ))}
          </div>
          {/* Status bar */}
          {sessions.total > 0 && (
            <div className="h-2 rounded-full overflow-hidden flex gap-px">
              {sessions.active   > 0 && <div className="bg-green-400 dark:bg-matrix-highlight/70" style={{ flex: sessions.active }} />}
              {sessions.paused   > 0 && <div className="bg-gray-300 dark:bg-matrix-primary/50"   style={{ flex: sessions.paused }} />}
              {sessions.archived > 0 && <div className="bg-amber-400 dark:bg-amber-500/70"        style={{ flex: sessions.archived }} />}
              {sessions.deleted  > 0 && <div className="bg-red-400 dark:bg-red-500/70"            style={{ flex: sessions.deleted }} />}
            </div>
          )}
        </Section>

        {/* Daily activity */}
        <Section title="Activity — Last 30 Days" icon={<BarChart3 size={14} />}>
          <ActivityBars data={dailyActivity} />
          {dailyActivity.length > 0 && (
            <div className="flex gap-4 mt-2 text-[11px] text-gray-400 dark:text-matrix-secondary/50 font-mono">
              <span>{dailyActivity[0]?.date}</span>
              <span className="flex-1 text-right">{dailyActivity[dailyActivity.length - 1]?.date}</span>
            </div>
          )}
        </Section>
      </motion.div>

      {/* ── Event type breakdown ── */}
      <motion.div variants={item}>
        <Section title="Events by Type" icon={<Activity size={14} />}>
          <div className="space-y-2">
            {eventBreakdown.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className={`flex-shrink-0 w-5 flex justify-center ${EVENT_COLORS[type] ?? 'text-gray-400'}`}>
                  {EVENT_ICONS[type]}
                </span>
                <span className="text-xs font-mono text-gray-600 dark:text-matrix-secondary w-32 flex-shrink-0">
                  {type}
                </span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${EVENT_BAR_COLORS[type] ?? 'bg-gray-400'}`}
                    style={{ width: pct(count, maxEventCount) }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500 dark:text-matrix-secondary w-16 text-right">
                  {count.toLocaleString()}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-matrix-secondary/50 w-10 text-right">
                  {pct(count, totals.totalEventCount)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </motion.div>

      {/* ── By Agent + By Model ── */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* By Agent */}
        <Section title="By Agent" icon={<Bot size={14} />}>
          {byAgent.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-matrix-secondary/50">No agent data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-matrix-secondary/50 border-b border-gray-100 dark:border-matrix-primary/30">
                    <th className="pb-2 text-left">Agent</th>
                    <th className="pb-2 text-right">LLM</th>
                    <th className="pb-2 text-right">Tools</th>
                    <th className="pb-2 text-right">Tokens</th>
                    <th className="pb-2 text-right">Time</th>
                    <th className="pb-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-matrix-primary/20">
                  {byAgent.map(row => (
                    <tr key={row.agent} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                      <td className="py-1.5"><AgentBadge agent={row.agent} /></td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-matrix-secondary">{row.llmCalls.toLocaleString()}</td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-matrix-secondary">{row.toolCalls.toLocaleString()}</td>
                      <td className="py-1.5 text-right text-gray-500 dark:text-matrix-secondary/70">
                        ↑{fmtTokens(row.inputTokens)} ↓{fmtTokens(row.outputTokens)}
                      </td>
                      <td className="py-1.5 text-right text-gray-500 dark:text-matrix-secondary/70">{fmtMs(row.totalDurationMs)}</td>
                      <td className="py-1.5 text-right font-semibold text-gray-700 dark:text-matrix-secondary">{fmtCost(row.estimatedCostUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* By Model */}
        <Section title="By Model" icon={<Zap size={14} />}>
          {byModel.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-matrix-secondary/50">No model data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-matrix-secondary/50 border-b border-gray-100 dark:border-matrix-primary/30">
                    <th className="pb-2 text-left">Model</th>
                    <th className="pb-2 text-right">Calls</th>
                    <th className="pb-2 text-right">In</th>
                    <th className="pb-2 text-right">Out</th>
                    <th className="pb-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-matrix-primary/20">
                  {byModel.map(row => (
                    <tr key={`${row.provider}/${row.model}`} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                      <td className="py-1.5">
                        <div className="text-gray-700 dark:text-matrix-secondary break-all leading-tight">{row.model}</div>
                        <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/40">{row.provider}</div>
                      </td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-matrix-secondary">{row.calls.toLocaleString()}</td>
                      <td className="py-1.5 text-right text-gray-500 dark:text-matrix-secondary/70">{fmtTokens(row.inputTokens)}</td>
                      <td className="py-1.5 text-right text-gray-500 dark:text-matrix-secondary/70">{fmtTokens(row.outputTokens)}</td>
                      <td className="py-1.5 text-right font-semibold text-gray-700 dark:text-matrix-secondary">{fmtCost(row.estimatedCostUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </motion.div>

      {/* ── Top Tools ── */}
      {topTools.length > 0 && (
        <motion.div variants={item}>
          <Section title="Top Tools" icon={<Wrench size={14} />}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-matrix-secondary/50 border-b border-gray-100 dark:border-matrix-primary/30">
                    <th className="pb-2 text-left">Tool</th>
                    <th className="pb-2 text-left">Agent</th>
                    <th className="pb-2 text-right">Calls</th>
                    <th className="pb-2 text-right">Errors</th>
                    <th className="pb-2 text-right">Error rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-matrix-primary/20">
                  {topTools.map((row, i) => {
                    const errRate = row.count ? row.errorCount / row.count : 0;
                    return (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                        <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <ToolTypeIcon eventType={row.event_type} />
                          <span className="text-gray-700 dark:text-matrix-secondary break-all">{row.tool_name}</span>
                        </div>
                      </td>
                        <td className="py-1.5">{row.agent ? <AgentBadge agent={row.agent} /> : <span className="text-gray-400">—</span>}</td>
                        <td className="py-1.5 text-right text-gray-600 dark:text-matrix-secondary">{row.count.toLocaleString()}</td>
                        <td className="py-1.5 text-right">
                          <span className={row.errorCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-matrix-secondary/50'}>
                            {row.errorCount}
                          </span>
                        </td>
                        <td className="py-1.5 text-right">
                          <span className={errRate > 0.1 ? 'text-red-500 dark:text-red-400' : errRate > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-matrix-secondary/50'}>
                            {row.count > 0 ? `${Math.round(errRate * 100)}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </motion.div>
      )}

      {/* ── Recent Sessions ── */}
      <motion.div variants={item}>
        <Section title="Recent Sessions with Audit" icon={<ShieldCheck size={14} />}>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-matrix-secondary/50">No sessions with audit data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-matrix-secondary/50 border-b border-gray-100 dark:border-matrix-primary/30">
                    <th className="pb-2 text-left">Session</th>
                    <th className="pb-2 text-left">Status</th>
                    <th className="pb-2 text-right">Events</th>
                    <th className="pb-2 text-right">LLM</th>
                    <th className="pb-2 text-right">Duration</th>
                    <th className="pb-2 text-right">Cost</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-matrix-primary/20">
                  {recentSessions.map(row => (
                    <tr key={row.session_id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                      <td className="py-2">
                        <div className="text-gray-700 dark:text-matrix-secondary truncate max-w-[160px]" title={row.title ?? row.session_id}>
                          {row.title ?? <span className="text-gray-400 dark:text-matrix-secondary/40 font-mono text-[10px]">{row.session_id.slice(0, 12)}…</span>}
                        </div>
                        {row.started_at && (
                          <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/40">{fmtDate(row.started_at)}</div>
                        )}
                      </td>
                      <td className="py-2"><StatusBadge status={row.status} /></td>
                      <td className="py-2 text-right text-gray-600 dark:text-matrix-secondary">{row.event_count.toLocaleString()}</td>
                      <td className="py-2 text-right text-gray-500 dark:text-matrix-secondary/70">{row.llmCallCount.toLocaleString()}</td>
                      <td className="py-2 text-right text-gray-500 dark:text-matrix-secondary/70">{fmtMs(row.totalDurationMs)}</td>
                      <td className="py-2 text-right font-semibold text-gray-700 dark:text-matrix-secondary">{fmtCost(row.estimatedCostUsd)}</td>
                      <td className="py-2 text-right">
                        <Link
                          to={`/sessions/${row.session_id}/audit`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-matrix-primary text-gray-400 dark:text-matrix-secondary hover:text-blue-600 dark:hover:text-matrix-highlight hover:border-blue-300 dark:hover:border-matrix-highlight/50 transition-colors"
                          title="View session audit"
                        >
                          <ExternalLink size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </motion.div>

      {/* ── Audio summary (shown only if there is telephonist usage) ── */}
      {totals.telephonistCount > 0 && (
        <motion.div variants={item}>
          <Section title="Audio / Telephonist" icon={<Mic size={14} />}>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-matrix-secondary/50 mb-0.5">Calls</p>
                <p className="text-2xl font-bold font-mono text-rose-500 dark:text-rose-400">{totals.telephonistCount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-matrix-secondary/50 mb-0.5">Total Audio</p>
                <p className="text-2xl font-bold font-mono text-rose-500 dark:text-rose-400">
                  {totals.totalAudioSeconds < 60
                    ? `${totals.totalAudioSeconds.toFixed(1)}s`
                    : `${(totals.totalAudioSeconds / 60).toFixed(1)}m`}
                </p>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

    </motion.div>
  );
};
