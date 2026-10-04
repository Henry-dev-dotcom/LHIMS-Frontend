import clsx from 'clsx';

export function ResponsiveTabs({ tabs, activeTab, onChange, className, ariaLabel = 'Section navigation' }) {
  if (!tabs?.length) return null;

  return (
    <div
      className={clsx(
        'rounded-[1.25rem] border border-slate-200/80 bg-white/95 p-1.5 shadow-soft backdrop-blur-xl sm:rounded-3xl sm:p-2',
        className
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div className="mobile-scroll-fade flex gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar sm:flex-wrap">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              title={tab.label}
              className={clsx(
                'min-h-10 max-w-[72vw] shrink-0 rounded-2xl px-3 py-2 text-xs font-semibold transition active:scale-[0.98] sm:max-w-none sm:px-4 sm:text-sm',
                active ? 'bg-clinical-600 text-white shadow-sm' : 'text-slate-600 hover:bg-clinical-50 hover:text-clinical-800'
              )}
            >
              <span className="block truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
