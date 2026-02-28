import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { ToolGroupItem } from '../../services/chat';

interface AgentBlockProps {
  group: ToolGroupItem;
}

const AGENT_META: Record<string, { label: string; emoji: string; colorClass: string; bgClass: string }> = {
  apoc_delegate:    { label: 'Apoc',    emoji: '🧑‍🔬', colorClass: 'text-amber-600 dark:text-amber-400',   bgClass: 'bg-amber-50  dark:bg-amber-900/10'  },
  neo_delegate:     { label: 'Neo',     emoji: '🥷',   colorClass: 'text-violet-600 dark:text-violet-400', bgClass: 'bg-violet-50 dark:bg-violet-900/10' },
  trinity_delegate: { label: 'Trinity', emoji: '👩‍💻',  colorClass: 'text-teal-600  dark:text-teal-400',   bgClass: 'bg-teal-50   dark:bg-teal-900/10'   },
  smith_delegate:   { label: 'Smith',   emoji: '🕶️',   colorClass: 'text-gray-500  dark:text-gray-400',   bgClass: 'bg-gray-50   dark:bg-zinc-900'       },
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

  const meta = AGENT_META[group.call.name] ?? { label: group.call.name, emoji: '🤖', colorClass: 'text-gray-500', bgClass: 'bg-gray-50 dark:bg-zinc-900' };
  const hasResult = group.result !== null;
  const resultContent = group.result?.content ?? '';
  const isError = resultContent.startsWith('❌') || resultContent.toLowerCase().startsWith('error');
  const taskPreview = getTask(group.call.args).slice(0, 100);
  const smithName: string | null = group.call.args?.smith ?? null;

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-matrix-primary/40 overflow-hidden text-sm mb-1 ${meta.bgClass}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:brightness-95 dark:hover:brightness-110 transition-all"
      >
        <span className="text-base flex-shrink-0 leading-none">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-semibold ${meta.colorClass}`}>
            {meta.label}{smithName ? ` · ${smithName}` : ''}
          </div>
          {taskPreview && (
            <div className="text-xs text-gray-500 dark:text-matrix-secondary/60 truncate mt-0.5">
              {taskPreview}
            </div>
          )}
        </div>
        {hasResult ? (
          isError ? (
            <XCircle size={14} className="text-red-500 dark:text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle size={14} className="text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
          )
        ) : (
          <Loader2 size={14} className="text-gray-400 animate-spin flex-shrink-0" />
        )}
        <ChevronDown
          size={13}
          className={`text-gray-400 dark:text-matrix-secondary/40 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-1 border-t border-gray-200 dark:border-matrix-primary/20 space-y-2">
              {getTask(group.call.args) && (
                <div>
                  <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/40 uppercase tracking-wider mb-1">task</div>
                  <p className="text-xs text-gray-600 dark:text-matrix-secondary/80 bg-white dark:bg-black rounded-md p-2 border border-gray-100 dark:border-matrix-primary/20 whitespace-pre-wrap">
                    {getTask(group.call.args)}
                  </p>
                </div>
              )}
              {hasResult && (
                <div>
                  <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/40 uppercase tracking-wider mb-1">result</div>
                  <pre className="text-xs font-mono text-gray-600 dark:text-matrix-secondary/80 whitespace-pre-wrap break-all bg-white dark:bg-black rounded-md p-2 border border-gray-100 dark:border-matrix-primary/20 max-h-56 overflow-y-auto">
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
