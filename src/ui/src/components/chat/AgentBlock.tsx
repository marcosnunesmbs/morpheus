import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { ToolGroupItem } from '../../services/chat';

interface AgentBlockProps {
  group: ToolGroupItem;
}

const AGENT_META: Record<string, { label: string; emoji: string; color: string }> = {
  apoc_delegate:   { label: 'Apoc',   emoji: '🧑‍🔬', color: 'text-amber-600 dark:text-amber-400' },
  neo_delegate:    { label: 'Neo',    emoji: '🥷',  color: 'text-purple-600 dark:text-purple-400' },
  trinity_delegate:{ label: 'Trinity',emoji: '👩‍💻', color: 'text-teal-600 dark:text-teal-400' },
  smith_delegate:  { label: 'Smith',  emoji: '🕶️',  color: 'text-gray-600 dark:text-gray-300' },
};

function getTask(args: any): string {
  return args?.task ?? args?.prompt ?? '';
}

function formatOutput(content: string): string {
  if (typeof content !== 'string') return String(content);
  try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
}

export const AgentBlock: React.FC<AgentBlockProps> = ({ group }) => {
  const [open, setOpen] = useState(false);

  const meta = AGENT_META[group.call.name] ?? { label: group.call.name, emoji: '🤖', color: 'text-gray-500' };
  const hasResult = group.result !== null;
  const resultContent = group.result?.content ?? '';
  const isError = resultContent.startsWith('❌') || resultContent.toLowerCase().startsWith('error');
  const taskPreview = getTask(group.call.args).slice(0, 120);
  const smithName: string | null = group.call.args?.smith ?? null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-matrix-primary/70 bg-gray-50 dark:bg-zinc-900 overflow-hidden text-sm mb-2">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors"
      >
        <span className="text-base flex-shrink-0">{meta.emoji}</span>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-bold ${meta.color}`}>
              {meta.label}{smithName ? ` · ${smithName}` : ''}
            </span>
          </div>
          {taskPreview && (
            <span className="text-xs text-gray-500 dark:text-matrix-secondary/70 truncate mt-0.5">
              {taskPreview}
            </span>
          )}
        </div>

        {/* Status */}
        {hasResult ? (
          isError ? (
            <XCircle size={15} className="text-red-500 flex-shrink-0" />
          ) : (
            <CheckCircle size={15} className="text-green-500 dark:text-matrix-highlight flex-shrink-0" />
          )
        ) : (
          <Loader2 size={15} className="text-gray-400 animate-spin flex-shrink-0" />
        )}

        {open ? (
          <ChevronUp size={14} className="text-gray-400 dark:text-matrix-secondary/50 flex-shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-gray-400 dark:text-matrix-secondary/50 flex-shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-gray-200 dark:border-matrix-primary/30">
              {/* Full task */}
              {getTask(group.call.args) && (
                <div className="mt-2">
                  <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/50 uppercase tracking-wider mb-1">task</div>
                  <p className="text-xs text-gray-600 dark:text-matrix-secondary bg-white dark:bg-black rounded p-2 border border-gray-100 dark:border-matrix-primary/20 whitespace-pre-wrap">
                    {getTask(group.call.args)}
                  </p>
                </div>
              )}
              {/* Result */}
              {hasResult && (
                <div className="mt-2">
                  <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/50 uppercase tracking-wider mb-1">result</div>
                  <pre className="text-xs font-mono text-gray-600 dark:text-matrix-secondary whitespace-pre-wrap break-all bg-white dark:bg-black rounded p-2 border border-gray-100 dark:border-matrix-primary/20 max-h-60 overflow-y-auto">
                    {formatOutput(resultContent)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
