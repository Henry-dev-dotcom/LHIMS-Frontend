import { useEffect } from 'react';
import { AlertTriangle, Clock, Lock } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { daysUntil, paymentReferenceFromUrl } from '../../services/subscriptionService';

const formatDate = (value) => (value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : '');

/**
 * Subscription notices for the whole facility: trial ending, payment overdue,
 * read-only. The administrator gets a button to Subscription & billing; other
 * staff are told who can fix it.
 */
export function SubscriptionBanner() {
  const { state, dispatch } = useAppStore();
  const s = state.auth?.subscription;
  const isAdmin = state.auth?.role === 'admin';

  // Back from the payment page: the billing page confirms the payment.
  useEffect(() => {
    if (isAdmin && paymentReferenceFromUrl() && state.currentPage !== 'subscription') dispatch({ type: 'NAVIGATE', pageId: 'subscription' });
  }, [isAdmin, state.currentPage, dispatch]);

  if (!s) return null;
  const trialDays = daysUntil(s.trialEndsAt);
  let notice = null;
  if (s.readOnly) {
    notice = {
      tone: 'border-red-200 bg-red-50 text-red-900',
      Icon: Lock,
      title: s.status === 'CANCELLED' ? 'Subscription ended — records are read-only' : 'Subscription unpaid — records are read-only',
      detail: `You can view everything, but nothing can be added or changed. ${isAdmin ? 'Pay to restore full use.' : 'Ask your administrator to renew the subscription.'} No data has been deleted.`
    };
  } else if (s.status === 'PAST_DUE') {
    notice = {
      tone: 'border-amber-200 bg-amber-50 text-amber-950',
      Icon: AlertTriangle,
      title: 'Subscription payment overdue',
      detail: `The renewal payment did not go through. ${isAdmin ? 'Pay' : 'Your administrator needs to pay'} by ${formatDate(s.graceEndsAt)}, or records become read-only.`
    };
  } else if (s.status === 'TRIALING' && trialDays !== null && trialDays <= 7) {
    notice = {
      tone: 'border-sky-200 bg-sky-50 text-sky-950',
      Icon: Clock,
      title: trialDays <= 0 ? 'Free trial ends today' : `Free trial ends in ${trialDays} day${trialDays === 1 ? '' : 's'}`,
      detail: isAdmin ? 'Choose a plan to keep full use after the trial.' : 'Your administrator can choose a plan to keep full use after the trial.'
    };
  } else if (isAdmin && s.cancelAtPeriodEnd) {
    notice = {
      tone: 'border-slate-200 bg-slate-50 text-slate-900',
      Icon: Clock,
      title: `Subscription ends on ${formatDate(s.currentPeriodEnd || s.trialEndsAt)}`,
      detail: 'After that, records become read-only. You can keep the subscription from Subscription & billing.'
    };
  }
  if (!notice) return null;
  const { Icon } = notice;

  return (
    <section className={`mx-3 mt-2 rounded-[1.15rem] border px-3 py-2 shadow-sm sm:mx-5 lg:mx-8 print:hidden ${notice.tone}`} role={s.readOnly || s.status === 'PAST_DUE' ? 'alert' : 'status'}>
      <div className="mx-auto flex max-w-[1540px] flex-wrap items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.08em]">{notice.title}</p>
          <p className="mt-0.5 text-xs font-semibold leading-5 opacity-80">{notice.detail}</p>
        </div>
        {isAdmin && state.currentPage !== 'subscription' && (
          <button type="button" className="rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-white" onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'subscription' })}>
            Subscription &amp; billing
          </button>
        )}
      </div>
    </section>
  );
}
