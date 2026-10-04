import clsx from 'clsx';

export function MobileActionBar({ children, className, label = 'Page actions' }) {
  if (!children) return null;

  return (
    <section
      className={clsx(
        'lg:hidden max-h-[42dvh] overflow-y-auto overscroll-contain rounded-[1.25rem] border border-white/80 bg-white/95 p-3 shadow-soft backdrop-blur-xl',
        'mobile-action-bar',
        className
      )}
      aria-label={label}
    >
      <div className="grid min-w-0 gap-2 [&>*]:min-w-0 [&_.clinical-input]:w-full [&_button]:w-full [&_button]:justify-center [&_select]:w-full [&_textarea]:w-full">
        {children}
      </div>
    </section>
  );
}
