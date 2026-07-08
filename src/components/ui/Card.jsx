import clsx from 'clsx';

export function Card({ title, subtitle, actions, children, className, compact = false }) {
  const hasVisibleChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  const isSimpleStatCard = Boolean(title && subtitle !== undefined && !actions && !hasVisibleChildren);

  return (
    <section
      className={clsx(
        'clinical-panel min-w-0 rounded-[1.2rem] p-3.5 shadow-soft sm:rounded-[1.75rem] sm:p-5',
        isSimpleStatCard && 'clinical-stat-card',
        compact && 'p-3.5 sm:p-4',
        className
      )}
    >
      {(title || subtitle || actions) && (
        <div className={clsx('mb-3 flex min-w-0 flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between', compact && 'mb-3')}>
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-base font-semibold leading-6 tracking-tight text-slate-900 sm:text-lg">{title}</h2>}
            {subtitle && <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500 sm:leading-6">{subtitle}</p>}
          </div>
          {actions && (
            <div className="grid w-full min-w-0 shrink-0 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end [&_.clinical-input]:w-full [&_button]:w-full [&_button]:justify-center sm:[&_button]:w-auto [&_select]:w-full sm:[&_select]:w-auto">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className="min-w-0">{children}</div>
    </section>
  );
}
