import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Building2, CalendarClock, Check, FlaskConical, LogOut, PackageOpen, Phone, RefreshCw, Search, ShieldCheck, Wrench, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { vendorPortalService } from '../../services/vendorPortalService';

const STATUS_META = {
  PENDING: { label: 'Pending', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ACKNOWLEDGED: { label: 'Acknowledged', tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
  SCHEDULED: { label: 'Scheduled', tone: 'bg-violet-50 text-violet-800 ring-violet-200' },
  COMPLETED: { label: 'Completed', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  DECLINED: { label: 'Declined', tone: 'bg-rose-50 text-rose-800 ring-rose-200' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-slate-100 text-slate-600 ring-slate-200' }
};
const STATUS_ACTIONS = {
  PENDING: ['ACKNOWLEDGED', 'SCHEDULED', 'DECLINED'],
  ACKNOWLEDGED: ['SCHEDULED', 'COMPLETED', 'DECLINED'],
  SCHEDULED: ['COMPLETED', 'DECLINED'],
  COMPLETED: [], DECLINED: [], CANCELLED: []
};
const ACTION_LABELS = {
  ACKNOWLEDGED: 'Acknowledge request',
  SCHEDULED: 'Schedule service',
  COMPLETED: 'Mark as completed',
  DECLINED: 'Decline request'
};
const FILTERS = [
  ['ALL', 'All requests'], ['PENDING', 'Pending'], ['ACKNOWLEDGED', 'Acknowledged'],
  ['SCHEDULED', 'Scheduled'], ['COMPLETED', 'Completed'], ['DECLINED', 'Declined'], ['CANCELLED', 'Cancelled']
];
const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';
const statusMeta = (status) => STATUS_META[status] || { label: status, tone: 'bg-slate-100 text-slate-700 ring-slate-200' };

function StatusPill({ status }) {
  const meta = statusMeta(status);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${meta.tone}`}>{meta.label}</span>;
}

function RequestSummary({ request }) {
  const isSupply = request.type === 'SUPPLY';
  const Icon = isSupply ? PackageOpen : Wrench;
  const title = isSupply ? request.itemDescription : request.analyzerName || 'Laboratory analyzer';
  const subtitle = isSupply
    ? `${request.quantity ?? ''} ${request.quantityUnit ?? ''} · ${(request.supplyCategory || '').replace(/_/g, ' ').toLowerCase()}`.trim()
    : request.serviceDescription;
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-clinical-50 text-clinical-700"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{title || 'Request details'}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{subtitle || 'No additional details provided'}</p>
      </div>
    </div>
  );
}

function LoginPanel({ activate, token, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (activate && password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const user = activate
        ? await vendorPortalService.activate(token, password)
        : await vendorPortalService.login(email, password);
      onSuccess(user);
    } catch (requestError) {
      const validationErrors = requestError?.details?.errors;
      const hasActivationValidationErrors = activate
        && requestError?.details?.code === 'VALIDATION_FAILED'
        && Array.isArray(validationErrors);
      if (hasActivationValidationErrors && validationErrors.some((item) => item.field === 'token')) {
        setError('This invitation link looks incomplete. Open the full setup link from the administrator or ask for a new one.');
      } else if (hasActivationValidationErrors && validationErrors.some((item) => item.field === 'password')) {
        setError('The password could not be validated. Use 8–128 characters and follow the requirements shown above.');
      } else {
        setError(requestError?.message || (activate ? 'This setup link could not be used.' : 'Sign-in failed. Check your email and password.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="border-b border-slate-100 bg-gradient-to-r from-clinical-50 to-white px-7 py-6 sm:px-8">
          <img src={`${import.meta.env.BASE_URL}icons/curatamed-logo.png`} alt="CurataMed" className="mb-5 h-10 w-auto object-contain object-left" />
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-clinical-700"><ShieldCheck className="h-4 w-4" /> Partner workspace</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{activate ? 'Set up your access' : 'Gustav Biomed service desk'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{activate ? 'Create a password to activate your invited vendor account.' : 'Sign in to review requests assigned to Gustav Biomed Limited.'}</p>
        </div>
        <form onSubmit={submit} className="space-y-4 px-7 py-6 sm:px-8">
          {activate ? (
            (!token || token.length < 32 || token.length > 128) ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This invitation link is missing or incomplete. Open the full setup link from the CurataMed administrator or ask for a new link.</div> : <>
              <FormField label="New password" required help="At least 8 characters, including upper/lowercase letters and a number.">
                <input className={inputClass} type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
              </FormField>
              <FormField label="Confirm password" required>
                <input className={inputClass} type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </FormField>
            </>
          ) : <>
            <FormField label="Work email" required>
              <input className={inputClass} type="email" autoComplete="username" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@gustavbiomed.com" />
            </FormField>
            <FormField label="Password" required>
              <input className={inputClass} type="password" autoComplete="current-password" maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </FormField>
          </>}
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          {(activate ? Boolean(token) : true) && <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Please wait…' : activate ? 'Activate account' : 'Sign in'}<ArrowRight className="h-4 w-4" /></Button>}
          {activate ? <button type="button" className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-clinical-700 hover:bg-clinical-50" onClick={() => { window.location.hash = '#/vendor'; }}>Back to sign in</button> : <p className="text-center text-xs leading-5 text-slate-500">Forgot your password? Contact the CurataMed administrator for a new setup link.</p>}
        </form>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-7 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>For partner-work requests only. Do not enter or share patient information.</span><a href="tel:+233595365391" className="font-semibold text-clinical-800 hover:text-clinical-950">Gustav support: +233 59 536 5391</a></div>
      </section>
    </main>
  );
}

export function VendorPortalPage() {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '#/vendor' : window.location.hash || '#/vendor'));
  const [user, setUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('ALL');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [action, setAction] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const activationRoute = hash.startsWith('#/vendor/activate');
  const activationToken = useMemo(() => new URLSearchParams(hash.split('?')[1] || '').get('token') || '', [hash]);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/vendor');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    vendorPortalService.me()
      .then((profile) => { if (!cancelled) setUser(profile); })
      .catch(() => { vendorPortalService.clearSession(); })
      .finally(() => { if (!cancelled) setSessionLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loadRequests = useCallback(async ({ next = false, nextCursor = null } = {}) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await vendorPortalService.listRequests({
        status: status === 'ALL' ? undefined : status,
        type: type || undefined,
        search: search.trim() || undefined,
        cursor: next ? nextCursor : undefined,
        limit: 50
      });
      setRequests((current) => next ? [...current, ...data.items] : data.items);
      setCounts(data.counts || {});
      setCursor(data.nextCursor || null);
      if (!next) setSelectedId((currentId) => data.items.some((item) => item.id === currentId) ? currentId : data.items[0]?.id || '');
    } catch (requestError) {
      setError(requestError?.message || 'Requests could not be loaded.');
      if (!next) setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [user, status, type, search]);

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setTimeout(() => loadRequests({ next: false }), 180);
    return () => window.clearTimeout(timer);
  }, [user, status, type, search, loadRequests]);

  const selected = requests.find((item) => item.id === selectedId) || null;
  const totalCount = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
  const activeCount = Number(counts.PENDING || 0) + Number(counts.ACKNOWLEDGED || 0) + Number(counts.SCHEDULED || 0);

  const submitStatus = async (event) => {
    event.preventDefault();
    if (!action) return;
    const noteRequired = action.status === 'SCHEDULED' || action.status === 'DECLINED';
    if (noteRequired && actionNote.trim().length < 5) return;
    setSaving(true);
    setError('');
    try {
      const updated = await vendorPortalService.updateStatus(action.request.id, {
        status: action.status,
        ...(actionNote.trim() ? { statusNote: actionNote.trim() } : {})
      });
      setRequests((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`${updated.requestCode} is now ${statusMeta(updated.status).label.toLowerCase()}.`);
      setAction(null);
      setActionNote('');
      await loadRequests({ next: false });
    } catch (requestError) {
      setError(requestError?.message || 'The request could not be updated. Refresh and try again.');
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    try { await vendorPortalService.logout(); } catch { vendorPortalService.clearSession(); }
    setUser(null);
    setRequests([]);
    setCounts({});
  };

  if (sessionLoading) return <main className="grid min-h-screen place-items-center bg-slate-50"><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm"><RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none text-clinical-600" />Checking secure vendor access…</div></main>;
  if (!user) return <LoginPanel activate={activationRoute} token={activationToken} onSuccess={(profile) => { setUser(profile); window.location.hash = '#/vendor'; }} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}icons/curatamed-logo.png`} alt="CurataMed" className="hidden h-9 w-auto sm:block" />
            <span className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-950">{user.partner?.name || 'Gustav Biomed Limited'}</p><p className="text-xs text-slate-500">Vendor service desk</p></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="tel:+233595365391" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-clinical-200 bg-clinical-25 px-3 text-xs font-bold text-clinical-800 hover:bg-clinical-50"><Phone className="h-4 w-4" /><span className="hidden sm:inline">+233 59 536 5391</span><span className="sm:hidden">Call Gustav</span></a>
            <span className="hidden max-w-36 truncate text-xs font-medium text-slate-500 md:block">{user.fullName || user.name}</span>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-clinical-700">Partner operations</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Requests from LHIMS facilities</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review supplies and analyzer-service requests routed to Gustav Biomed, then keep each facility updated.</p></div>
              <Button variant="secondary" onClick={() => loadRequests({ next: false })} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /> Refresh queue</Button>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" /><p><strong>Limited partner access.</strong> This workspace shows only requests assigned to Gustav Biomed. Patient records and internal facility notes are not included. Do not add patient information to status updates.</p></div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Request summary">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total requests</p><p className="mt-1 text-2xl font-extrabold text-slate-950">{totalCount}</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Needs action</p><p className="mt-1 text-2xl font-extrabold text-amber-950">{activeCount}</p></div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Scheduled</p><p className="mt-1 text-2xl font-extrabold text-sky-950">{Number(counts.SCHEDULED || 0)}</p></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Completed</p><p className="mt-1 text-2xl font-extrabold text-emerald-950">{Number(counts.COMPLETED || 0)}</p></div>
        </section>

        {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"><span className="flex items-center gap-2"><Check className="h-4 w-4" />{notice}</span><button type="button" className="rounded-lg p-1 hover:bg-emerald-100" aria-label="Dismiss notice" onClick={() => setNotice('')}><X className="h-4 w-4" /></button></div>}
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-lg font-bold text-slate-950">Request queue</h2><p className="mt-0.5 text-xs text-slate-500">Select a request to review its details and available actions.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block min-w-0 sm:w-64"><span className="sr-only">Search requests</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code, facility, item…" /></label>
                <label><span className="sr-only">Filter request type</span><select className={`${inputClass} sm:w-48`} value={type} onChange={(event) => setType(event.target.value)}><option value="">All request types</option><option value="SUPPLY">Medical supplies</option><option value="ANALYZER_MAINTENANCE">Analyzer maintenance</option></select></label>
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by request status">
              {FILTERS.map(([key, label]) => <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(key)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-clinical-200 ${status === key ? 'bg-clinical-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}{key !== 'ALL' && <span className="ml-1.5 opacity-75">{Number(counts[key] || 0)}</span>}</button>)}
            </div>
          </div>

          <div className="grid min-h-[26rem] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="border-b border-slate-100 lg:border-b-0 lg:border-r">
              {loading && requests.length === 0 ? <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading requests…</div> : requests.length === 0 ? <div className="px-6 py-16 text-center"><Activity className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No matching requests</p><p className="mt-1 text-sm text-slate-500">Try another status or search term.</p></div> : <div className="divide-y divide-slate-100">
                {requests.map((request) => <button key={request.id} type="button" onClick={() => setSelectedId(request.id)} aria-pressed={selectedId === request.id} className={`block w-full p-4 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-clinical-200 sm:p-5 ${selectedId === request.id ? 'bg-clinical-25' : 'bg-white'}`}>
                  <div className="flex items-center justify-between gap-3"><span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">{request.requestCode}</span><StatusPill status={request.status} /></div>
                  <div className="mt-3"><RequestSummary request={request} /></div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{request.facility?.name || 'LHIMS facility'}{request.facility?.code ? ` · ${request.facility.code}` : ''}</span><span>{request.requestingUnit}</span><span>{formatDate(request.createdAt)}</span></div>
                </button>)}
              </div>}
              {cursor && <div className="border-t border-slate-100 p-4 text-center"><Button variant="secondary" size="sm" onClick={() => loadRequests({ next: true, nextCursor: cursor })} disabled={loading}>{loading ? 'Loading…' : 'Load more requests'}</Button></div>}
            </div>

            <div className="p-4 sm:p-6">
              {selected ? <article className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-clinical-700">{selected.type === 'SUPPLY' ? 'Supply request' : 'Analyzer service request'}</p><h3 className="mt-1 font-mono text-xl font-extrabold text-slate-950">{selected.requestCode}</h3></div><StatusPill status={selected.status} /></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><RequestSummary request={selected} /></div>
                <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Facility</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{selected.facility?.name || 'LHIMS facility'}{selected.facility?.code ? ` (${selected.facility.code})` : ''}</dd></div>
                  <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Requesting unit</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{selected.requestingUnit}</dd></div>
                  <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Submitted</dt><dd className="mt-1 text-sm text-slate-800">{formatDate(selected.createdAt)}</dd></div>
                  {selected.preferredServiceDate && <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Preferred service date</dt><dd className="mt-1 text-sm text-slate-800">{formatDate(selected.preferredServiceDate)}</dd></div>}
                </dl>
                {selected.vendorStatusNote && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-sky-900">Your latest update</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-sky-950">{selected.vendorStatusNote}</p>{selected.statusUpdatedAt && <p className="mt-2 text-xs text-sky-800">Updated {formatDate(selected.statusUpdatedAt)}</p>}</div>}
                <div className="border-t border-slate-100 pt-4"><p className="mb-3 text-sm font-bold text-slate-900">Update this request</p>{(STATUS_ACTIONS[selected.status] || []).length ? <div className="flex flex-wrap gap-2">{STATUS_ACTIONS[selected.status].map((nextStatus) => <Button key={nextStatus} size="sm" variant={nextStatus === 'DECLINED' ? 'secondary' : nextStatus === 'COMPLETED' ? 'success' : 'primary'} className={nextStatus === 'DECLINED' ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : ''} onClick={() => { setAction({ request: selected, status: nextStatus }); setActionNote(''); }}>{nextStatus === 'COMPLETED' ? <Check className="h-4 w-4" /> : nextStatus === 'SCHEDULED' ? <CalendarClock className="h-4 w-4" /> : nextStatus === 'DECLINED' ? <X className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}{ACTION_LABELS[nextStatus]}</Button>)}</div> : <p className="text-sm text-slate-500">This request is closed; no further status actions are available.</p>}</div>
              </article> : <div className="grid h-full min-h-64 place-items-center text-center"><div><FlaskConical className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Choose a request</p><p className="mt-1 text-sm text-slate-500">Its operational details will appear here.</p></div></div>}
            </div>
          </div>
        </section>
        <footer className="flex flex-col gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Gustav Biomed requests only · Patient records are not available in this workspace.</span><a href="tel:+233595365391" className="inline-flex items-center gap-1.5 font-semibold text-clinical-800 hover:text-clinical-950"><Phone className="h-3.5 w-3.5" /> +233 59 536 5391</a></footer>
      </main>

      <Modal
        open={Boolean(action)}
        title={action ? `${ACTION_LABELS[action.status]}?` : ''}
        description="This update will be visible to the requesting LHIMS facility."
        onClose={() => { if (!saving) setAction(null); }}
        footer={action && <>
          <Button variant="secondary" onClick={() => setAction(null)} disabled={saving}>Cancel</Button>
          <Button type="submit" form="vendor-status-update-form" disabled={saving || ((action.status === 'SCHEDULED' || action.status === 'DECLINED') && actionNote.trim().length < 5)}>
            {saving ? 'Saving…' : ACTION_LABELS[action.status]}<ArrowRight className="h-4 w-4" />
          </Button>
        </>}
      >
        {action && <div className="mb-4 rounded-xl bg-clinical-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-clinical-800">Request {action.request.requestCode}</div>}
        {action && <form id="vendor-status-update-form" onSubmit={submitStatus} className="space-y-4">
          {(action.status === 'SCHEDULED' || action.status === 'DECLINED') && <FormField label={action.status === 'SCHEDULED' ? 'Scheduling details' : 'Reason for declining'} required help={action.status === 'SCHEDULED' ? 'Include the confirmed date/time or next scheduling step.' : 'Give the facility a brief, useful reason.'}>
            <textarea className={inputClass} rows={3} maxLength={1000} value={actionNote} onChange={(event) => setActionNote(event.target.value)} required minLength={5} />
          </FormField>}
          {action.status !== 'SCHEDULED' && action.status !== 'DECLINED' && <FormField label="Update note (optional)">
            <textarea className={inputClass} rows={3} maxLength={1000} value={actionNote} onChange={(event) => setActionNote(event.target.value)} placeholder="Add a short note for the requesting team" />
          </FormField>}
        </form>}
      </Modal>
    </div>
  );
}
