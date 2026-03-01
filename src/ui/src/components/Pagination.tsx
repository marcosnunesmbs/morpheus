import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  totalPages: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  perPageOptions?: number[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export function Pagination({
  page,
  totalPages,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const btnBase =
    'flex items-center gap-1 px-3 py-1.5 rounded border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const btnActive =
    'border-azure-border dark:border-matrix-primary text-azure-text dark:text-matrix-secondary hover:border-azure-primary dark:hover:border-matrix-highlight hover:text-azure-primary dark:hover:text-matrix-highlight';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-azure-border dark:border-matrix-primary">
      <div className="flex items-center gap-2 text-sm text-azure-text-secondary dark:text-matrix-tertiary">
        <span>Rows per page:</span>
        <select
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="px-2 py-1 rounded border border-azure-border dark:border-matrix-primary bg-white dark:bg-black text-azure-text dark:text-matrix-secondary text-sm focus:outline-none focus:border-azure-primary dark:focus:border-matrix-highlight"
        >
          {perPageOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-azure-text-secondary dark:text-matrix-tertiary whitespace-nowrap">
          {total === 0 ? '0 records' : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}`}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={`${btnBase} ${btnActive}`}
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <span className="px-3 py-1.5 text-sm text-azure-text dark:text-matrix-secondary tabular-nums">
            {page} / {totalPages || 1}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={`${btnBase} ${btnActive}`}
            title="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
