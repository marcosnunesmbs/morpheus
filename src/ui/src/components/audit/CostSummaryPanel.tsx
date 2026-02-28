import React from 'react';
import { DollarSign, Zap, Wrench, Clock } from 'lucide-react';
import type { AuditSessionSummary } from '../../services/audit';

interface CostSummaryPanelProps {
  summary: AuditSessionSummary;
}

function fmtCost(v: number): string {
  if (v === 0) return '$0.00';
  if (v < 0.0001) return '<$0.0001';
  return `$${v.toFixed(4)}`;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export const CostSummaryPanel: React.FC<CostSummaryPanelProps> = ({ summary }) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Totals */}
      <div className="rounded-lg border border-gray-200 dark:border-matrix-primary p-4 bg-white dark:bg-black">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-matrix-highlight mb-3 flex items-center gap-2">
          <DollarSign size={14} /> Total Cost
        </h3>
        <div className="text-2xl font-bold text-gray-900 dark:text-matrix-highlight font-mono">
          {fmtCost(summary.totalCostUsd)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-matrix-secondary">
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-blue-400" />
            <span>{summary.llmCallCount} LLM calls</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wrench size={12} className="text-amber-400" />
            <span>{summary.toolCallCount} tool calls</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2">
            <Clock size={12} className="text-gray-400" />
            <span>{fmtMs(summary.totalDurationMs)} total duration</span>
          </div>
        </div>
      </div>

      {/* By Agent */}
      {summary.byAgent.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-matrix-primary p-4 bg-white dark:bg-black">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-matrix-highlight mb-3">By Agent</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 dark:text-matrix-secondary/60 border-b border-gray-100 dark:border-matrix-primary/30">
                <th className="text-left pb-1.5">Agent</th>
                <th className="text-right pb-1.5">Calls</th>
                <th className="text-right pb-1.5">Tokens</th>
                <th className="text-right pb-1.5">Cost</th>
              </tr>
            </thead>
            <tbody>
              {summary.byAgent.map((row) => (
                <tr key={row.agent} className="border-b border-gray-50 dark:border-matrix-primary/10 last:border-0">
                  <td className="py-1.5 text-gray-700 dark:text-matrix-secondary font-semibold">{row.agent}</td>
                  <td className="py-1.5 text-right text-gray-500 dark:text-matrix-secondary/70 font-mono">{row.llmCalls}</td>
                  <td className="py-1.5 text-right text-gray-500 dark:text-matrix-secondary/70 font-mono">
                    {(row.inputTokens + row.outputTokens).toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right text-gray-700 dark:text-matrix-highlight font-mono">{fmtCost(row.estimatedCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* By Model */}
      {summary.byModel.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-matrix-primary p-4 bg-white dark:bg-black">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-matrix-highlight mb-3">By Model</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 dark:text-matrix-secondary/60 border-b border-gray-100 dark:border-matrix-primary/30">
                <th className="text-left pb-1.5">Model</th>
                <th className="text-right pb-1.5">Calls</th>
                <th className="text-right pb-1.5">In</th>
                <th className="text-right pb-1.5">Out</th>
                <th className="text-right pb-1.5">Cost</th>
              </tr>
            </thead>
            <tbody>
              {summary.byModel.map((row) => (
                <tr key={`${row.provider}/${row.model}`} className="border-b border-gray-50 dark:border-matrix-primary/10 last:border-0">
                  <td className="py-1.5 font-mono text-gray-700 dark:text-matrix-secondary truncate max-w-[100px]" title={row.model}>
                    {row.model}
                  </td>
                  <td className="py-1.5 text-right text-gray-500 dark:text-matrix-secondary/70 font-mono">{row.calls}</td>
                  <td className="py-1.5 text-right text-gray-500 dark:text-matrix-secondary/70 font-mono">{row.inputTokens.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-gray-500 dark:text-matrix-secondary/70 font-mono">{row.outputTokens.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-gray-700 dark:text-matrix-highlight font-mono">{fmtCost(row.estimatedCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
