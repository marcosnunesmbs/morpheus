import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ChronosTable } from '../components/chronos/ChronosTable';
import { CreateChronosModal } from '../components/chronos/CreateChronosModal';
import type { ChronosJob } from '../services/chronos';
import { mutate } from 'swr';

export function ChronosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editJob, setEditJob] = useState<ChronosJob | null>(null);

  const handleEdit = (job: ChronosJob) => {
    setEditJob(job);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditJob(null);
  };

  const handleCreated = () => {
    mutate((key: string) => typeof key === 'string' && key.startsWith('/chronos'));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-azure-text-primary dark:text-matrix-highlight font-mono">
            Chronos
          </h1>
          <p className="text-sm text-azure-text-muted dark:text-matrix-secondary mt-0.5">
            Temporal Intent Engine — schedule prompts for the Oracle
          </p>
        </div>
        <button
          onClick={() => { setEditJob(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded bg-azure-primary dark:bg-matrix-primary text-white dark:text-matrix-highlight font-bold text-sm hover:opacity-90 transition-opacity font-mono"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      {/* Table */}
      <ChronosTable onEdit={handleEdit} />

      {/* Modal */}
      <CreateChronosModal
        isOpen={isModalOpen}
        onClose={handleClose}
        onCreated={handleCreated}
        editJob={editJob}
      />
    </div>
  );
}
