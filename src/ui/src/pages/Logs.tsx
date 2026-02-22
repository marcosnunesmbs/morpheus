import { useState, useEffect, useRef } from 'react';
import { useLogs, useLogContent } from '@/lib/api';
import { FileText, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export function Logs() {
  const { data: files } = useLogs();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { data: content, mutate } = useLogContent(selectedFile);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedFile && files && files.length > 0) {
      setSelectedFile(files[0].name);
    }
  }, [files, selectedFile]);

  // Scroll to bottom whenever content changes (new lines or file switch)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <motion.div
      className="flex flex-col space-y-4 md:pt-0"
      style={{ height: 'calc(100vh - 2rem)' }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="shrink-0">
        <h2 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight">SYSTEM LOGS</h2>
        <p className="text-azure-text-secondary dark:text-matrix-secondary opacity-80">View runtime logs.</p>
      </div>

      <div className="flex-1 flex gap-4 min-h-0 border border-azure-border dark:border-matrix-primary rounded bg-azure-surface dark:bg-zinc-950 p-4">
        {/* File List — hidden on mobile */}
        <div className="hidden md:flex w-64 flex-col gap-2 border-r border-azure-border dark:border-matrix-primary pr-4 overflow-y-auto shrink-0">
          <h3 className="font-bold text-azure-text-secondary dark:text-matrix-secondary mb-2 sticky top-0 bg-azure-surface dark:bg-zinc-950">LOG FILES</h3>
          {files?.map(f => (
            <button
              key={f.name}
              onClick={() => setSelectedFile(f.name)}
              className={`text-left px-3 py-2 rounded text-sm truncate flex items-center gap-2 group transition-colors ${
                selectedFile === f.name
                ? 'bg-azure-active text-azure-primary dark:bg-matrix-primary dark:text-matrix-highlight'
                : 'text-azure-text-secondary dark:text-matrix-secondary hover:bg-azure-hover dark:hover:bg-zinc-900 group-hover:text-azure-primary dark:group-hover:text-matrix-highlight'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <div className="flex flex-col overflow-hidden">
                <span className="truncate font-bold">{f.name}</span>
                <span className="text-xs opacity-70">{(f.size / 1024).toFixed(1)} KB</span>
              </div>
            </button>
          ))}
        </div>

        {/* Content Viewer */}
        <div className="flex-1 flex flex-col min-h-0 bg-azure-bg dark:bg-black border border-azure-border dark:border-matrix-primary/50 rounded">
          <div className="shrink-0 flex justify-between items-center gap-2 p-2 bg-azure-hover dark:bg-zinc-900 border-b border-azure-border dark:border-matrix-primary/50">
            {/* Mobile: dropdown to switch file */}
            <select
              value={selectedFile ?? ''}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="md:hidden flex-1 bg-transparent text-azure-text-primary dark:text-matrix-highlight font-bold font-mono text-sm border-none outline-none cursor-pointer"
            >
              {files?.map(f => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
            {/* Desktop: static label */}
            <span className="hidden md:block text-azure-text-primary dark:text-matrix-highlight font-bold font-mono text-sm truncate">{selectedFile}</span>
            <button onClick={() => mutate()} className="shrink-0 text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-hidden overflow-y-auto p-4 font-mono text-xs break-all text-azure-text-primary dark:text-white"
          >
            {content
              ? content.lines.map((line, i) => {
                  // Winston timestamp: "2026-02-22T00:39:00.123Z "
                  const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s?(.*)/s);
                  if (match) {
                    return (
                      <div key={i}>
                        <span className="hidden md:inline opacity-50">{match[1]} </span>
                        <span>{match[2]}</span>
                      </div>
                    );
                  }
                  return <div key={i}>{line}</div>;
                })
              : <span className="opacity-50">Select a log file to view content...</span>
            }
          </div>
        </div>
      </div>
    </motion.div>
  );
}
