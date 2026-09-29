import { LifeBuoy } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';

const time = (value) => (value ? new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(new Date(value)) : '');

/** Always visible during a platform operator's read-only support session. */
export function SupportSessionBanner() {
  const { state, dispatch } = useAppStore();
  const support = state.auth?.support;
  if (!support) return null;
  return (
    <section className="mx-3 mt-2 rounded-[1.15rem] border border-violet-200 bg-violet-50 px-3 py-2 text-violet-950 shadow-sm sm:mx-5 lg:mx-8 print:hidden" role="status">
      <div className="mx-auto flex max-w-[1540px] flex-wrap items-center gap-2.5">
        <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.08em]">Support session · read-only · ends at {time(support.expiresAt)}</p>
          <p className="mt-0.5 text-xs font-semibold leading-5 opacity-80">
            {support.operatorName} is viewing {state.auth?.facility?.name} as {state.auth?.userName}. Reason: {support.reason}. Nothing can be changed, and this visit is in the facility&apos;s audit log.
          </p>
        </div>
        <button type="button" className="rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-white" onClick={() => dispatch({ type: 'LOGOUT' })}>
          End support session
        </button>
      </div>
    </section>
  );
}
