import React from 'react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import { Calendar, Hash, Eye, Tag, TrendingUp, Clock, Info } from 'lucide-react';

interface MemoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: {
    id: string;
    category: string;
    importance: string;
    summary: string;
    details: string | null;
    hash: string;
    source: string | null;
    created_at: string;
    updated_at: string;
    last_accessed_at: string | null;
    access_count: number;
    version: number;
    archived: boolean;
  } | null;
}

export const MemoryDetailModal: React.FC<MemoryDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  memory 
}) => {
  if (!memory) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Memory Details" size="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-azure-text-secondary dark:text-matrix-tertiary" />
            <span className="text-azure-text-secondary dark:text-matrix-tertiary text-sm">Category</span>
          </div>
          <div>
            <Badge variant="outline">{memory.category}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-azure-text-secondary dark:text-matrix-tertiary" />
            <span className="text-azure-text-secondary dark:text-matrix-tertiary text-sm">Importance</span>
          </div>
          <div>
            <Badge 
              variant={
                memory.importance === 'critical' ? 'destructive' :
                memory.importance === 'high' ? 'default' :
                memory.importance === 'medium' ? 'secondary' : 'outline'
              }
            >
              {memory.importance}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-azure-text-secondary dark:text-matrix-tertiary" />
            <span className="text-azure-text-secondary dark:text-matrix-tertiary text-sm">Created</span>
          </div>
          <div className="text-azure-text-primary dark:text-matrix-secondary">
            {new Date(memory.created_at).toLocaleString()}
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-azure-text-secondary dark:text-matrix-tertiary" />
            <span className="text-azure-text-secondary dark:text-matrix-tertiary text-sm">Updated</span>
          </div>
          <div className="text-azure-text-primary dark:text-matrix-secondary">
            {new Date(memory.updated_at).toLocaleString()}
          </div>

          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-azure-text-secondary dark:text-matrix-tertiary" />
            <span className="text-azure-text-secondary dark:text-matrix-tertiary text-sm">Access Count</span>
          </div>
          <div className="text-azure-text-primary dark:text-matrix-secondary">
            {memory.access_count}
          </div>

          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-azure-text-secondary dark:text-matrix-tertiary" />
            <span className="text-azure-text-secondary dark:text-matrix-tertiary text-sm">Hash</span>
          </div>
          <div className="text-azure-text-primary dark:text-matrix-secondary break-all text-sm">
            {memory.hash}
          </div>

          {memory.source && (
            <>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-azure-text-secondary dark:text-matrix-tertiary" />
                <span className="text-azure-text-secondary dark:text-matrix-tertiary text-sm">Source</span>
              </div>
              <div className="text-azure-text-primary dark:text-matrix-secondary">
                {memory.source}
              </div>
            </>
          )}
        </div>

        <div>
          <h4 className="text-azure-text-secondary dark:text-matrix-tertiary text-sm mb-2">Summary</h4>
          <p className="text-azure-text-primary dark:text-matrix-secondary bg-azure-surface dark:bg-zinc-800 p-3 rounded-md">
            {memory.summary}
          </p>
        </div>

        {memory.details && (
          <div>
            <h4 className="text-azure-text-secondary dark:text-matrix-tertiary text-sm mb-2">Details</h4>
            <div className="text-azure-text-primary dark:text-matrix-secondary bg-azure-surface dark:bg-zinc-800 p-3 rounded-md whitespace-pre-wrap">
              {memory.details}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
};