import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, PanelRight } from 'lucide-react';
import { useSessionAudit } from '../services/audit';
import { EventTimeline } from '../components/audit/EventTimeline';
import { CostSummaryPanel } from '../components/audit/CostSummaryPanel';
import { ExportButton } from '../components/audit/ExportButton';

const PAGE_SIZE = 100;

export const SessionAudit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const { data, error, isLoading } = useSessionAudit(id ?? null, page, PAGE_SIZE);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Sidebar starts open on desktop, closed on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [data]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-matrix-primary bg-white dark:bg-black flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-matrix-secondary hover:text-gray-700 dark:hover:text-matrix-highlight hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-matrix-highlight">Session Audit</h1>
            <p className="text-xs text-gray-400 dark:text-matrix-secondary/60 font-mono">{id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen(v => !v)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-matrix-secondary hover:text-gray-700 dark:hover:text-matrix-highlight hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors md:hidden"
            title="Toggle summary panel"
          >
            <PanelRight size={18} />
          </button>
          <ExportButton sessionId={id ?? ''} data={data} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Mobile backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Timeline */}
        <div ref={timelineRef} className="flex-[6] overflow-y-auto p-6 custom-scrollbar">
          {isLoading && (
            <div className="flex items-center justify-center h-40 gap-2 text-gray-400 dark:text-matrix-secondary">
              <Loader2 size={18} className="animate-spin" />
              Loading audit events…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <AlertCircle size={16} />
              Failed to load audit events: {error.message}
            </div>
          )}
          {data && (
            <EventTimeline
              events={data.events}
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={data.summary.llmCallCount + data.summary.toolCallCount}
              onPageChange={setPage}
            />
          )}
        </div>

        {/* Summary panel
            Mobile: fixed overlay sliding in from the right
            Desktop: in-flow right column, always visible */}
        <div
          className={`
            fixed inset-y-0 right-0 z-10 w-72
            md:relative md:inset-auto md:z-auto md:w-auto md:flex-[4] md:translate-x-0
            transition-transform duration-300 ease-out
            overflow-y-auto p-6 border-l border-gray-200 dark:border-matrix-primary
            bg-white dark:bg-black custom-scrollbar
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          {data ? (
            <CostSummaryPanel summary={data.summary} />
          ) : (
            !isLoading && (
              <div className="text-sm text-gray-400 dark:text-matrix-secondary/50 text-center mt-10">
                No summary available.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
