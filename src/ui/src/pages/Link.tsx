import React, { useState, useCallback } from 'react';
import { useLinkDocuments, useLinkStats, useLinkSearch, useUploadDocument, useDeleteDocument, useReindexDocument } from '../services/link';
import { FileText, Search, Upload, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock, Link2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-yellow-500" />,
  indexing: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
  indexed: <CheckCircle className="w-4 h-4 text-green-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  indexing: 'Indexing',
  indexed: 'Indexed',
  error: 'Error',
};

export function LinkPage() {
  const [page, setPage] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { documents, pagination, isLoading, mutate } = useLinkDocuments(page, 20);
  const { stats } = useLinkStats();
  const { search, results, isSearching } = useLinkSearch();
  const { upload, isUploading } = useUploadDocument();
  const { delete: deleteDoc, isDeleting } = useDeleteDocument();
  const { reindex, isReindexing } = useReindexDocument();

  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) return;
    await search({ query: searchInput, limit: 10 });
  }, [searchInput, search]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    await upload(selectedFile);
    setSelectedFile(null);
    setShowUploadModal(false);
    mutate();
  }, [selectedFile, upload, mutate]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteDoc(id);
    setShowDeleteModal(null);
    mutate();
  }, [deleteDoc, mutate]);

  const handleReindex = useCallback(async (id: string) => {
    await reindex(id);
    mutate();
  }, [reindex, mutate]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link2 className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          <h1 className="text-2xl font-bold text-azure-text-primary dark:text-matrix-highlight">
            Link Document RAG
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors"
          >
            <Search className="w-4 h-4" />
            Search Documents
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-black border border-azure-border dark:border-matrix-primary p-4 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-matrix-secondary">Total Documents</div>
          <div className="text-2xl font-bold text-azure-text-primary dark:text-matrix-highlight">
            {stats?.totalDocuments ?? 0}
          </div>
        </div>
        <div className="bg-white dark:bg-black border border-azure-border dark:border-matrix-primary p-4 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-matrix-secondary">Indexed</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats?.indexedDocuments ?? 0}
          </div>
        </div>
        <div className="bg-white dark:bg-black border border-azure-border dark:border-matrix-primary p-4 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-matrix-secondary">Total Chunks</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats?.totalChunks ?? 0}
          </div>
        </div>
        <div className="bg-white dark:bg-black border border-azure-border dark:border-matrix-primary p-4 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-matrix-secondary">Pending/Error</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {(stats?.pendingDocuments ?? 0) + (stats?.errorDocuments ?? 0)}
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white dark:bg-black border border-azure-border dark:border-matrix-primary rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-azure-border dark:border-matrix-primary bg-gray-50 dark:bg-zinc-900">
          <h2 className="font-semibold text-azure-text-primary dark:text-matrix-highlight">Documents</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-matrix-secondary">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-matrix-secondary">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No documents found. Upload your first document to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-matrix-secondary">Filename</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-matrix-secondary">Size</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-matrix-secondary">Status</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-matrix-secondary">Chunks</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-matrix-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-azure-text-primary dark:text-matrix-secondary truncate max-w-xs">
                          {doc.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-matrix-tertiary">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {statusIcons[doc.status]}
                        <span className="text-sm text-gray-600 dark:text-matrix-secondary">
                          {statusLabels[doc.status]}
                        </span>
                      </div>
                      {doc.error_message && (
                        <div className="text-xs text-red-500 mt-1">{doc.error_message}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-matrix-tertiary">
                      {doc.chunk_count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleReindex(doc.id)}
                          disabled={isReindexing}
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-matrix-tertiary dark:hover:text-blue-400 transition-colors"
                          title="Reindex"
                        >
                          <RefreshCw className={`w-4 h-4 ${isReindexing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(doc.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 dark:text-matrix-tertiary dark:hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="px-4 py-3 border-t border-azure-border dark:border-matrix-primary flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-matrix-secondary">
              Page {pagination.page} of {pagination.total_pages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-matrix-primary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                disabled={page === pagination.total_pages}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-matrix-primary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-black border border-azure-border dark:border-matrix-primary rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-azure-text-primary dark:text-matrix-highlight">
                  Upload Document
                </h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-matrix-tertiary dark:hover:text-matrix-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-300 dark:border-matrix-primary rounded-lg p-8 text-center">
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                  accept=".txt,.md,.pdf,.docx,.json,.csv,.ts,.js,.py,.java,.cpp,.c,.h,.hpp,.html,.css,.xml,.yaml,.yml"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-matrix-secondary">
                    {selectedFile ? selectedFile.name : 'Click to select a file'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-matrix-tertiary">
                    Supported: .txt, .md, .pdf, .docx, code files
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-matrix-primary hover:bg-gray-50 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSearchModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-black border border-azure-border dark:border-matrix-primary rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-azure-border dark:border-matrix-primary">
                <h3 className="text-lg font-semibold text-azure-text-primary dark:text-matrix-highlight">
                  Search Documents
                </h3>
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-matrix-tertiary dark:hover:text-matrix-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 border-b border-azure-border dark:border-matrix-primary">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter your search query..."
                    className="flex-1 px-4 py-2 rounded border border-gray-300 dark:border-matrix-primary bg-white dark:bg-black text-azure-text-primary dark:text-matrix-secondary"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="px-4 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50"
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {results ? (
                  results.results.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-matrix-secondary py-8">
                      No results found for "{results.query}"
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-500 dark:text-matrix-secondary">
                        Found {results.totalResults} results in {results.durationMs}ms
                      </div>
                      {results.results.map((result, i) => (
                        <div
                          key={i}
                          className="border border-gray-200 dark:border-matrix-primary rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-azure-text-primary dark:text-matrix-highlight">
                              {result.document.filename}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-matrix-tertiary">
                              Score: {(result.score * 100).toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-matrix-secondary line-clamp-3">
                            {result.chunk.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center text-gray-400 dark:text-matrix-tertiary py-8">
                    Enter a query and click Search to find relevant documents
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-black border border-azure-border dark:border-matrix-primary rounded-lg shadow-xl max-w-sm w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-azure-text-primary dark:text-matrix-highlight mb-2">
                Delete Document
              </h3>
              <p className="text-gray-600 dark:text-matrix-secondary mb-4">
                Are you sure you want to delete this document? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-matrix-primary hover:bg-gray-50 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => showDeleteModal && handleDelete(showDeleteModal)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LinkPage;
