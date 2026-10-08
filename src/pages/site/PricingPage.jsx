import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { SiteLayout } from './SiteLayout';
import { useCatalogue } from './useCatalogue';
import { publicService, readSiteRoute } from '../../services/publicService';
import { money } from '../../utils/formatters';

/*
  Plan builder.

  The first question is what kind of facility they run, not how big they are,
  because that is the one a customer can answer without reading anything. The
  plans for that kind follow, then the departments they want on top, then the
  price. A diagnostic centre never has to scroll past hospital pricing to find
  itself.
*/
export function PricingPage() {
  const { data, loading, error } = useCatalogue();
  const initial = readSiteRoute().params;
  const plans = useMemo(() => data?.plans || [], [data]);
  const kinds = data?.facilityKinds || [];

  const [kind, setKind] = useState(initial.get('kind') || '');
  const [planId, setPlanId] = useState(initial.get('plan') || '');
  const [interval, setBillingInterval] = useState(initial.get('interval') === 'YEARLY' ? 'YEARLY' : 'MONTHLY');
  const [addOns, setAddOns] = useState(() => (initial.get('addOns') || '').split(',').filter(Boolean));
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');

  // A link straight to a plan implies its kind, so the page opens where it should.
  useEffect(() => {
    if (kind || !planId || plans.length === 0) return;
    const linked = plans.find((p) => p.id === planId);
    if (linked) setKind(linked.facilityKind);
  }, [kind, planId, plans]);

  const kindPlans = useMemo(() => plans.filter((p) => p.facilityKind === kind), [plans, kind]);
  const plan = kindPlans.find((p) => p.id === planId) || kindPlans[0] || null;
  const activeKind = kinds.find((k) => k.key === kind) || null;

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
  const chooseKind = (key) => {
    setKind(key);
    // The plan belongs to the old kind, and so may some of the departments.
    setPlanId('');
    setAddOns([]);
  };
  const signupHref = plan ? `#/signup?plan=${encodeURIComponent(plan.id)}&interval=${interval}${chosen.length ? `&addOns=${chosen.join(',')}` : ''}` : '#/signup';

  return (
    <SiteLayout active="pricing">
      <section className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-300">Pricing</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {activeKind ? activeKind.name : 'What kind of facility do you run?'}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          {activeKind
            ? 'Start from the plan that fits, then add any other department you need. Every plan starts with a free trial; you pay only when you decide to continue.'
            : 'Pick the one closest to yours and we will show you the plans built for it — not a list of everything we sell.'}
        </p>

        {loading && <p className="mt-8 text-sm text-slate-500">Loading prices…</p>}
        {error && <p role="alert" className="mt-8 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {/* Step one: what they run. */}
        {!activeKind && kinds.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Kind of facility">
            {kinds.map((k) => {
              const from = plans.filter((p) => p.facilityKind === k.key).reduce((lowest, p) => (lowest === null || p.monthlyPrice < lowest ? p.monthlyPrice : lowest), null);
              return (
                <button
                  key={k.key}
                  type="button"
                  role="radio"
                  aria-checked="false"
                  onClick={() => chooseKind(k.key)}
                  className="rounded-3xl border border-slate-200 bg-white p-6 text-left transition hover:border-clinical-400 hover:shadow-lift focus:outline-none focus-visible:ring-4 focus-visible:ring-clinical-100"
                >
                  <span className="text-xl font-bold text-slate-900">{k.name}</span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">{k.summary}</span>
                  <span className="mt-3 block text-xs font-semibold text-slate-500">{k.examples}</span>
                  {from !== null && <span className="mt-4 block text-sm font-bold text-clinical-700">From {money(from)} a month</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Step two: the plans for that kind, and what to add. */}
        {activeKind && plan && (
          <>
            <button type="button" onClick={() => chooseKind('')} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-clinical-700 hover:underline">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> A different kind of facility
            </button>

            <div className="mt-5 inline-flex rounded-2xl bg-white p-1 ring-1 ring-slate-200" role="radiogroup" aria-label="Billing">
              {['MONTHLY', 'YEARLY'].map((value) => (
                <button key={value} type="button" role="radio" aria-checked={interval === value} onClick={() => setBillingInterval(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${interval === value ? 'bg-clinical-500 text-white' : 'text-slate-600'}`}>
                  {value === 'MONTHLY' ? 'Monthly' : `Yearly${plan.yearlyDiscountPercent ? ` · save ${plan.yearlyDiscountPercent}%` : ''}`}
                </button>
              ))}
            </div>

            <div className={`mt-5 grid gap-4 ${kindPlans.length > 1 ? 'md:grid-cols-2' : 'max-w-md'}`} role="radiogroup" aria-label="Plan">
              {kindPlans.map((p) => {
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
                <h2 className="text-lg font-bold text-white">Add departments</h2>
                <p className="mt-1 text-sm text-slate-300">Anything the {plan.name} plan does not already include. Nothing here is locked to the kind of facility you chose — a diagnostic centre that opens a dispensary just adds Pharmacy.</p>
                {availableAddOns.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">The {plan.name} plan already includes every department.</p>
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
