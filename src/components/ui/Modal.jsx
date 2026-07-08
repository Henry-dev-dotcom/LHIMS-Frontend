import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function Modal({ open, title, description, onClose, children, footer }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll(focusableSelector) || [])
        .filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    window.setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Stage 26 layering marker: z-[150] */}
      <div
      className="fixed inset-0 z-[160] flex items-end justify-center overflow-hidden bg-slate-950/62 px-0 py-0 backdrop-blur-md sm:items-center sm:px-4 sm:py-8"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="grid max-h-[calc(100dvh-0.75rem)] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-t-[1.65rem] border border-white/70 bg-white shadow-panel sm:max-h-[calc(100dvh-2rem)] sm:max-w-4xl sm:rounded-[2rem]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-white to-clinical-50/95 px-4 pb-3 pt-2.5 backdrop-blur sm:px-6 sm:py-5">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="break-words text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
              {description && <p id={descriptionId} className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
            </div>
            <Button ref={closeButtonRef} variant="subtle" className="h-10 w-10 shrink-0 p-0" onClick={onClose} aria-label="Close modal">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 [&_*]:min-w-0">{children}</div>
        {footer && (
          <div className="border-t border-slate-100 bg-slate-50/96 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:flex sm:flex-wrap sm:justify-end sm:gap-2 sm:px-6 sm:py-4 [&_button]:w-full sm:[&_button]:w-auto">
            <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:justify-end">{footer}</div>
          </div>
        )}
      </div>
    </div>
    </>,
    document.body
  );
}
