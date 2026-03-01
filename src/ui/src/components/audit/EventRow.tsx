import React, { useState } from 'react';
import { Zap, Wrench, CheckCircle, XCircle, Clock, Bot, Play, Brain, Mic, ChevronRight, ChevronDown } from 'lucide-react';
import type { AuditEvent } from '../../services/audit';

interface EventRowProps {
  event: AuditEvent;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  llm_call: <Zap size={16} />,
  tool_call: <Wrench size={16} />,
  mcp_tool: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.49994 11.7501L11.6717 3.57855C12.7762 2.47398 14.5672 2.47398 15.6717 3.57855C16.7762 4.68312 16.7762 6.47398 15.6717 7.57855M15.6717 7.57855L9.49994 13.7501M15.6717 7.57855C16.7762 6.47398 18.5672 6.47398 19.6717 7.57855C20.7762 8.68312 20.7762 10.474 19.6717 11.5785L12.7072 18.543C12.3167 18.9335 12.3167 19.5667 12.7072 19.9572L13.9999 21.2499" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.4999 9.74921L11.3282 15.921C10.2237 17.0255 8.43272 17.0255 7.32823 15.921C6.22373 14.8164 6.22373 13.0255 7.32823 11.921L13.4999 5.74939" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  task_created: <Play size={16} />,
  task_completed: <CheckCircle size={16} />,
  skill_executed: <Bot size={16} />,
  chronos_job: <Clock size={16} />,
  memory_recovery: <Brain size={16} />,
  telephonist: <Mic size={16} />,
};

const EVENT_COLORS: Record<string, string> = {
  llm_call: 'text-blue-400 dark:text-blue-400',
  tool_call: 'text-amber-500 dark:text-amber-400',
  mcp_tool: 'text-orange-500 dark:text-orange-400',
  task_created: 'text-gray-500 dark:text-matrix-secondary',
  task_completed: 'text-green-600 dark:text-matrix-highlight',
  skill_executed: 'text-teal-600 dark:text-teal-400',
  chronos_job: 'text-orange-500 dark:text-orange-400',
  memory_recovery: 'text-emerald-600 dark:text-emerald-400',
  telephonist: 'text-rose-500 dark:text-rose-400',
};

// Left-border accent colour for the expanded metadata panel
const META_BORDER_COLORS: Record<string, string> = {
  llm_call: 'border-blue-300 dark:border-blue-500/40',
  tool_call: 'border-amber-300 dark:border-amber-500/40',
  mcp_tool: 'border-purple-300 dark:border-purple-500/40',
  task_created: 'border-gray-300 dark:border-matrix-primary/40',
  task_completed: 'border-green-300 dark:border-matrix-highlight/40',
  skill_executed: 'border-teal-300 dark:border-teal-500/40',
  chronos_job: 'border-orange-300 dark:border-orange-500/40',
  memory_recovery: 'border-emerald-300 dark:border-emerald-500/40',
  telephonist: 'border-rose-300 dark:border-rose-500/40',
};

