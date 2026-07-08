import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';

// Visual + semantic treatment per toast type. Errors/warnings are announced
// assertively via role="alert"; success/info use a polite status region.
const TOAST_STYLES = {
  success: { Icon: CheckCircle2, iconClass: 'text-emerald-300', assertive: false },
  error: { Icon: XCircle, iconClass: 'text-red-300', assertive: true },
  warning: { Icon: AlertTriangle, iconClass: 'text-amber-300', assertive: true },
  info: { Icon: Info, iconClass: 'text-clinical-200', assertive: false }
};

// Phase 6 QA anchor: bottom-[calc(6.25rem+env(safe-area-inset-bottom))]
export function ToastHost() {
  const { state, dispatch } = useAppStore();
  const toast = state.ui.toast;

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2800);
    return () => window.clearTimeout(timer);
  }, [toast, dispatch]);

  if (!toast) return null;

  const { Icon, iconClass, assertive } = TOAST_STYLES[toast.type] || TOAST_STYLES.success;

  return (
    <div
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="mobile-toast fixed inset-x-3 bottom-[calc(var(--mobile-bottom-nav-space,6.25rem)+env(safe-area-inset-bottom))] z-[160] rounded-3xl border border-white/15 bg-slate-950/95 px-4 py-3 text-sm font-semibold text-white shadow-panel backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-sm sm:px-5 sm:py-4"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden="true" />
        <span className="min-w-0 break-words">{toast.message}</span>
      </div>
    </div>
  );
}
