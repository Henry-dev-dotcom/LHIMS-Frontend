import { cloneElement, isValidElement, useId } from 'react';
import clsx from 'clsx';

export function FormField({ label, help, error, required = false, children, className }) {
  const helpId = useId();
  const errorId = useId();
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  // Associate help/error text with the control and reflect validity to assistive
  // tech. Only a single element child can be enhanced; anything else passes
  // through untouched.
  const control = isValidElement(children)
    ? cloneElement(children, {
        'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-required': required || children.props['aria-required'] || undefined
      })
    : children;

  return (
    <label className={clsx('block min-w-0', className)}>
      <span className="block min-w-0 break-words text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-red-500" aria-hidden="true"> *</span>}
      </span>
      <div className="mt-2 min-w-0 [&>*]:min-w-0">{control}</div>
      {error ? (
        <span id={errorId} role="alert" className="mt-1.5 block break-words text-xs font-semibold leading-5 text-red-600">{error}</span>
      ) : (
        help && <span id={helpId} className="mt-1.5 block break-words text-xs leading-5 text-slate-500">{help}</span>
      )}
    </label>
  );
}

export const inputClass = 'clinical-input min-w-0';
