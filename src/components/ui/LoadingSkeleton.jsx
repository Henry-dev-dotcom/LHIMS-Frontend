import clsx from 'clsx';

export function Skeleton({ className, ...props }) {
  return <span aria-hidden="true" className={clsx('block animate-pulse rounded-xl bg-slate-200/80', className)} {...props} />;
}

export function PageSkeleton({ rows = 5 }) {
  return (
    <div role="status" aria-label="Loading page" className="space-y-5 p-4 sm:p-6">
      <span className="sr-only">Loading page…</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24" />)}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex gap-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-24" /></div>
        <div className="space-y-3">{Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
      </div>
    </div>
  );
}
