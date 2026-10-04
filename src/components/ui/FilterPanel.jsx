import clsx from 'clsx';
import { SlidersHorizontal } from 'lucide-react';

export function FilterPanel({ title = 'Filters', children, className, defaultOpen = false }) {
  if (!children) return null;

  return (
    <details
      className={clsx(
        'group rounded-[1.25rem] border border-slate-200/80 bg-white/95 p-3 shadow-sm backdrop-blur-xl lg:rounded-[1.5rem]',
        className
      )}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-clinical-600" />
          {title}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 group-open:bg-clinical-50 group-open:text-clinical-700">
          {defaultOpen ? 'Open' : 'Tap'}
        </span>
      </summary>
      <div className="mt-3 grid max-h-[46dvh] min-w-0 gap-2 overflow-y-auto overscroll-contain [&>*]:min-w-0 [&_.clinical-input]:w-full [&_button]:w-full lg:max-h-none lg:overflow-visible lg:[&_button]:w-auto">
        {children}
      </div>
    </details>
  );
}
