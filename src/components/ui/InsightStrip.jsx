import clsx from 'clsx';

export function InsightStrip({ items = [], className }) {
  if (!items.length) return null;
  return (
    <div className={clsx('grid gap-2 rounded-[1.2rem] border border-white/70 bg-white/80 p-2.5 shadow-soft backdrop-blur-xl sm:grid-cols-2 sm:gap-3 sm:rounded-[1.75rem] sm:p-3 xl:grid-cols-4', className)}>
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-slate-50/90 px-3 py-3 ring-1 ring-slate-100 sm:px-4">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:text-[10px] sm:tracking-[0.18em]">{item.label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900">{item.value}</p>
          {item.helper && <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>}
        </div>
      ))}
    </div>
  );
}
