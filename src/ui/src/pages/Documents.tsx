import { useState } from 'react';
import { useLinkDocuments, uploadDocument, deleteDocument, reindexDocument, triggerScan } from '../services/link';
import { DocumentTable } from '../components/link/DocumentTable';
import { UploadButton } from '../components/link/UploadButton';

export function Documents() {
  const { documents, stats, isLoading, mutate } = useLinkDocuments();
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await uploadDocument(file);
      setSuccess(`Uploaded "${result.filename}" - indexed ${result.indexed} document(s)`);
      await mutate();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setError(null);
    try {
      await deleteDocument(id);
      setSuccess('Document deleted');
      await mutate();
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
    }
  };

  const handleReindex = async (id: string) => {
    setError(null);
    try {
      await reindexDocument(id);
      setSuccess('Document reindexed');
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-matrix-primary/30 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-matrix-highlight dark:text-white">Documents</h1>
          <p className="text-sm text-matrix-secondary dark:text-gray-400 mt-1">
            Manage your document library for Link agent
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center px-3 py-2 text-sm border border-matrix-primary dark:border-gray-600 rounded-md text-matrix-secondary dark:text-gray-300 hover:bg-matrix-primary/10 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {scanning ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Scan Now
              </>
            )}
          </button>
          <UploadButton onUpload={handleUpload} isUploading={uploading} />
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-500 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-md text-green-500 text-sm">
          {success}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="mx-6 mt-4 grid grid-cols-3 gap-4">
          <div className="p-4 bg-matrix-base/50 dark:bg-gray-800/50 border border-matrix-primary/30 dark:border-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-matrix-highlight dark:text-white">{stats.documents_total}</div>
            <div className="text-sm text-matrix-secondary dark:text-gray-400">Total Documents</div>
          </div>
          <div className="p-4 bg-matrix-base/50 dark:bg-gray-800/50 border border-matrix-primary/30 dark:border-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{stats.documents_indexed}</div>
            <div className="text-sm text-matrix-secondary dark:text-gray-400">Indexed</div>
          </div>
          <div className="p-4 bg-matrix-base/50 dark:bg-gray-800/50 border border-matrix-primary/30 dark:border-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-matrix-highlight dark:text-white">{stats.chunks_total}</div>
            <div className="text-sm text-matrix-secondary dark:text-gray-400">Total Chunks</div>
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-matrix-base/30 dark:bg-gray-800/30 border border-matrix-primary/30 dark:border-gray-700 rounded-lg overflow-hidden">
          <DocumentTable
            documents={documents}
            onDelete={handleDelete}
            onReindex={handleReindex}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Help */}
      <div className="px-6 py-4 border-t border-matrix-primary/30 dark:border-gray-700">
        <p className="text-xs text-matrix-tertiary dark:text-gray-500">
          Supported formats: PDF, TXT, Markdown, DOCX. Documents are stored in ~/.morpheus/docs.
          Ask Oracle questions about your documents using natural language.
        </p>
      </div>
    </div>
  );
}