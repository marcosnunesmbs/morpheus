import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Wrench, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { ToolGroupItem } from '../../services/chat';

interface ToolCallBlockProps {
  group: ToolGroupItem;
}

function formatJson(val: any): string {
  if (val == null) return '';
  if (typeof val === 'string') {
    try { return JSON.stringify(JSON.parse(val), null, 2); } catch { return val; }
  }
  try { return JSON.stringify(val, null, 2); } catch { return String(val); }
}

export const ToolCallBlock: React.FC<ToolCallBlockProps> = ({ group }) => {
  const [open, setOpen] = useState(false);

  const hasResult = group.result !== null;
  const resultContent = group.result?.content ?? '';
  const isError = resultContent.startsWith('Error') || resultContent.startsWith('❌');

  return (
    <div className="rounded-lg border border-gray-300 dark:border-matrix-primary/70 bg-white dark:bg-black overflow-hidden text-sm mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-900/60 transition-colors"
      >
        <Wrench size={12} className="text-amber-500 dark:text-amber-400/80 flex-shrink-0" />
        <span className="flex-1 font-mono text-xs text-gray-600 dark:text-matrix-secondary/80 truncate">
          {group.call.name}
        </span>
        {hasResult ? (
          isError ? (
            <XCircle size={12} className="text-red-500 dark:text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle size={12} className="text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
          )
        ) : (
          <Loader2 size={12} className="text-gray-400 animate-spin flex-shrink-0" />
        )}
        <ChevronDown
          size={12}
          className={`text-gray-400 dark:text-matrix-secondary/40 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-1 border-t border-gray-100 dark:border-matrix-primary/20 space-y-2">
              {Object.keys(group.call.args ?? {}).length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/40 uppercase tracking-wider mb-1">args</div>
                  <pre className="text-xs font-mono text-gray-600 dark:text-matrix-secondary/80 whitespace-pre-wrap break-all bg-gray-50 dark:bg-zinc-900 rounded-md p-2 border border-gray-100 dark:border-matrix-primary/20 max-h-36 overflow-y-auto">
                    {formatJson(group.call.args)}
                  </pre>
                </div>
              )}
              {hasResult && (
                <div>
                  <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/40 uppercase tracking-wider mb-1">result</div>
                  <pre className="text-xs font-mono text-gray-600 dark:text-matrix-secondary/80 whitespace-pre-wrap break-all bg-gray-50 dark:bg-zinc-900 rounded-md p-2 border border-gray-100 dark:border-matrix-primary/20 max-h-44 overflow-y-auto">
                    {formatJson(resultContent)}
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
