import { forwardRef } from 'react';
import clsx from 'clsx';

const variants = {
  primary: 'bg-clinical-500 text-white shadow-lift hover:bg-clinical-600',
  secondary: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-clinical-300 hover:bg-clinical-25 hover:text-clinical-800',
  danger: 'bg-danger text-white shadow-sm hover:bg-red-700',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  success: 'bg-success text-white shadow-sm hover:bg-emerald-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
};

const sizes = {
  sm: 'min-h-10 rounded-xl px-3 py-1.5 text-xs sm:min-h-0',
  md: 'min-h-11 rounded-2xl px-4 py-2 text-sm sm:min-h-0',
  lg: 'min-h-12 rounded-2xl px-5 py-3 text-sm sm:min-h-0'
};

export const Button = forwardRef(function Button({ children, variant = 'primary', size = 'md', className, type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex min-w-0 items-center justify-center gap-2 overflow-hidden text-center font-semibold leading-5 transition duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-clinical-200 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 [&_svg]:shrink-0',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
