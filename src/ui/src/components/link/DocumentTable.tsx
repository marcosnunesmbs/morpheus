import type { LinkDocument } from '../../services/link';
import { StatusBadge } from './StatusBadge';

interface DocumentTableProps {
  documents: LinkDocument[];
  onDelete: (id: string, filename: string) => void;
  onReindex: (id: string) => void;
  isLoading?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export function DocumentTable({ documents, onDelete, onReindex, isLoading }: DocumentTableProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-matrix-secondary dark:text-gray-500">
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-matrix-secondary dark:text-gray-500">
        No documents found. Upload a document to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-matrix-primary/30 dark:divide-gray-700">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-matrix-secondary dark:text-gray-400 uppercase tracking-wider">
              Filename
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-matrix-secondary dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-matrix-secondary dark:text-gray-400 uppercase tracking-wider">
              Size
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-matrix-secondary dark:text-gray-400 uppercase tracking-wider">
              Chunks
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-matrix-secondary dark:text-gray-400 uppercase tracking-wider">
              Updated
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-matrix-secondary dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-matrix-primary/30 dark:divide-gray-700">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-matrix-base/50 dark:hover:bg-gray-800/50">
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-matrix-highlight dark:text-white">
                  {doc.filename}
                </div>
                {doc.error_message && (
                  <div className="text-xs text-red-500 mt-1">{doc.error_message}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={doc.status} />
              </td>
              <td className="px-4 py-3 text-sm text-matrix-secondary dark:text-gray-300">
                {formatFileSize(doc.file_size)}
              </td>
              <td className="px-4 py-3 text-sm text-matrix-secondary dark:text-gray-300">
                {doc.chunk_count}
              </td>
              <td className="px-4 py-3 text-sm text-matrix-secondary dark:text-gray-300">
                {formatDate(doc.updated_at)}
              </td>
              <td className="px-4 py-3 text-right space-x-2">
                <button
                  onClick={() => onReindex(doc.id)}
                  className="text-xs text-matrix-secondary dark:text-gray-400 hover:text-matrix-highlight dark:hover:text-white transition-colors"
                  title="Reindex document"
                >
                  Reindex
                </button>
                <button
                  onClick={() => onDelete(doc.id, doc.filename)}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors"
                  title="Delete document"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}