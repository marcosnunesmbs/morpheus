import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EventRow } from './EventRow';
import type { AuditEvent } from '../../services/audit';

interface EventTimelineProps {
  events: AuditEvent[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  page,
  pageSize,
  totalCount,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  const start = page * pageSize + 1;
  const end = Math.min(page * pageSize + events.length, totalCount);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 dark:text-matrix-secondary/50 text-sm">
        No audit events for this session.
      </div>
    );
  }

  // Group tool/llm events that belong to a task
  const grouped: { taskId: string | null; events: AuditEvent[] }[] = [];
  const taskMap = new Map<string, AuditEvent[]>();
  const standalone: AuditEvent[] = [];

  for (const e of events) {
    if (e.task_id) {
      const group = taskMap.get(e.task_id) ?? [];
      group.push(e);
      taskMap.set(e.task_id, group);
    } else {
      standalone.push(e);
    }
  }

  // Rebuild ordered list: standalone events, and task groups in order of first appearance
  const seenTasks = new Set<string>();
  for (const e of events) {
    if (!e.task_id) {
      grouped.push({ taskId: null, events: [e] });
    } else if (!seenTasks.has(e.task_id)) {
      seenTasks.add(e.task_id);
      grouped.push({ taskId: e.task_id, events: taskMap.get(e.task_id)! });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header row — desktop only */}
      <div className="hidden md:flex items-center gap-3 px-3 py-1 text-xs text-gray-400 dark:text-matrix-secondary/60 border-b border-gray-200 dark:border-matrix-primary/30 font-mono">
        <span className="w-4" />
        <span className="w-14 flex-shrink-0">agent</span>
        <span className="flex-1">event / tool / model</span>
        <span className="w-28 text-right">tokens ↑↓</span>
        <span className="w-16 text-right">duration</span>
        <span className="w-4" />
        <span className="w-20 text-right">cost</span>
      </div>

      {/* Event rows */}
      <div className="flex flex-col">
        {grouped.map((group) =>
          group.taskId ? (
            <div key={group.taskId} className="mb-1">
              {/* Task group header */}
              <div className="px-3 py-1 text-xs text-gray-400 dark:text-matrix-secondary/50 font-mono border-l-2 border-blue-300 dark:border-matrix-primary/60 ml-1 mb-0.5">
                task: {group.taskId.slice(0, 8)}…
              </div>
              <div className="pl-4">
                {group.events.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            </div>
          ) : (
            <EventRow key={group.events[0].id} event={group.events[0]} />
          )
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-matrix-primary/30 mt-2">
          <span className="text-xs text-gray-400 dark:text-matrix-secondary/60">
            {start}–{end} of {totalCount} events
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
              className="p-1 rounded text-gray-400 dark:text-matrix-secondary hover:text-gray-700 dark:hover:text-matrix-highlight disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs self-center text-gray-500 dark:text-matrix-secondary font-mono px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="p-1 rounded text-gray-400 dark:text-matrix-secondary hover:text-gray-700 dark:hover:text-matrix-highlight disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