const AGENT_EMOJIS: Record<string, string> = {
  oracle: '🔮',
  apoc: '🧑‍🔬',
  neo: '🥷',
  trinity: '👩‍💻',
  smith: '🤖',
  keymaker: '🗝️',
  chronos: '⏰',
  sati: '🧠',
  telephonist: '📞',
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
  telephonist: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
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

function prettyValue(v: unknown): string {
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
}

function MetaPanel({ parsedMeta, eventType }: { parsedMeta: Record<string, unknown>; eventType: string }) {
  const isToolEvent = eventType === 'tool_call' || eventType === 'mcp_tool';
  const { args, result, ...rest } = parsedMeta as { args?: unknown; result?: unknown; [k: string]: unknown };

  if (isToolEvent && (args !== undefined || result !== undefined)) {
    return (
      <div className="space-y-2">
        {args !== undefined && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-matrix-secondary/50 mb-1">
              args
            </p>
            <pre className="text-[11px] font-mono text-gray-600 dark:text-matrix-secondary bg-gray-50 dark:bg-zinc-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {prettyValue(args)}
            </pre>
          </div>
        )}
        {result !== undefined && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-matrix-secondary/50 mb-1">
              result
            </p>
            <pre className="text-[11px] font-mono text-gray-600 dark:text-matrix-secondary bg-gray-50 dark:bg-zinc-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {prettyValue(result)}
            </pre>
          </div>
        )}
        {Object.keys(rest).length > 0 && (
          <pre className="text-[11px] font-mono text-gray-600 dark:text-matrix-secondary bg-gray-50 dark:bg-zinc-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(rest, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <pre className="text-[11px] font-mono text-gray-600 dark:text-matrix-secondary bg-gray-50 dark:bg-zinc-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
      {JSON.stringify(parsedMeta, null, 2)}
    </pre>
  );
}

export const EventRow: React.FC<EventRowProps> = ({ event }) => {
  const [open, setOpen] = useState(false);

  const icon = EVENT_ICONS[event.event_type] ?? <Wrench size={14} />;
  const colorClass = EVENT_COLORS[event.event_type] ?? 'text-gray-500';
  const metaBorderClass = META_BORDER_COLORS[event.event_type] ?? 'border-gray-300 dark:border-matrix-primary/40';
  const agentBadge = event.agent ? (AGENT_BADGES[event.agent] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300') : null;
  const agentEmoji = event.agent ? AGENT_EMOJIS[event.agent] : undefined;
  const agentLabel = agentEmoji ? `${event.agent?.toUpperCase()} ${agentEmoji}` : event.agent?.toUpperCase() || null;

  const parsedMeta: Record<string, unknown> | null = (() => {
    try { return event.metadata ? JSON.parse(event.metadata) : null; } catch { return null; }
  })();

  const hasExpandableMeta = parsedMeta !== null && Object.keys(parsedMeta).length > 0;

  const label = event.event_type === 'memory_recovery'
    ? `${parsedMeta?.memories_count ?? 0} memories retrieved`
    : event.event_type === 'telephonist'
      ? (() => {
          const secs = parsedMeta?.audio_duration_seconds;
          const preview = parsedMeta?.text_preview;
          const dur = secs != null ? `${secs}s` : '';
          const txt = typeof preview === 'string' && preview
            ? `"${preview.length > 60 ? preview.slice(0, 60) + '…' : preview}"`
            : '';
          return [dur, txt].filter(Boolean).join(' · ') || 'audio transcription';
        })()
      : (event.tool_name ?? event.model ?? event.event_type);

  const isTelephonist = event.event_type === 'telephonist';
  const audioDurationSecs = parsedMeta?.audio_duration_seconds;
  const tokens = isTelephonist
    ? (audioDurationSecs != null ? `🎵 ${audioDurationSecs}s audio` : '')
    : fmtTokens(event.input_tokens, event.output_tokens);

  const cost = fmtCost(event.estimated_cost_usd);
  const duration = fmtMs(event.duration_ms);
  const statusIcon = event.status === 'error'
    ? <XCircle size={14} className="text-red-500 flex-shrink-0" />
    : event.status === 'success'
      ? <CheckCircle size={14} className="text-green-500 dark:text-matrix-highlight flex-shrink-0" />
      : null;

  // Chevron toggle slot — always 14px wide so layout doesn't shift
  const chevron = (
    <span className={`flex-shrink-0 w-3.5 flex items-center justify-center transition-colors ${
      hasExpandableMeta
        ? 'text-gray-300 dark:text-matrix-secondary/30 hover:text-gray-500 dark:hover:text-matrix-secondary cursor-pointer'
        : 'text-transparent pointer-events-none'
    }`}>
      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    </span>
  );

  const handleToggle = () => { if (hasExpandableMeta) setOpen(o => !o); };

  return (
    <div className="py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900/60 transition-colors border-b border-gray-100 dark:border-matrix-primary/20 last:border-0">

      {/* Mobile layout — 2 lines */}
      <div className="flex flex-col gap-0.5 md:hidden">
        {/* Line 1: chevron + icon + badge + label + status */}
        <div
          className={`flex items-center gap-2 min-w-0 ${hasExpandableMeta ? 'cursor-pointer' : ''}`}
          onClick={handleToggle}
        >
          {chevron}
          <span className={`flex-shrink-0 ${colorClass}`}>{icon}</span>
          {agentBadge && (
            <span className={`flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${agentBadge}`}>
              {agentLabel}
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
      <div
        className={`hidden md:flex items-center gap-3 ${hasExpandableMeta ? 'cursor-pointer' : ''}`}
        onClick={handleToggle}
      >
        {chevron}
        <span className={`flex-shrink-0 ${colorClass}`}>{icon}</span>
        {agentBadge && (
          <span className={`flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${agentBadge}`}>
            {agentLabel}
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

      {/* Metadata panel — shown when expanded */}
      {open && hasExpandableMeta && parsedMeta && (
        <div className={`mt-1.5 ml-5 pl-3 border-l-2 ${metaBorderClass}`}>
          <MetaPanel parsedMeta={parsedMeta} eventType={event.event_type} />
        </div>
      )}

    </div>
  );
};
