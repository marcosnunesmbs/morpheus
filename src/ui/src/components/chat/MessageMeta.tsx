import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Message } from '../../services/chat';

interface MessageMetaProps {
  message: Message;
}

function fmtMs(ms: number | null | undefined): string | null {
  if (ms == null || ms === 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const MessageMeta: React.FC<MessageMetaProps> = ({ message }) => {
  const [open, setOpen] = useState(false);

  const usage = message.usage_metadata as any;
  const inputTokens: number = usage?.input_tokens ?? usage?.prompt_tokens ?? 0;
  const outputTokens: number = usage?.output_tokens ?? usage?.completion_tokens ?? 0;
  const hasTokens = inputTokens > 0 || outputTokens > 0;
  const duration = fmtMs(message.duration_ms);
  const provider = message.provider;
  const model = message.model;

  if (!hasTokens && !duration && !model) return null;

  return (
    <div className="mt-2 border-t border-gray-100 dark:border-matrix-primary/20 pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-matrix-secondary/50 hover:text-gray-600 dark:hover:text-matrix-secondary transition-colors"
      >
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        <span>metadata</span>
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {(provider || model) && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-900 text-gray-500 dark:text-matrix-secondary border border-gray-200 dark:border-matrix-primary/40 font-mono">
              {provider && <span className="text-gray-400 dark:text-matrix-secondary/60">{provider}/</span>}
              {model}
            </span>
          )}
          {hasTokens && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-900 text-gray-500 dark:text-matrix-secondary border border-gray-200 dark:border-matrix-primary/40 font-mono">
              ↑{inputTokens.toLocaleString()} ↓{outputTokens.toLocaleString()} tok
            </span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-900 text-gray-500 dark:text-matrix-secondary border border-gray-200 dark:border-matrix-primary/40 font-mono">
              ⏱ {duration}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
