import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, RefreshCw, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { authService } from '../../services/authService';
import { normalizeAuthUser } from '../../api/normalizers';
import { formatDateTime, money } from '../../utils/formatters';
import {
  INTERVAL_LABEL, INVOICE_KIND, INVOICE_STATUS, SUBSCRIPTION_STATUS,
  clearPaymentReferenceFromUrl, daysUntil, paymentReferenceFromUrl, subscriptionService
} from '../../services/subscriptionService';
import { Pill } from './Pill';

const formatDate = (value) => (value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : '—');

/** Sends the payer to the gateway's checkout page. */
function goToCheckout(checkout) {
  if (checkout?.authorizationUrl) window.location.assign(checkout.authorizationUrl);
}

export function SubscriptionPage() {
  const { state, dispatch } = useAppStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [chooser, setChooser] = useState(null); // 'checkout' | 'change'
  const confirmedRef = useRef(false);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  // Keeps the menus and banners in step with the subscription.
  const refreshSession = useCallback(async () => {
    try {
      const user = await authService.me(apiClient);
      const auth = normalizeAuthUser(user?.user || user);
      if (auth) dispatch({ type: 'SET_AUTH', auth });
    } catch { /* the next request signs out if the session is gone */ }
  }, [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setData(await subscriptionService.mine(apiClient));
    } catch (error) {
      setLoadError(error?.message || 'Your subscription could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Back from the payment page: check the payment with the gateway, then reload.
  useEffect(() => {
    const reference = paymentReferenceFromUrl();
    if (!reference || confirmedRef.current) {
      load();
      return;
    }
    confirmedRef.current = true;
    (async () => {
      try {
        const result = await subscriptionService.confirm(apiClient, reference);
        if (result?.status === 'PAID') toast('success', 'Payment received. Thank you — your subscription is up to date.');
        else if (result?.status === 'FAILED') toast('error', result?.message ? `The payment did not go through: ${result.message}` : 'The payment did not go through.');
        else toast('info', 'The payment is still being processed. This page updates once it is confirmed.');
      } catch (error) {
        toast('error', error?.message || 'The payment could not be checked.');
      } finally {
        clearPaymentReferenceFromUrl();
        await load();
        await refreshSession();
      }
    })();
  }, [load, refreshSession, toast]);

  const s = data?.subscription;
  const names = useMemo(() => Object.fromEntries((data?.departments || []).map((d) => [d.key, d.name])), [data]);
  const openInvoice = (data?.invoices || []).find((i) => i.status === 'OPEN');
  const renewalOutstanding = (data?.invoices || []).some((i) => i.status === 'OPEN' && i.kind === 'RENEWAL');

  async function act(key, fn, success) {
    setBusy(key);
    try {
      const result = await fn();
      if (success) toast('success', success);
      await load();
      await refreshSession();
      return result;
    } catch (error) {
      toast('error', error?.message || 'That did not work. Try again.');
      return null;
    } finally {
      setBusy('');
    }
  }

  async function pay(invoice) {
    setBusy(`pay-${invoice.id}`);
    try {
      goToCheckout(await subscriptionService.payInvoice(apiClient, invoice.id));
    } catch (error) {
      toast('error', error?.message || 'Checkout could not be started.');
      setBusy('');
    }
  }

  if (loading && !data) return <div className="p-6 text-sm text-slate-500">Loading your subscription…</div>;
  if (loadError) return <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</div>;

  if (data?.managedByPlatform) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Admin" title="Subscription & billing" description="Your plan, departments and payments." />
        <Card title="Managed by your LHIMS provider">
          <p className="text-sm text-slate-600">This facility's departments are set by the LHIMS platform operator under a separate agreement, so there is nothing to pay here. Contact them to change departments.</p>
        </Card>
      </div>
    );
  }

  const canCheckout = ['TRIALING', 'CANCELLED'].includes(s.status) || (s.status === 'SUSPENDED' && !renewalOutstanding);
  const trialDays = daysUntil(s.trialEndsAt);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Admin" title="Subscription & billing" description="Your plan, departments and payments. Payments are taken securely by Paystack (card or mobile money)." />

      <Card
        title={`${s.plan.name} plan`}
        subtitle={`${INTERVAL_LABEL[s.interval]} billing`}
        actions={(
          <>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            {canCheckout && <Button onClick={() => setChooser('checkout')}><Sparkles className="h-4 w-4" /> {s.status === 'TRIALING' ? 'Choose a plan and pay' : 'Renew subscription'}</Button>}
            {s.status === 'ACTIVE' && <Button variant="secondary" onClick={() => setChooser('change')}>Change plan or departments</Button>}
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Status</p>
            <p className="mt-1"><Pill map={SUBSCRIPTION_STATUS} value={s.status} /></p>
            {s.cancelAtPeriodEnd && s.status !== 'CANCELLED' && <p className="mt-1 text-xs font-semibold text-amber-700">Ends on {formatDate(s.currentPeriodEnd || s.trialEndsAt)}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {s.status === 'TRIALING' ? 'Trial ends' : s.status === 'PAST_DUE' ? 'Pay by' : 'Paid until'}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {s.status === 'TRIALING' ? `${formatDate(s.trialEndsAt)}${trialDays !== null && trialDays >= 0 ? ` (${trialDays} day${trialDays === 1 ? '' : 's'})` : ''}` : s.status === 'PAST_DUE' ? formatDate(s.graceEndsAt) : formatDate(s.currentPeriodEnd)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Price</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{s.price ? `${money(s.price.total)} / ${s.interval === 'YEARLY' ? 'year' : 'month'}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Staff accounts</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{s.usage.users}{s.usage.maxUsers ? ` of ${s.usage.maxUsers}` : ' (unlimited)'}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">New patients this month</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{s.usage.patientsThisMonth}{s.usage.maxPatientsPerMonth ? ` of ${s.usage.maxPatientsPerMonth}` : ''}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">File storage</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{s.usage.storageMb} MB{s.usage.maxStorageMb ? ` of ${s.usage.maxStorageMb} MB` : ''}</p>
          </div>
        </div>
        {s.usage.overFairUse && (
          <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-2 text-sm text-sky-900">You are using more than your plan covers. Nothing is blocked — care always comes first — but please consider a larger plan.</p>
        )}

        {s.readOnly && (
          <div role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {s.status === 'CANCELLED' ? 'Your subscription has ended.' : 'Your subscription is unpaid.'} Staff can still view every record, but nothing can be added or changed until payment is made. No data has been deleted.
          </div>
        )}
        {s.status === 'PAST_DUE' && (
          <div role="alert" className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            The renewal payment did not go through{openInvoice?.lastError ? ` (${openInvoice.lastError})` : ''}. We try the saved payment method again daily. Pay before {formatDate(s.graceEndsAt)} to avoid the account becoming read-only.
          </div>
        )}
        {s.hasPendingChange && (
          <p className="mt-4 text-sm text-slate-600">
            From your next renewal: <strong>{(s.pendingPlan || s.plan).name}</strong>, {INTERVAL_LABEL[s.pendingInterval || s.interval].toLowerCase()} billing{s.pendingAddOns?.length ? `, with ${s.pendingAddOns.map((k) => names[k] || k).join(', ')}` : ''}.
          </p>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Departments included</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {s.modules.map((key) => (
                <li key={key} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.addOnModules.includes(key) ? 'bg-violet-100 text-violet-900' : 'bg-slate-100 text-slate-700'}`}>
                  {names[key] || key}{s.addOnModules.includes(key) ? ' (add-on)' : ''}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Payment method</p>
            <p className="mt-2 text-sm text-slate-700">{s.hasSavedPaymentMethod ? `${s.gatewayAuthorizationHint || 'Saved card or wallet'} — renewals are charged automatically.` : 'None saved yet. The method you pay with first is kept for renewals.'}</p>
            {s.price?.lines?.length > 0 && (
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {s.price.lines.map((line) => <tr key={line.description}><td className="py-0.5 text-slate-600">{line.description}</td><td className="py-0.5 text-right font-semibold">{money(line.amount)}</td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {openInvoice && <Button onClick={() => pay(openInvoice)} disabled={Boolean(busy)}><CreditCard className="h-4 w-4" /> Pay {money(openInvoice.amount)} now</Button>}
          {s.status !== 'CANCELLED' && !s.cancelAtPeriodEnd && s.status !== 'SUSPENDED' && (
            <Button variant="ghost" disabled={Boolean(busy)} onClick={() => { if (window.confirm('Cancel the subscription? It stays usable until the end of the paid period (or trial), then becomes read-only. You can resume before then.')) act('cancel', () => subscriptionService.cancel(apiClient), 'Cancellation scheduled.'); }}>
              <XCircle className="h-4 w-4" /> Cancel subscription
            </Button>
          )}
          {s.cancelAtPeriodEnd && s.status !== 'CANCELLED' && (
            <Button variant="secondary" disabled={Boolean(busy)} onClick={() => act('resume', () => subscriptionService.resume(apiClient), 'Your subscription will continue.')}>
              <RotateCcw className="h-4 w-4" /> Keep my subscription
            </Button>
          )}
        </div>
      </Card>

      <Card title="Invoices" subtitle="Subscription invoices from LHIMS (not patient bills).">
        <DataTable
          caption="Subscription invoices"
          emptyMessage="No invoices yet."
          rows={data.invoices}
          columns={[
            { key: 'invoiceNumber', label: 'Invoice', mobilePrimary: true },
            { key: 'kind', label: 'For', render: (row) => INVOICE_KIND[row.kind] || row.kind },
            { key: 'period', label: 'Period', render: (row) => `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}` },
            { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
            { key: 'status', label: 'Status', render: (row) => <Pill map={INVOICE_STATUS} value={row.status} /> },
            { key: 'paidAt', label: 'Paid', render: (row) => (row.paidAt ? formatDateTime(row.paidAt) : row.lastError ? <span className="text-xs text-red-700">{row.lastError}</span> : '—') },
            { key: 'actions', label: '', render: (row) => (row.status === 'OPEN' ? <Button size="sm" onClick={() => pay(row)} disabled={Boolean(busy)}>Pay</Button> : null) }
          ]}
        />
      </Card>

      {chooser && (
        <PlanChooser
          key={chooser}
          mode={chooser}
          data={data}
          names={names}
          defaultEmail={s.billingEmail || state.auth?.email || ''}
          onClose={() => setChooser(null)}
          onDone={async (result) => {
            if (chooser === 'checkout') return goToCheckout(result);
            setChooser(null);
            if (result?.effective === 'AFTER_PAYMENT') return goToCheckout(result.checkout);
            toast('success', result?.effective === 'NOW' ? `Done. ${result.charged ? `${money(result.charged)} was charged for the rest of this period.` : ''} New departments are available now.` : `Scheduled: the change takes effect at your next renewal on ${formatDate(result?.at)}.`);
            await load();
            await refreshSession();
          }}
        />
      )}
    </div>
  );
}

function PlanChooser({ mode, data, names, defaultEmail, onClose, onDone }) {
  const s = data.subscription;
  const [planId, setPlanId] = useState(s.planId);
  const [interval, setBillingInterval] = useState(s.interval);
  const [addOns, setAddOns] = useState(s.addOnModules);
  const [email, setEmail] = useState(defaultEmail);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const plan = data.plans.find((p) => p.id === planId);
  const availableAddOns = data.addOns.filter((a) => !plan?.modules.includes(a.moduleKey));
  const chosenAddOns = addOns.filter((k) => availableAddOns.some((a) => a.moduleKey === k));

  useEffect(() => {
    let cancelled = false;
    setError('');
    subscriptionService.quote(apiClient, { planId, interval, addOns: chosenAddOns })
      .then((q) => { if (!cancelled) setQuote(q); })
      .catch((e) => { if (!cancelled) { setQuote(null); setError(e?.message || 'The price could not be worked out.'); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, interval, chosenAddOns.join()]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { planId, interval, addOns: chosenAddOns };
      const result = mode === 'checkout'
        ? await subscriptionService.checkout(apiClient, { ...payload, billingEmail: email.trim() })
        : await subscriptionService.change(apiClient, payload);
      await onDone(result);
    } catch (e) {
      setError(e?.message || 'That did not work. Try again.');
      setSaving(false);
    }
  }

  const toggle = (key) => setAddOns((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  return (
    <Modal
      open
      title={mode === 'checkout' ? 'Choose your plan' : 'Change plan or departments'}
      description={mode === 'checkout'
        ? 'You will be taken to Paystack to pay by card or mobile money. Your departments switch on as soon as payment is confirmed.'
        : 'Adding departments or moving to a bigger plan takes effect now, for the rest of this period. Smaller plans, fewer departments and a new billing interval start at your next renewal.'}
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="plan-chooser" disabled={saving || !quote || (mode === 'checkout' && !email.includes('@'))}>
            <CreditCard className="h-4 w-4" /> {saving ? 'Working…' : mode === 'checkout' ? `Pay ${quote ? money(quote.total) : ''}` : 'Confirm change'}
          </Button>
        </>
      )}
    >
      <form id="plan-chooser" onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Plan</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {data.plans.map((p) => (
              <label key={p.id} className={`cursor-pointer rounded-2xl border p-3 text-sm ${p.id === planId ? 'border-clinical-500 bg-clinical-25 ring-2 ring-clinical-200' : 'border-slate-200 bg-white'}`}>
                <input type="radio" name="plan" className="sr-only" checked={p.id === planId} onChange={() => setPlanId(p.id)} />
                <span className="block font-bold text-slate-900">{p.name}</span>
                <span className="block font-semibold text-slate-700">{money(p.monthlyPrice)} / month</span>
                <span className="mt-1 block text-xs text-slate-500">{p.modules.length} departments · {p.maxUsers ? `${p.maxUsers} staff` : 'unlimited staff'}</span>
                {p.description && <span className="mt-1 block text-xs text-slate-500">{p.description}</span>}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Billing</legend>
          <div className="mt-2 flex gap-2">
            {['MONTHLY', 'YEARLY'].map((value) => (
              <label key={value} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold ${interval === value ? 'border-clinical-500 bg-clinical-25' : 'border-slate-200'}`}>
                <input type="radio" name="interval" className="sr-only" checked={interval === value} onChange={() => setBillingInterval(value)} />
                {INTERVAL_LABEL[value]}{value === 'YEARLY' && plan?.yearlyDiscountPercent ? ` (save ${plan.yearlyDiscountPercent}%)` : ''}
              </label>
            ))}
          </div>
        </fieldset>

        {availableAddOns.length > 0 && (
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Extra departments</legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {availableAddOns.map((a) => (
                <label key={a.moduleKey} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={addOns.includes(a.moduleKey)} onChange={() => toggle(a.moduleKey)} />
                    {names[a.moduleKey] || a.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">+{money(a.monthlyPrice)}/mo</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {mode === 'checkout' && (
          <FormField label="Billing email" required help="Receipts and renewal notices go here.">
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
        )}

        {quote && (
          <div className="rounded-2xl bg-slate-50 p-3 text-sm">
            {quote.lines.map((line) => <div key={line.description} className="flex justify-between"><span className="text-slate-600">{line.description}</span><span className="font-semibold">{money(line.amount)}</span></div>)}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-bold"><span>Total per {interval === 'YEARLY' ? 'year' : 'month'}</span><span>{money(quote.total)}</span></div>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
