import React from 'react';
import type { Message } from '../../services/chat';

interface MessageMetaProps {
  message: Message;
}

function fmtMs(ms: number | null | undefined): string | null {
  if (ms == null || ms === 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const MessageMeta: React.FC<MessageMetaProps> = ({ message }) => {
  const usage = message.usage_metadata as any;
  const inputTokens: number = usage?.input_tokens ?? usage?.prompt_tokens ?? 0;
  const outputTokens: number = usage?.output_tokens ?? usage?.completion_tokens ?? 0;
  const hasTokens = inputTokens > 0 || outputTokens > 0;
  const duration = fmtMs(message.duration_ms);
  const model = message.model;

  if (!hasTokens && !duration && !model) return null;

  // Shorten model name: strip provider prefix, keep meaningful segments
  const modelShort = model
    ? (model.includes(':') ? model.split(':').pop() : model)
        ?.split('-')
        .slice(0, 4)
        .join('-') ?? model
    : null;

  return (
    <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-matrix-primary/20 flex flex-wrap items-center gap-x-3 gap-y-0.5">
      {modelShort && (
        <span className="text-[11px] font-mono text-gray-400 dark:text-matrix-secondary/40 truncate max-w-[180px]" title={model ?? ''}>
          {modelShort}
        </span>
      )}
      {hasTokens && (
        <span className="text-[11px] font-mono text-gray-400 dark:text-matrix-secondary/40">
          ↑{fmtNum(inputTokens)} ↓{fmtNum(outputTokens)}
        </span>
      )}
      {duration && (
        <span className="text-[11px] font-mono text-gray-400 dark:text-matrix-secondary/40">
          {duration}
        </span>
      )}
    </div>
  );
};
