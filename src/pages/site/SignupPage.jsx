import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { SiteLayout } from './SiteLayout';
import { useCatalogue } from './useCatalogue';
import { fieldErrors, publicService, readSiteRoute, rememberFacilityCode } from '../../services/publicService';
import { normalizeAuthUser } from '../../api/normalizers';
import { useAppStore } from '../../store/AppStore';
import { money } from '../../utils/formatters';

const FACILITY_TYPES = ['Hospital', 'Clinic', 'Health centre', 'Maternity home', 'Diagnostic centre', 'Other'];
const inputClass = 'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-clinical-400 focus:ring-4 focus:ring-clinical-100';

function Field({ label, error, help, children }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span> : help ? <span className="mt-1 block text-xs font-normal text-slate-500">{help}</span> : null}
    </label>
  );
}

export function SignupPage() {
  const { dispatch } = useAppStore();
  const { data } = useCatalogue();
  const params = readSiteRoute().params;
  const [form, setForm] = useState({
    facilityName: '', facilityType: 'Hospital', phone: '', email: '', address: '',
    adminName: '', username: '', password: '', confirm: '', accept: false, website: ''
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [quote, setQuote] = useState(null);

  const plans = data?.plans || [];
  const plan = plans.find((p) => p.id === params.get('plan')) || plans[Math.min(1, plans.length - 1)] || null;
  const interval = params.get('interval') === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
  const addOns = useMemo(() => (params.get('addOns') || '').split(',').filter(Boolean), [params]);
  const names = Object.fromEntries((data?.departments || []).map((d) => [d.key, d.name]));

  /*
    The price they are actually agreeing to, worked out by the same endpoint the
    pricing page uses. Showing the plan's own monthly price here understated it
    whenever departments had been added or the billing was yearly - and this is
    the last number anyone sees before they sign up.
  */
  useEffect(() => {
    if (!plan) return undefined;
    let cancelled = false;
    setQuote(null);
    publicService.quote({ planId: plan.id, interval, addOns })
      .then((q) => { if (!cancelled) setQuote(q); })
      .catch(() => { if (!cancelled) setQuote(null); });
    return () => { cancelled = true; };
    // The params object is rebuilt every render, so depend on the contents of
    // addOns rather than its identity, or this refetches forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, interval, addOns.join()]);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function localErrors() {
    const e = {};
    if (form.password.length < 10) e['admin.password'] = 'Use at least 10 characters';
    else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) e['admin.password'] = 'Include at least one letter and one digit';
    if (form.confirm !== form.password) e.confirm = 'The passwords do not match';
    if (!form.accept) e.acceptTerms = 'Tick the box to continue';
    return e;
  }

  async function submit(event) {
    event.preventDefault();
    if (!plan) return;
    const local = localErrors();
    setErrors(local);
    setFormError('');
    if (Object.keys(local).length) return;
    setSubmitting(true);
    try {
      const result = await publicService.signup({
        facility: { name: form.facilityName.trim(), phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim() || undefined, facilityType: form.facilityType },
        admin: { name: form.adminName.trim(), username: form.username.trim().toLowerCase(), password: form.password },
        planId: plan.id,
        interval,
        addOns,
        acceptTerms: true,
        website: form.website
      });
      rememberFacilityCode(result.facility.code);
      setDone(result);
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(error?.message === 'Validation failed' ? 'Some details need fixing — see the messages below.' : error?.message || 'Sign-up did not work. Please try again.');
      setSubmitting(false);
    }
  }

  function enter() {
    const auth = normalizeAuthUser(done.user);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    dispatch({ type: 'SET_AUTH', auth, navigate: 'setup' });
  }

  if (done) {
    return (
      <SiteLayout active="signup">
        <section className="mx-auto max-w-xl px-4 py-16 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{done.facility.name} is ready</h1>
          <p className="mt-3 text-slate-600">Your free trial has started. Staff sign in with this facility code — write it down and share it with your team:</p>
          <p className="mx-auto mt-5 w-fit rounded-3xl bg-white px-8 py-4 font-mono text-4xl font-bold tracking-[0.2em] text-clinical-800 ring-1 ring-slate-200" aria-label={`Facility code ${done.facility.code.split('').join(' ')}`}>{done.facility.code}</p>
          <p className="mt-3 text-sm text-slate-500">Direct sign-in link for your staff: <span className="break-all font-semibold">{`${window.location.origin}${window.location.pathname}#/login/${done.facility.code}`}</span></p>
          <button type="button" onClick={enter} className="mt-8 rounded-2xl bg-clinical-500 px-6 py-3 text-sm font-semibold text-white shadow-lift hover:bg-clinical-600">Go to my hospital</button>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout active="signup">
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1fr_20rem]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create your hospital on LHIMS</h1>
          <p className="mt-2 text-slate-600">It takes about two minutes. You become the administrator and can add your staff straight after.</p>
          <form onSubmit={submit} noValidate className="mt-8 space-y-8">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Your facility</legend>
              <Field label="Facility name" error={errors['facility.name']}><input className={inputClass} required value={form.facilityName} onChange={set('facilityName')} autoComplete="organization" /></Field>
              <Field label="Type"><select className={inputClass} value={form.facilityType} onChange={set('facilityType')}>{FACILITY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Phone" error={errors['facility.phone']}><input className={inputClass} required type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>
              <Field label="Email" error={errors['facility.email']} help="Invoices and account notices go here."><input className={inputClass} required type="email" value={form.email} onChange={set('email')} autoComplete="email" /></Field>
              <div className="sm:col-span-2"><Field label="Address (optional)" error={errors['facility.address']}><input className={inputClass} value={form.address} onChange={set('address')} autoComplete="street-address" /></Field></div>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Your administrator account</legend>
              <Field label="Your full name" error={errors['admin.name']}><input className={inputClass} required value={form.adminName} onChange={set('adminName')} autoComplete="name" /></Field>
              <Field label="Username" error={errors['admin.username']} help="Letters, digits, dots or dashes."><input className={inputClass} required value={form.username} onChange={set('username')} autoComplete="username" autoCapitalize="none" /></Field>
              <Field label="Password" error={errors['admin.password']} help="At least 10 characters, with a letter and a digit."><input className={inputClass} required type="password" value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
              <Field label="Confirm password" error={errors.confirm}><input className={inputClass} required type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
            </fieldset>

            {/* Left empty by people; bots fill it in. */}
            <div className="hidden" aria-hidden="true">
              <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
            </div>

            <div>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" className="mt-1" checked={form.accept} onChange={set('accept')} />
                <span>I am authorised to register this facility, and I agree that LHIMS may store and process its records to provide the service.</span>
              </label>
              {errors.acceptTerms && <p className="mt-1 text-xs font-semibold text-red-600">{errors.acceptTerms}</p>}
            </div>

            {formError && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{formError}</p>}
            <button type="submit" disabled={submitting || !plan} className="inline-flex items-center gap-2 rounded-2xl bg-clinical-500 px-6 py-3 text-sm font-semibold text-white shadow-lift hover:bg-clinical-600 disabled:opacity-60">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} {submitting ? 'Creating your hospital…' : 'Create my hospital and start the trial'}
            </button>
          </form>
        </div>

        <aside className="h-fit rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-bold">Your plan</h2>
          {plan ? (
            <>
              <p className="mt-2 text-lg font-bold">{plan.name}</p>
              <p className="text-sm text-slate-600">{interval === 'YEARLY' ? 'Yearly' : 'Monthly'} billing</p>
              {quote ? (
                <>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {quote.lines.map((line) => (
                      <li key={line.description} className="flex justify-between gap-3">
                        <span className="text-slate-600">{line.description}</span>
                        <span className="font-semibold">{money(line.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
                    <span className="font-bold">Total</span>
                    <span className="text-xl font-bold">{money(quote.total)}<span className="text-sm font-semibold text-slate-500"> / {interval === 'MONTHLY' ? 'month' : 'year'}</span></span>
                  </p>
                  {interval === 'YEARLY' && <p className="mt-1 text-right text-xs text-slate-500">{money(quote.monthlyEquivalent)} a month</p>}
                </>
              ) : (
                /* Until the quote lands, "from" is the one thing we can say truthfully. */
                <p className="mt-2 text-sm text-slate-600">From {money(plan.monthlyPrice)} a month{addOns.length > 0 ? `, plus ${addOns.map((k) => names[k] || k).join(', ')}` : ''}</p>
              )}
              <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{plan.trialDays}-day free trial. No payment today.</p>
              <a href={`#/pricing?plan=${plan.id}&interval=${interval}${addOns.length ? `&addOns=${addOns.join(',')}` : ''}`} className="mt-3 inline-block text-sm font-semibold text-clinical-700 underline">Change plan or departments</a>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Loading plans…</p>
          )}
        </aside>
      </section>
    </SiteLayout>
  );
}
