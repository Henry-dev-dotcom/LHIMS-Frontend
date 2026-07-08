import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

/**
 * Server-driven pagination control. Reads the `meta` object returned by the
 * backend's paginationMeta() ({ page, limit, total, totalPages, hasNextPage,
 * hasPreviousPage }) and reports page changes via onPageChange(nextPage).
 * Renders nothing when there is no meta (e.g. mock/demo responses).
 */
export function Pagination({ meta, onPageChange, loading = false, className }) {
  if (!meta) return null;

  const { page = 1, limit = 20, total = 0, totalPages = 1 } = meta;
  const canPrev = (meta.hasPreviousPage ?? page > 1) && !loading;
  const canNext = (meta.hasNextPage ?? page < totalPages) && !loading;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Pagination"
      className={clsx('flex flex-wrap items-center justify-between gap-3 px-1 py-2', className)}
    >
      <p className="text-xs font-semibold text-slate-500" aria-live="polite">
        {total === 0 ? (
          'No records'
        ) : (
          <>
            Showing <span className="font-bold text-slate-700">{start}–{end}</span> of{' '}
            <span className="font-bold text-slate-700">{total}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={!canPrev} onClick={() => onPageChange?.(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <span className="whitespace-nowrap text-xs font-bold text-slate-600">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button variant="secondary" size="sm" disabled={!canNext} onClick={() => onPageChange?.(page + 1)} aria-label="Next page">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
