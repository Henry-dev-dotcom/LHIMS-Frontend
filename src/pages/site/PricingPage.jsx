import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { SiteLayout } from './SiteLayout';
import { useCatalogue } from './useCatalogue';
import { publicService, readSiteRoute } from '../../services/publicService';
import { money } from '../../utils/formatters';

/** Plan builder: pick a plan, billing interval and extra departments; see the live price. */
export function PricingPage() {
  const { data, loading, error } = useCatalogue();
  const initial = readSiteRoute().params;
  const [planId, setPlanId] = useState(initial.get('plan') || '');
  const [interval, setBillingInterval] = useState(initial.get('interval') === 'YEARLY' ? 'YEARLY' : 'MONTHLY');
  const [addOns, setAddOns] = useState(() => (initial.get('addOns') || '').split(',').filter(Boolean));
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');

  const plans = data?.plans || [];
  const plan = plans.find((p) => p.id === planId) || plans[Math.min(1, plans.length - 1)] || null;
  const names = useMemo(() => Object.fromEntries((data?.departments || []).map((d) => [d.key, d.name])), [data]);
  const availableAddOns = (data?.addOns || []).filter((a) => plan && !plan.modules.includes(a.moduleKey));
  const chosen = addOns.filter((k) => availableAddOns.some((a) => a.moduleKey === k));

  useEffect(() => {
    if (!plan) return undefined;
    let cancelled = false;
    setQuoteError('');
    publicService.quote({ planId: plan.id, interval, addOns: chosen })
      .then((q) => { if (!cancelled) setQuote(q); })
      .catch((e) => { if (!cancelled) { setQuote(null); setQuoteError(e?.message || 'The price could not be worked out.'); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, interval, chosen.join()]);

  const toggle = (key) => setAddOns((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
  const signupHref = plan ? `#/signup?plan=${encodeURIComponent(plan.id)}&interval=${interval}${chosen.length ? `&addOns=${chosen.join(',')}` : ''}` : '#/signup';

  return (
    <SiteLayout active="pricing">
      <section className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-clinical-700">Pricing</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Pay for the departments you use</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Choose a plan, add departments, and see your price. Every plan starts with a free trial; you pay only when you decide to continue.</p>

        {loading && <p className="mt-8 text-sm text-slate-500">Loading prices…</p>}
        {error && <p role="alert" className="mt-8 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {plan && (
          <>
            <div className="mt-8 inline-flex rounded-2xl bg-white p-1 ring-1 ring-slate-200" role="radiogroup" aria-label="Billing">
              {['MONTHLY', 'YEARLY'].map((value) => (
                <button key={value} type="button" role="radio" aria-checked={interval === value} onClick={() => setBillingInterval(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${interval === value ? 'bg-clinical-500 text-white' : 'text-slate-600'}`}>
                  {value === 'MONTHLY' ? 'Monthly' : `Yearly${plan.yearlyDiscountPercent ? ` · save ${plan.yearlyDiscountPercent}%` : ''}`}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3" role="radiogroup" aria-label="Plan">
              {plans.map((p) => {
                const selected = p.id === plan.id;
                const yearly = Math.round(p.monthlyPrice * 12 * (1 - p.yearlyDiscountPercent / 100) * 100) / 100;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={selected} onClick={() => setPlanId(p.id)}
                    className={`rounded-3xl border bg-white p-5 text-left transition ${selected ? 'border-clinical-500 ring-4 ring-clinical-100' : 'border-slate-200 hover:border-clinical-300'}`}>
                    <span className="flex items-center justify-between">
                      <span className="text-lg font-bold">{p.name}</span>
                      {selected && <Check className="h-5 w-5 text-clinical-600" aria-hidden="true" />}
                    </span>
                    <span className="mt-2 block text-2xl font-bold">{interval === 'MONTHLY' ? money(p.monthlyPrice) : money(yearly)}<span className="text-sm font-semibold text-slate-500"> / {interval === 'MONTHLY' ? 'month' : 'year'}</span></span>
                    {p.description && <span className="mt-2 block text-sm text-slate-600">{p.description}</span>}
                    <span className="mt-3 block text-xs font-semibold text-slate-500">{p.modules.length} departments · {p.maxUsers ? `up to ${p.maxUsers} staff accounts` : 'unlimited staff accounts'} · {p.trialDays}-day free trial</span>
                    <span className="mt-3 flex flex-wrap gap-1">
                      {p.modules.slice(0, 8).map((k) => <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{names[k] || k}</span>)}
                      {p.modules.length > 8 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">+{p.modules.length - 8} more</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
              <div>
                <h2 className="text-lg font-bold">Add departments</h2>
                {availableAddOns.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">The {plan.name} plan already includes every department.</p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {availableAddOns.map((a) => (
                      <label key={a.moduleKey} className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 text-sm ${chosen.includes(a.moduleKey) ? 'border-clinical-400' : 'border-slate-200'}`}>
                        <span className="flex items-center gap-2 font-semibold">
                          <input type="checkbox" checked={chosen.includes(a.moduleKey)} onChange={() => toggle(a.moduleKey)} />
                          {names[a.moduleKey] || a.name}
                        </span>
                        <span className="whitespace-nowrap text-xs font-semibold text-slate-500">+{money(a.monthlyPrice)}/mo</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <aside className="h-fit rounded-3xl bg-white p-5 ring-1 ring-slate-200 lg:sticky lg:top-24" aria-live="polite">
                <h2 className="text-lg font-bold">Your price</h2>
                {quote ? (
                  <>
                    <ul className="mt-3 space-y-1.5 text-sm">
                      {quote.lines.map((line) => <li key={line.description} className="flex justify-between gap-3"><span className="text-slate-600">{line.description}</span><span className="font-semibold">{money(line.amount)}</span></li>)}
                    </ul>
                    <p className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3"><span className="font-bold">Total</span><span className="text-2xl font-bold">{money(quote.total)}<span className="text-sm text-slate-500"> / {interval === 'MONTHLY' ? 'month' : 'year'}</span></span></p>
                    {interval === 'YEARLY' && <p className="mt-1 text-right text-xs text-slate-500">{money(quote.monthlyEquivalent)} a month</p>}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">{quoteError || 'Working out your price…'}</p>
                )}
                <a href={signupHref} className="mt-5 block rounded-2xl bg-clinical-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lift hover:bg-clinical-600">Start {plan.trialDays}-day free trial</a>
                <p className="mt-2 text-center text-xs text-slate-500">No card needed. Pay by card or mobile money when you continue.</p>
              </aside>
            </div>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
