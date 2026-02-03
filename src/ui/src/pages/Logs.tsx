import { useState, useEffect } from 'react';
import { useLogs, useLogContent } from '@/lib/api';
import { FileText, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export function Logs() {
  const { data: files } = useLogs();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { data: content, mutate } = useLogContent(selectedFile);

  useEffect(() => {
    if (!selectedFile && files && files.length > 0) {
      setSelectedFile(files[0].name);
    }
  }, [files, selectedFile]);

  return (
    <motion.div 
      className="h-full flex flex-col space-y-4"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div>
        <h2 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight">SYSTEM LOGS</h2>
        <p className="text-azure-text-secondary dark:text-matrix-secondary opacity-80">View runtime logs.</p>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden border border-azure-border dark:border-matrix-primary rounded bg-azure-surface dark:bg-zinc-950 p-4">
        {/* File List */}
        <div className="w-64 flex flex-col gap-2 border-r border-azure-border dark:border-matrix-primary pr-4 overflow-y-auto shrink-0">
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
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-azure-bg dark:bg-black border border-azure-border dark:border-matrix-primary/50 rounded">
          <div className="flex justify-between items-center p-2 bg-azure-hover dark:bg-zinc-900 border-b border-azure-border dark:border-matrix-primary/50">
            <span className="text-azure-text-primary dark:text-matrix-highlight font-bold font-mono text-sm">{selectedFile}</span>
            <button onClick={() => mutate()} className="text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-xs whitespace-pre-wrap text-azure-text-primary dark:text-white">
            {content ? content.lines.join('\n') : 'Select a log file to view content...'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
