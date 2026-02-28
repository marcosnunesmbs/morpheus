import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Wrench, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
    <div className="rounded-lg border border-gray-200 dark:border-matrix-primary/50 bg-gray-50 dark:bg-zinc-900 overflow-hidden text-sm mb-1.5">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors"
      >
        <Wrench size={13} className="text-amber-500 dark:text-amber-400 flex-shrink-0" />
        <span className="flex-1 font-mono text-xs text-gray-700 dark:text-matrix-secondary truncate">
          {group.call.name}
        </span>
        {hasResult ? (
          isError ? (
            <XCircle size={13} className="text-red-500 flex-shrink-0" />
          ) : (
            <CheckCircle size={13} className="text-green-500 dark:text-matrix-highlight flex-shrink-0" />
          )
        ) : (
          <Loader2 size={13} className="text-gray-400 animate-spin flex-shrink-0" />
        )}
        {open ? (
          <ChevronUp size={13} className="text-gray-400 dark:text-matrix-secondary/50 flex-shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-gray-400 dark:text-matrix-secondary/50 flex-shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-gray-200 dark:border-matrix-primary/30">
              {/* Args */}
              {Object.keys(group.call.args ?? {}).length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/50 uppercase tracking-wider mb-1">args</div>
                  <pre className="text-xs font-mono text-gray-600 dark:text-matrix-secondary whitespace-pre-wrap break-all bg-white dark:bg-black rounded p-2 border border-gray-100 dark:border-matrix-primary/20 max-h-40 overflow-y-auto">
                    {formatJson(group.call.args)}
                  </pre>
                </div>
              )}
              {/* Result */}
              {hasResult && (
                <div className="mt-2">
                  <div className="text-[10px] text-gray-400 dark:text-matrix-secondary/50 uppercase tracking-wider mb-1">result</div>
                  <pre className="text-xs font-mono text-gray-600 dark:text-matrix-secondary whitespace-pre-wrap break-all bg-white dark:bg-black rounded p-2 border border-gray-100 dark:border-matrix-primary/20 max-h-48 overflow-y-auto">
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
