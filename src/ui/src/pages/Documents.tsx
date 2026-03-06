import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { useLinkDocuments, uploadDocument, deleteDocument, reindexDocument, triggerScan } from '../services/link';
import { DocumentTable } from '../components/link/DocumentTable';
import { UploadButton } from '../components/link/UploadButton';
import { ConfirmationModal } from '../components/ConfirmationModal';

export function Documents() {
  const { documents, stats, isLoading, mutate } = useLinkDocuments();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; filename: string } | null>(null);

  // Auto-poll when documents are in pending/indexing status
  const hasActiveDocuments = documents.some(d => d.status === 'pending' || d.status === 'indexing');

  useEffect(() => {
    if (!polling && !hasActiveDocuments) return;

    if (hasActiveDocuments || polling) {
      const interval = setInterval(() => {
        mutate();
      }, 2000);

      // Stop polling once all documents are settled
      if (!hasActiveDocuments && polling) {
        setPolling(false);
      }

      return () => clearInterval(interval);
    }
  }, [hasActiveDocuments, polling, mutate]);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);
    try {
      const result = await uploadDocument(file, (percent) => {
        setUploadProgress(percent);
      });
      setSuccess(`Uploaded "${result.filename}" - indexed ${result.indexed} document(s)`);
      setPolling(true);
      await mutate();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [mutate]);

  const handleDelete = async () => {
    if (!documentToDelete) return;

    setError(null);
    try {
      await deleteDocument(documentToDelete.id);
      setSuccess('Document deleted');
      await mutate();
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
    } finally {
      setDocumentToDelete(null);
    }
  };

  const openDeleteModal = (id: string, filename: string) => {
    setDocumentToDelete({ id, filename });
    setDeleteModalOpen(true);
  };

  const handleReindex = async (id: string) => {
    setError(null);
    try {
      await reindexDocument(id);
      setSuccess('Document reindexed');
      setPolling(true);
      await mutate();
    } catch (err: any) {
      setError(err.message || 'Failed to reindex document');
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const result = await triggerScan();
      setSuccess(`Scan complete: ${result.indexed} indexed, ${result.removed} removed`);
      await mutate();
    } catch (err: any) {
      setError(err.message || 'Failed to scan');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-azure-primary/10 dark:bg-matrix-highlight/10 border border-azure-primary/20 dark:border-matrix-highlight/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-azure-primary dark:text-matrix-highlight" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-azure-text dark:text-matrix-highlight">Documents</h1>
            <p className="text-sm text-azure-text-secondary dark:text-matrix-tertiary mt-0.5">
              Manage your document library for Link agent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-azure-primary/20 dark:border-matrix-highlight/30 text-azure-text-secondary dark:text-matrix-secondary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
          <UploadButton onUpload={handleUpload} isUploading={uploading} uploadProgress={uploadProgress} />
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-500 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md text-green-500 text-sm">
          {success}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-azure-primary/5 dark:bg-matrix-highlight/5 border border-azure-primary/20 dark:border-matrix-highlight/30 rounded-lg">
            <div className="text-2xl font-bold text-azure-text dark:text-matrix-highlight">{stats.documents_total}</div>
            <div className="text-sm text-azure-text-secondary dark:text-matrix-tertiary">Total Documents</div>
          </div>
          <div className="p-4 bg-azure-primary/5 dark:bg-matrix-highlight/5 border border-azure-primary/20 dark:border-matrix-highlight/30 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.documents_indexed}</div>
            <div className="text-sm text-azure-text-secondary dark:text-matrix-tertiary">Indexed</div>
          </div>
          <div className="p-4 bg-azure-primary/5 dark:bg-matrix-highlight/5 border border-azure-primary/20 dark:border-matrix-highlight/30 rounded-lg">
            <div className="text-2xl font-bold text-azure-text dark:text-matrix-highlight">{stats.chunks_total}</div>
            <div className="text-sm text-azure-text-secondary dark:text-matrix-tertiary">Total Chunks</div>
          </div>
        </div>
      )}

      {/* Document List */}
      <DocumentTable
        documents={documents}
        onDelete={openDeleteModal}
        onReindex={handleReindex}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDocumentToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Document"
        description={`Are you sure you want to delete "${documentToDelete?.filename}"? This action cannot be undone and the document will be removed from the index.`}
        confirmJson="Delete"
        variant="destructive"
      />

      {/* Help */}
      <p className="text-xs text-azure-text-secondary dark:text-matrix-tertiary">
        Supported formats: PDF, TXT, Markdown, DOCX. Documents are stored in ~/.morpheus/docs.
        Ask Oracle questions about your documents using natural language.
      </p>
    </div>
  );
}
