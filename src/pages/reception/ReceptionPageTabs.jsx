import { useEffect, useRef } from 'react';
import clsx from 'clsx';

const toneClasses = {
  blue: 'bg-clinical-50 text-clinical-700 ring-clinical-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  purple: 'bg-purple-50 text-purple-700 ring-purple-100',
  sky: 'bg-sky-50 text-sky-700 ring-sky-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200'
};

export function ReceptionPageTabs({ label = 'Page sections', sections, active, onChange, actions = null }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [label]);

  return (
    <section className="rounded-[1.15rem] border border-slate-200/70 bg-white p-2 shadow-soft sm:rounded-2xl">
      <div className="mb-2 flex flex-col gap-2 px-1 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="hidden text-[11px] font-semibold text-slate-500 sm:block">Use these tabs to focus this page.</p>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div ref={scrollRef} className="no-scrollbar flex snap-x gap-2 overflow-x-auto pb-1">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(section.id)}
              className={clsx(
                'group flex min-w-[9.75rem] snap-start items-center gap-2 rounded-xl border px-3 py-2 text-left transition duration-200 sm:min-w-[11.5rem]',
                isActive
                  ? 'border-clinical-200 bg-clinical-50/90 shadow-sm ring-2 ring-clinical-100'
                  : 'border-slate-200/80 bg-white/80 hover:border-clinical-200 hover:bg-slate-50'
              )}
            >
              {Icon && <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1', toneClasses[section.tone] || toneClasses.blue)}><Icon className="h-4 w-4" /></span>}
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-900">{section.label}</span>
                  {section.count !== undefined && <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold', isActive ? 'bg-clinical-500 text-white' : 'bg-slate-100 text-slate-600')}>{section.count}</span>}
                </span>
                {section.helper && <span className="mt-0.5 hidden truncate text-[11px] font-semibold text-slate-500 sm:block">{section.helper}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
