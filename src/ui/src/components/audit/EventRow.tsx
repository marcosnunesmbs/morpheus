import React from 'react';
import { Zap, Wrench, Globe, CheckCircle, XCircle, Clock, Bot, Play, Brain } from 'lucide-react';
import type { AuditEvent } from '../../services/audit';

interface EventRowProps {
  event: AuditEvent;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  llm_call: <Zap size={14} />,
  tool_call: <Wrench size={14} />,
  mcp_tool: <Globe size={14} />,
  task_created: <Play size={14} />,
  task_completed: <CheckCircle size={14} />,
  skill_executed: <Bot size={14} />,
  chronos_job: <Clock size={14} />,
  memory_recovery: <Brain size={14} />,
};

const EVENT_COLORS: Record<string, string> = {
  llm_call: 'text-blue-400 dark:text-blue-400',
  tool_call: 'text-amber-500 dark:text-amber-400',
  mcp_tool: 'text-purple-500 dark:text-purple-400',
  task_created: 'text-gray-500 dark:text-matrix-secondary',
  task_completed: 'text-green-600 dark:text-matrix-highlight',
  skill_executed: 'text-teal-600 dark:text-teal-400',
  chronos_job: 'text-orange-500 dark:text-orange-400',
  memory_recovery: 'text-emerald-600 dark:text-emerald-400',
};

const AGENT_BADGES: Record<string, string> = {
  oracle: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  apoc: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  neo: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  trinity: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  smith: 'bg-gray-200 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300',
  keymaker: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  chronos: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  sati: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtCost(cost: number | null): string {
  if (cost == null || cost === 0) return '—';
  if (cost < 0.0001) return '<$0.0001';
  return `$${cost.toFixed(4)}`;
}

function fmtTokens(input: number | null, output: number | null): string {
  if (input == null && output == null) return '';
  const i = input ?? 0;
  const o = output ?? 0;
  return `↑${i.toLocaleString()} ↓${o.toLocaleString()}`;
}

export const EventRow: React.FC<EventRowProps> = ({ event }) => {
  const icon = EVENT_ICONS[event.event_type] ?? <Wrench size={14} />;
  const colorClass = EVENT_COLORS[event.event_type] ?? 'text-gray-500';
  const agentBadge = event.agent ? (AGENT_BADGES[event.agent] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300') : null;

  const parsedMeta = event.metadata ? JSON.parse(event.metadata) : null;
  const label = event.event_type === 'memory_recovery'
    ? `${parsedMeta?.memories_count ?? 0} memories retrieved`
    : (event.tool_name ?? event.model ?? event.event_type);
  const tokens = fmtTokens(event.input_tokens, event.output_tokens);

  const cost = fmtCost(event.estimated_cost_usd);
  const duration = fmtMs(event.duration_ms);
  const statusIcon = event.status === 'error'
    ? <XCircle size={14} className="text-red-500 flex-shrink-0" />
    : event.status === 'success'
      ? <CheckCircle size={14} className="text-green-500 dark:text-matrix-highlight flex-shrink-0" />
      : null;

  return (
    <div className="py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900/60 transition-colors border-b border-gray-100 dark:border-matrix-primary/20 last:border-0">

      {/* Mobile layout — 2 lines */}
      <div className="flex flex-col gap-0.5 md:hidden">
        {/* Line 1: icon + badge + label + status */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex-shrink-0 ${colorClass}`}>{icon}</span>
          {agentBadge && (
            <span className={`flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${agentBadge}`}>
              {event.agent}
            </span>
          )}
          <span className="flex-1 text-sm text-gray-700 dark:text-matrix-secondary font-mono break-all leading-snug">
            {label}
          </span>
          {statusIcon}
        </div>
        {/* Line 2: tokens · duration · cost */}
        <div className="flex flex-wrap gap-x-3 gap-y-0 pl-5 text-[11px] text-gray-400 dark:text-matrix-secondary/60 font-mono">
          {tokens && <span>{tokens}</span>}
          <span>{duration}</span>
          {cost !== '—' && <span className="text-gray-600 dark:text-matrix-secondary">{cost}</span>}
        </div>
      </div>

      {/* Desktop layout — single line */}
      <div className="hidden md:flex items-center gap-3">
        <span className={`flex-shrink-0 ${colorClass}`}>{icon}</span>
        {agentBadge && (
          <span className={`flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${agentBadge}`}>
            {event.agent}
          </span>
        )}
        <span className="flex-1 text-sm truncate text-gray-700 dark:text-matrix-secondary font-mono">
          {label}
        </span>
        {tokens && (
          <span className="text-xs text-gray-400 dark:text-matrix-secondary/60 font-mono whitespace-nowrap">
            {tokens}
          </span>
        )}
        <span className="text-xs text-gray-400 dark:text-matrix-secondary/60 font-mono w-16 text-right whitespace-nowrap">
          {duration}
        </span>
        {statusIcon}
        <span className="text-xs text-gray-400 dark:text-matrix-secondary/60 font-mono w-20 text-right whitespace-nowrap">
          {cost}
        </span>
      </div>

    </div>
  );
};
