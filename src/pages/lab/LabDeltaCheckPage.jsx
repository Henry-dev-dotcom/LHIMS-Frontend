import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, GitCompareArrows, Plus, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { deltaCheckService } from '../../services/deltaCheckService';
import { patientService } from '../../services/patientService';
import { patientName } from '../opd/opdUtils';

/*
  Delta check across facilities.

  The laboratory asks another facility for a patient's earlier results of named
  tests, to see whether today's value has moved further than it should. Nothing
  is shared until a person at the other laboratory approves, and what is shared
  is a snapshot of values, not the record: no name, clinician or order. The other
  facility is told only the patient's age, sex and (masked) ID.
*/

const STATUS = {
  PENDING: ['Waiting', 'bg-amber-100 text-amber-900'],
  APPROVED: ['Shared', 'bg-emerald-100 text-emerald-900'],
  DECLINED: ['Declined', 'bg-red-100 text-red-800'],
  NO_MATCH: ['No matching patient', 'bg-slate-200 text-slate-700'],
  CANCELLED: ['Withdrawn', 'bg-slate-200 text-slate-500'],
  EXPIRED: ['Lapsed', 'bg-slate-200 text-slate-500']
};

function Pill({ status }) {
  const [label, className] = STATUS[status] || [status, 'bg-slate-100 text-slate-700'];
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${className}`}>{label}</span>;
}

function NewRequestModal({ open, partners, onClose, onSend }) {
  const [ownerFacilityId, setOwner] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [patient, setPatient] = useState(null);
  const [parameters, setParameters] = useState('');
  const [lookbackDays, setLookback] = useState('365');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setOwner(partners[0]?.id || ''); setQuery(''); setMatches([]); setPatient(null); setParameters(''); setLookback('365'); setReason(''); }
  }, [open, partners]);

  useEffect(() => {
    if (!open || patient || query.trim().length < 2) { setMatches([]); return undefined; }
    const timer = window.setTimeout(() => {
      patientService.list(apiClient, { search: query.trim(), limit: 8 }).then((result) => setMatches(listItems(result))).catch(() => setMatches([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query, patient]);

  if (!open) return null;
  const ready = ownerFacilityId && patient && reason.trim().length >= 5;
  const send = async () => {
    setBusy(true);
    await onSend({
      ownerFacilityId, patientId: patient.id, reason: reason.trim(), lookbackDays: Number(lookbackDays) || 365,
      parameters: parameters.split(',').map((p) => p.trim()).filter(Boolean)
    });
    setBusy(false);
  };

  return (
    <Modal open title="Ask another facility" description="They are told only the patient’s age, sex and a masked ID, and choose whether to share." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready || busy} onClick={send}>{busy ? 'Sending…' : 'Send request'}</Button></>}>
      <div className="space-y-4">
        <FormField label="Facility to ask" required>
          <select className={inputClass} value={ownerFacilityId} onChange={(e) => setOwner(e.target.value)}>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>
        <FormField label="Patient" required help="Found by national ID, so it must be on the patient’s record.">
          {patient ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
              <span><span className="font-semibold">{patientName(patient)}</span> <span className="text-slate-500">{patient.patientCode}</span></span>
              <Button size="sm" variant="secondary" onClick={() => { setPatient(null); setQuery(''); }}>Change</Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or patient code" />
              </div>
              {matches.length > 0 && (
                <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {matches.map((p) => (
                    <li key={p.id}><button type="button" onClick={() => setPatient(p)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="font-semibold">{patientName(p)}</span> <span className="text-slate-500">{p.patientCode}</span></button></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </FormField>
        <FormField label="Tests to compare" help="Separate with commas, e.g. Haemoglobin, Creatinine. Leave empty to ask for everything in the period.">
          <input className={inputClass} value={parameters} onChange={(e) => setParameters(e.target.value)} maxLength={400} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Look back (days)"><input type="number" min="7" max="1825" className={inputClass} value={lookbackDays} onChange={(e) => setLookback(e.target.value)} /></FormField>
          <FormField label="Why is the comparison needed?" required><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></FormField>
        </div>
      </div>
    </Modal>
  );
}

function Comparison({ id, onBack, toast }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    deltaCheckService.comparison(apiClient, id).then(setData).catch((e) => { toast('error', e?.message || 'The comparison could not be loaded.'); onBack(); });
  }, [id, onBack, toast]);
  if (!data) return <Card><p className="text-sm text-slate-500">Loading comparison…</p></Card>;
  const { request, comparisons, thresholdPercent } = data;
  return (
    <div className="space-y-4">
      <Button variant="secondary" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back to requests</Button>
      <Card title={`Earlier results from ${request.ownerName}`} subtitle={`${request.patientSummary} · shared ${formatDateTime(request.respondedAt)} · viewable until ${formatDateTime(request.expiresAt)}`}>
        <p className="mb-3 text-xs text-slate-500">A change of {thresholdPercent}% or more from the latest shared value is flagged. This is a prompt for a second look, not a diagnosis.</p>
        {comparisons.length === 0 && <p className="text-sm text-slate-500">The other facility holds no signed-off values for these tests in the period.</p>}
        <div className="space-y-3">
          {comparisons.map((c) => (
            <section key={c.parameter} aria-label={c.parameter} className={`rounded-2xl border p-3 ${c.significant ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900">{c.parameter}</h4>
                {c.changePercent !== null && <span className={`text-sm font-bold ${c.significant ? 'text-red-700' : 'text-slate-700'}`}>{c.changePercent > 0 ? '+' : ''}{c.changePercent}% {c.significant ? '· check' : ''}</span>}
              </div>
              <p className="mt-1 text-sm text-slate-800"><span className="font-semibold">Here:</span> {c.current ? `${c.current.value ?? '—'} ${c.current.unit || ''}${c.current.date ? ` (${c.current.date})` : ''}` : 'no signed-off result in this facility yet'}</p>
              <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                {c.prior.map((p, i) => <li key={i}><span className="font-semibold">Elsewhere:</span> {p.value ?? '—'} {p.unit || ''} <span className="text-slate-500">· {p.date}{p.flag && p.flag !== 'NORMAL' && p.flag !== 'PENDING' ? ` · ${p.flag}` : ''}{p.referenceRange ? ` · ref ${p.referenceRange}` : ''}</span></li>)}
              </ul>
              {c.note && <p className="mt-1 text-xs text-slate-500">{c.note}</p>}
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function LabDeltaCheckPage() {
  const { dispatch } = useAppStore();
  const [tab, setTab] = useState('mine');
  const [partnerInfo, setPartnerInfo] = useState({ optedIn: true, partners: [] });
  const [mine, setMine] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState('');
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [partners, outgoing, incoming] = await Promise.all([
        deltaCheckService.partners(apiClient), deltaCheckService.requests(apiClient), deltaCheckService.inbox(apiClient)
      ]);
      setPartnerInfo(partners);
      setMine(listItems(outgoing));
      setInbox(listItems(incoming));
    } catch (e) {
      toast('error', e?.message || 'Delta check could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, success) => {
    try { await fn(); toast('success', success); await load(); return true; } catch (e) { toast('error', e?.message || 'That did not work.'); return false; }
  };

  if (openId) return <Comparison id={openId} onBack={() => setOpenId('')} toast={toast} />;

  const waiting = inbox.filter((r) => r.status === 'PENDING').length;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Laboratory" title="Delta check" description="Compare today’s results with a patient’s earlier results at other facilities, with that facility’s consent, to catch changes that need a second look." />
      {!partnerInfo.optedIn && (
        <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Your facility has not joined delta check sharing, so it can neither ask nor be asked. An administrator can switch it on in Facility Setup.</p>
      )}
      <Card
        title="Requests"
        subtitle={loading ? 'Loading…' : `${mine.length} sent · ${waiting} waiting for your answer`}
        actions={(
          <>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button onClick={() => setAdding(true)} disabled={!partnerInfo.optedIn || partnerInfo.partners.length === 0}><Plus className="h-4 w-4" /> New request</Button>
          </>
        )}
      >
        {partnerInfo.optedIn && partnerInfo.partners.length === 0 && <p className="mb-3 text-sm text-slate-500">No other facility has joined yet, so there is nobody to ask.</p>}
        <div role="tablist" aria-label="Delta check" className="mb-4 flex gap-2">
          {[['mine', 'Sent by us'], ['inbox', `To answer${waiting ? ` (${waiting})` : ''}`]].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
          ))}
        </div>

        {tab === 'mine' && (
          <ul className="divide-y divide-slate-100">
            {mine.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.ownerName} <span className="font-normal text-slate-500">· {r.patientSummary}</span></p>
                  <p className="text-xs text-slate-500">{r.parameters.length ? r.parameters.join(', ') : 'All tests'} · {formatDateTime(r.createdAt)} · {r.reason}</p>
                  {r.responseNote && <p className="text-xs text-slate-600">Reply: {r.responseNote}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Pill status={r.status} />
                  {r.status === 'APPROVED' && !r.viewExpired && <Button size="sm" onClick={() => setOpenId(r.id)}><GitCompareArrows className="h-3.5 w-3.5" /> Compare ({r.sharedCount})</Button>}
                  {r.status === 'APPROVED' && r.viewExpired && <span className="text-xs text-slate-500">Sharing window ended</span>}
                  {r.status === 'PENDING' && <Button size="sm" variant="secondary" onClick={() => run(() => deltaCheckService.cancel(apiClient, r.id), 'Request withdrawn.')}>Withdraw</Button>}
                </div>
              </li>
            ))}
            {!loading && mine.length === 0 && <li className="py-6 text-sm text-slate-500">You have not asked any facility yet.</li>}
          </ul>
        )}

        {tab === 'inbox' && (
          <ul className="divide-y divide-slate-100">
            {inbox.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{r.requesterName} <span className="font-normal text-slate-500">asks about a {r.patientSummary} · ID {r.maskedId}</span></p>
                    <p className="text-xs text-slate-500">{r.parameters.length ? r.parameters.join(', ') : 'All tests'} · last {r.lookbackDays} days · {formatDateTime(r.createdAt)} · by {r.requestedBy}</p>
                    <p className="text-xs text-slate-700">Reason: {r.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill status={r.status} />
                    {r.status === 'PENDING' && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => { const note = window.prompt('Reason for declining (optional)') ; if (note !== null) run(() => deltaCheckService.respond(apiClient, r.id, { decision: 'DECLINE', note: note.trim() || undefined }), 'Request declined.'); }}>Decline</Button>
                        <Button size="sm" onClick={() => { if (window.confirm(`Share this patient’s earlier values (${r.parameters.length ? r.parameters.join(', ') : 'all tests'}, last ${r.lookbackDays} days) with ${r.requesterName}? Only values, units, flags and dates are shared: no name, clinician or order.`)) run(() => deltaCheckService.respond(apiClient, r.id, { decision: 'APPROVE' }), 'Request answered.'); }}>Approve and share</Button>
                      </>
                    )}
                    {r.status === 'APPROVED' && <span className="text-xs text-slate-500">{r.sharedCount} value{r.sharedCount === 1 ? '' : 's'} shared</span>}
                  </div>
                </div>
              </li>
            ))}
            {!loading && inbox.length === 0 && <li className="py-6 text-sm text-slate-500">No requests have been sent to you.</li>}
          </ul>
        )}
      </Card>
      <NewRequestModal open={adding} partners={partnerInfo.partners} onClose={() => setAdding(false)}
        onSend={async (payload) => { if (await run(() => deltaCheckService.create(apiClient, payload), 'Request sent.')) setAdding(false); }} />
    </div>
  );
}
