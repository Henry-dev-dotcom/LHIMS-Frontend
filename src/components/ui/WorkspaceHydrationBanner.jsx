import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';

export function WorkspaceHydrationBanner() {
  const { state, dispatch } = useAppStore();
  if (!state.hydrating && !state.hydrationError) return null;

  const timedOut = Boolean(state.hydrationError);
  return (
    <section
      className={timedOut
        ? 'mx-3 mt-2 rounded-[1.15rem] border border-amber-200/80 bg-amber-50/95 px-3 py-2 text-amber-950 shadow-sm sm:mx-5 lg:mx-8'
        : 'mx-3 mt-2 rounded-[1.15rem] border border-clinical-200/80 bg-clinical-50/95 px-3 py-2 text-clinical-950 shadow-sm sm:mx-5 lg:mx-8'}
      role={timedOut ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em]">
            {timedOut ? 'Workspace still loading' : 'Workspace loading'}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-5 opacity-80">
            {state.hydrationError || `${state.hydrationPhase || 'Loading workspace data'} — you can continue working while it finishes.`}
          </p>
        </div>
        {timedOut && (
          <button
            type="button"
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-white/85 px-3 py-1.5 text-xs font-bold shadow-sm ring-1 ring-amber-200 transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
            onClick={() => dispatch({ type: 'RETRY_HYDRATION' })}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry loading
          </button>
        )}
      </div>
    </section>
  );
}
