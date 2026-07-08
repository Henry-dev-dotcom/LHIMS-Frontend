import clsx from 'clsx';

export function StatusBadge({ status }) {
  const normalized = String(status || '').toLowerCase();
  const className = normalized.includes('final') || normalized.includes('paid') || normalized.includes('active') || normalized.includes('ready') || normalized.includes('allowed') || normalized.includes('mapped') || normalized.includes('normal') || normalized.includes('delivered')
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : normalized.includes('pending') || normalized.includes('submitted') || normalized.includes('urgent') || normalized.includes('queued') || normalized.includes('retry')
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : normalized.includes('cancel') || normalized.includes('reject') || normalized.includes('blocked') || normalized.includes('failed') || normalized.includes('critical') || normalized.includes('unsafe')
        ? 'bg-red-50 text-red-700 ring-red-200'
        : normalized.includes('progress') || normalized.includes('confirmed') || normalized.includes('routine') || normalized.includes('email') || normalized.includes('sms')
          ? 'bg-blue-50 text-blue-700 ring-blue-200'
          : normalized.includes('scan') || normalized.includes('imaging') || normalized.includes('doctor')
            ? 'bg-purple-50 text-purple-700 ring-purple-200'
            : 'bg-slate-100 text-slate-700 ring-slate-200';

  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1', className)}>{status || '—'}</span>;
}
