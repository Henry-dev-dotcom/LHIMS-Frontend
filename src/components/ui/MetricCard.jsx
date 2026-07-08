import clsx from 'clsx';

export function MetricCard({ label, value, icon: Icon, tone = 'blue', helper, compact = true }) {
  const tones = {
    blue: 'bg-clinical-50 text-clinical-700 ring-clinical-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    yellow: 'bg-amber-50 text-amber-700 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    purple: 'bg-purple-50 text-purple-700 ring-purple-100'
  };
  const bars = {
    blue: 'from-clinical-500 to-clinical-300',
    green: 'from-emerald-500 to-emerald-300',
    yellow: 'from-amber-500 to-amber-300',
    red: 'from-red-500 to-red-300',
    purple: 'from-purple-500 to-purple-300'
  };
  return (
    <div className={clsx(
      'metric-card group relative min-w-0 overflow-hidden border border-slate-200/70 bg-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-panel sm:min-h-[4.5rem]',
      compact ? 'min-h-[4.6rem] rounded-[1rem] p-2.5 sm:rounded-2xl sm:p-3' : 'min-h-[5rem] rounded-[1.2rem] p-3.5'
    )}>
      <div className={clsx('absolute top-0 h-0.5 rounded-b-full bg-gradient-to-r', compact ? 'inset-x-2 sm:inset-x-3' : 'inset-x-3.5', bars[tone] || bars.blue)} />
      <div className={clsx('flex h-full items-start justify-between', compact ? 'gap-1.5 sm:gap-2' : 'gap-2.5')}>
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              'metric-card-label break-words font-semibold uppercase leading-[1.2] text-slate-500',
              compact ? 'text-[9px] tracking-[0.08em] sm:text-[11px] sm:tracking-[0.1em]' : 'text-[11px] tracking-[0.1em]'
            )}
            title={label}
          >
            {label}
          </p>
          <p className={clsx('metric-card-value mt-1 truncate font-bold tracking-tight text-slate-900', compact ? 'text-[1.2rem] leading-none sm:text-2xl' : 'text-2xl')}>{value}</p>
          {helper && <p className={clsx('mt-0.5 hidden leading-4 text-slate-500 sm:block', compact ? 'text-[11px]' : 'text-xs')}>{helper}</p>}
        </div>
        {Icon && (
          <div className={clsx('metric-card-icon grid shrink-0 place-items-center rounded-xl ring-1 transition group-hover:scale-105', compact ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-9 w-9', tones[tone] || tones.blue)}>
            <Icon className={clsx(compact ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-5 w-5')} />
          </div>
        )}
      </div>
    </div>
  );
}
