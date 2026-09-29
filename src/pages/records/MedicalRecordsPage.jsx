import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Eye, Plus, RefreshCw, Search } from 'lucide-react';
import { buildQuery } from '../../api/apiClient';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { ageLabel, can, patientName } from '../opd/opdUtils';

// Medical Records module (backend /records).
const records = {
  search: (search) => apiClient.request(`/records/patients${buildQuery({ search })}`),
  chart: (patientId, purpose, note) => apiClient.request(`/records/patients/${patientId}/chart${buildQuery({ purpose, note })}`),
  accessLog: (patientId) => apiClient.request(`/records/patients/${patientId}/access-log`),
  requests: (params) => apiClient.request(`/records/requests${buildQuery(params)}`),
  logRequest: (body) => apiClient.request('/records/requests', { method: 'POST', body }),
  decide: (id, body) => apiClient.request(`/records/requests/${id}/decision`, { method: 'POST', body }),
  release: (id, body) => apiClient.request(`/records/requests/${id}/release`, { method: 'POST', body })
};

const PURPOSES = { TREATMENT: 'Treatment', BILLING: 'Billing or claims', CLINICAL_AUDIT: 'Clinical audit', RECORDS_RELEASE: 'Preparing a records release', OTHER: 'Other' };
const REQUESTERS = { PATIENT: 'The patient', NEXT_OF_KIN: 'Next of kin', INSURER: 'Insurer', COURT_OR_POLICE: 'Court or police', OTHER_FACILITY: 'Another facility', EMPLOYER: 'Employer', OTHER: 'Other' };
const STATUS = { PENDING: 'bg-amber-100 text-amber-900', APPROVED: 'bg-sky-100 text-sky-900', RELEASED: 'bg-emerald-100 text-emerald-900', REFUSED: 'bg-red-100 text-red-800' };
const day = (v) => (v ? new Date(v).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function MedicalRecordsPage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);
  const tabs = [can(auth, 'records:chart:read') && ['chart', 'Patient chart'], can(auth, 'records:release') && ['requests', 'Release requests']].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.[0] || 'chart');
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Medical records" title="Medical records" description="The whole patient record in one place. Every chart you open is logged with its purpose; records leave the facility only through an approved release request." />
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Medical records" className="flex flex-wrap gap-2">
          {tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>)}
        </div>
      )}
      {tab === 'chart' ? <ChartView auth={auth} toast={toast} /> : <RequestsView auth={auth} toast={toast} />}
    </div>
  );
}

function PatientFinder({ onPick }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const find = async (e) => {
    e.preventDefault();
    if (search.trim().length < 2) return;
    try {
      const found = listItems(await records.search(search.trim()));
      setResults(found);
      setError(found.length ? '' : 'No patient matches that search.');
    } catch (err) {
      setError(err?.message || 'The search failed.');
    }
  };
  return (
    <div className="space-y-2">
      <form onSubmit={find} className="flex gap-2"><input aria-label="Search patients" className={inputClass} placeholder="Name, patient number or phone" value={search} onChange={(e) => setSearch(e.target.value)} /><Button type="submit" variant="secondary"><Search className="h-4 w-4" /> Find</Button></form>
      {error && <p role="alert" className="text-sm font-semibold text-slate-600">{error}</p>}
      {results.length > 0 && <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200">{results.map((p) => <li key={p.id}><button type="button" className="w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => { onPick(p); setResults([]); }}><span className="font-semibold">{patientName(p)}</span> <span className="text-xs text-slate-500">{p.patientCode}</span></button></li>)}</ul>}
    </div>
  );
}

function ChartView({ auth, toast }) {
  const [patient, setPatient] = useState(null);
  const [purpose, setPurpose] = useState('TREATMENT');
  const [note, setNote] = useState('');
  const [chart, setChart] = useState(null);
  const [log, setLog] = useState(null);
  const open = () => records.chart(patient.id, purpose, note.trim() || undefined).then((c) => { setChart(c); setLog(null); }).catch((e) => toast('error', e?.message || 'The chart could not be opened.'));
  return (
    <div className="space-y-4">
      <Card title="Open a chart" subtitle="Choose the patient and why you are opening the record.">
        {!patient ? <PatientFinder onPick={(p) => { setPatient(p); setChart(null); }} /> : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-clinical-50 px-4 py-3"><span className="font-semibold">{patientName(patient)} <span className="text-xs font-normal">{patient.patientCode}</span></span><button type="button" className="text-sm font-semibold text-clinical-700" onClick={() => { setPatient(null); setChart(null); }}>Change</button></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Purpose" required><select className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)}>{Object.entries(PURPOSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
              <FormField label="Note" className="sm:col-span-2"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Optional, e.g. claim CLM-2026-0004" /></FormField>
            </div>
            <div className="flex gap-2">
              <Button onClick={open}><Eye className="h-4 w-4" /> Open chart</Button>
              {can(auth, 'records:audit') && <Button variant="secondary" onClick={() => records.accessLog(patient.id).then((d) => setLog(listItems(d))).catch((e) => toast('error', e?.message))}>Who has opened this record?</Button>}
            </div>
          </div>
        )}
      </Card>
      {log && (
        <Card title="Access log" subtitle={`${log.length} opening${log.length === 1 ? '' : 's'}`}>
          <ul className="space-y-1 text-sm">{log.map((a) => <li key={a.id}>{formatDateTime(a.accessedAt)} · <span className="font-semibold">{a.user?.name || 'Unknown'}</span> ({a.user?.role?.toLowerCase().replace(/_/g, ' ')}) · {PURPOSES[a.purpose]}{a.note ? ` · ${a.note}` : ''}</li>)}</ul>
        </Card>
      )}
      {chart && <Chart chart={chart} />}
    </div>
  );
}

function Section({ title, empty, children, count }) {
  return <Card title={title} subtitle={count !== undefined ? String(count) : undefined}>{count === 0 ? <p className="text-sm text-slate-500">{empty}</p> : children}</Card>;
}

function Chart({ chart }) {
  const p = chart.patient;
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{p.patientCode} · registered {day(p.createdAt)}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{p.firstName} {p.lastName}</h2>
        <p className="mt-1 text-sm text-slate-700">{[ageLabel(p.dateOfBirth), p.gender, p.phone, p.address, p.nationalId && `ID ${p.nationalId}`, p.insuranceProvider && `${p.insuranceProvider} ${p.policyNumber || ''}`].filter(Boolean).join(' · ')}</p>
        {p.emergencyContact && <p className="mt-1 text-sm text-slate-600">Emergency contact: {p.emergencyContact}</p>}
        {p.mother && <p className="mt-1 text-sm text-slate-600">Born here {day(p.bornHereAt)} to {p.mother.firstName} {p.mother.lastName} ({p.mother.patientCode})</p>}
        {p.deceasedRecord && <p className="mt-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Died {day(p.deceasedRecord.dateOfDeath)} ({p.deceasedRecord.caseCode}){p.deceasedRecord.causeOfDeath ? `: ${p.deceasedRecord.causeOfDeath}` : ''}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {p.allergies.length ? p.allergies.map((a) => <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white"><AlertTriangle className="h-3.5 w-3.5" /> {a.substance}{a.reaction ? ` (${a.reaction})` : ''}</span>) : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">No known allergies</span>}
          {chart.problems.map((d) => <span key={d.id} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{d.code ? `${d.code} ` : ''}{d.description}</span>)}
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Visits" count={chart.encounters.length} empty="No visits.">
          <ul className="space-y-2 text-sm">{chart.encounters.map((e) => <li key={e.id} className="rounded-2xl bg-slate-50 px-3 py-2"><span className="font-semibold">{day(e.startedAt)} · {e.encounterCode}</span> · {e.type.toLowerCase()}{e.clinic && e.clinic !== 'GENERAL' ? ` (${e.clinic.toLowerCase().replace(/_/g, ' ')})` : ''} · {e.status.toLowerCase().replace(/_/g, ' ')}{e.outcome ? ` · ${e.outcome.toLowerCase().replace(/_/g, ' ')}` : ''}<span className="block text-xs text-slate-600">{[e.chiefComplaint, e.diagnoses.map((d) => `${d.code ? `${d.code} ` : ''}${d.description}`).join('; '), e.attending?.name].filter(Boolean).join(' · ')}</span></li>)}</ul>
        </Section>
        <Section title="Admissions" count={chart.admissions.length} empty="Never admitted.">
          <ul className="space-y-1 text-sm">{chart.admissions.map((a) => <li key={a.id}><span className="font-semibold">{a.admissionCode}</span> · {a.ward.name} · {day(a.admittedAt)} to {a.dischargedAt ? day(a.dischargedAt) : 'now'} · {a.reason}{a.dischargeOutcome ? ` · ${a.dischargeOutcome.toLowerCase().replace(/_/g, ' ')}` : ''}</li>)}</ul>
        </Section>
        <Section title="Operations" count={chart.surgeries.length} empty="No operations.">
          <ul className="space-y-1 text-sm">{chart.surgeries.map((s) => <li key={s.id}><span className="font-semibold">{s.procedureName}</span> · {day(s.scheduledStart)} · {s.status.toLowerCase().replace(/_/g, ' ')}{s.surgeon ? ` · ${s.surgeon.name}` : ''}</li>)}</ul>
        </Section>
        <Section title="Pregnancies" count={chart.pregnancies.length} empty="No pregnancies recorded.">
          <ul className="space-y-1 text-sm">{chart.pregnancies.map((g) => <li key={g.id}><span className="font-semibold">{g.pregnancyCode}</span> · G{g.gravida} P{g.parity} · booked {day(g.bookedAt)} · {g.delivery ? `delivered ${day(g.delivery.deliveredAt)} (${g.delivery.mode.toLowerCase()})` : g.status === 'ENDED' ? `ended: ${g.endReason?.toLowerCase().replace(/_/g, ' ')}` : `due ${day(g.eddByScan || g.eddByLmp)}`}</li>)}</ul>
        </Section>
        <Section title="Immunisations" count={chart.immunizations.length} empty="None recorded.">
          <p className="text-sm">{chart.immunizations.map((i) => `${i.vaccine} ${day(i.givenAt)}${i.givenElsewhere ? ' (card)' : ''}`).join(' · ')}</p>
        </Section>
        <Section title="Prescriptions" count={chart.prescriptions.length} empty="No prescriptions.">
          <ul className="space-y-1 text-sm">{chart.prescriptions.map((r) => <li key={r.id}><span className="font-semibold">{day(r.createdAt)}</span> · {r.items.map((i) => `${i.drugName}${i.strength ? ` ${i.strength}` : ''} ${i.dose} ${i.frequency}`).join('; ')} · {r.status.toLowerCase().replace(/_/g, ' ')}</li>)}</ul>
        </Section>
        <Section title="Tests and scans" count={chart.orders.length} empty="No investigations.">
          <ul className="space-y-1 text-sm">{chart.orders.map((o) => <li key={o.id}><span className="font-semibold">{o.orderCode}</span> · {day(o.submittedAt)} · {o.items.map((i) => i.catalogItem.name).join(', ')} · {String(o.status).toLowerCase().replace(/_/g, ' ')}</li>)}</ul>
        </Section>
      </div>
    </div>
  );
}

function RequestsView({ auth, toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(listItems(await records.requests())); } catch (e) { toast('error', e?.message); } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const act = (fn, message) => fn().then(() => { toast('success', message); load(); }).catch((e) => toast('error', e?.message || 'That did not work.'));
  const decide = (r, decision) => {
    const note = window.prompt(decision === 'REFUSE' ? 'Why is this request refused?' : r.requesterType === 'COURT_OR_POLICE' && !r.consentReference ? 'Court order or police reference:' : 'Approve. Note (optional):');
    if (note === null) return;
    if (decision === 'REFUSE' && !note.trim()) return;
    const court = decision === 'APPROVE' && r.requesterType === 'COURT_OR_POLICE' && !r.consentReference;
    act(() => records.decide(r.id, { decision, note: court ? undefined : note.trim() || undefined, consentReference: court ? note.trim() || undefined : undefined }), decision === 'APPROVE' ? 'Request approved.' : 'Request refused.');
  };
  return (
    <Card title="Release-of-information requests" subtitle={loading ? 'Loading…' : `${rows.length}`} actions={<><Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button><Button onClick={() => setLogging(true)}><Plus className="h-4 w-4" /> Log a request</Button></>}>
      <DataTable caption="Record requests" rowBadge={(r) => r.requestCode} rows={rows} emptyMessage={loading ? 'Loading…' : 'No requests.'}
        columns={[
          { key: 'patient', label: 'Patient', mobilePrimary: true, render: (r) => <span><span className="font-semibold">{patientName(r.patient)}</span><span className="block text-xs text-slate-500">{r.patient.patientCode}</span></span> },
          { key: 'who', label: 'Requested by', render: (r) => <span>{r.requesterName}<span className="block text-xs text-slate-500">{REQUESTERS[r.requesterType]} · {r.purpose}</span></span> },
          { key: 'scope', label: 'Records', render: (r) => r.scope },
          { key: 'consent', label: 'Consent', render: (r) => (r.consentObtained ? `Yes${r.consentReference ? ` (${r.consentReference})` : ''}` : r.consentReference ? r.consentReference : <span className="font-semibold text-red-700">None</span>) },
          { key: 'status', label: 'Status', render: (r) => <span><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${STATUS[r.status]}`}>{r.status.toLowerCase()}</span>{r.decisionNote && <span className="block text-xs text-slate-500">{r.decisionNote}</span>}</span> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex flex-wrap gap-1">
              {r.status === 'PENDING' && can(auth, 'records:approve') && <><Button size="sm" onClick={() => decide(r, 'APPROVE')}>Approve</Button><Button size="sm" variant="secondary" onClick={() => decide(r, 'REFUSE')}>Refuse</Button></>}
              {r.status === 'APPROVED' && <Button size="sm" variant="success" onClick={() => { const m = window.prompt('How are the records being released?', 'Sealed printout collected in person'); if (m && m.trim().length >= 2) act(() => records.release(r.id, { method: m.trim() }), 'Release recorded.'); }}>Record release</Button>}
            </div>
          ) }
        ]} />
      <LogRequestModal open={logging} onClose={() => setLogging(false)} onDone={() => { setLogging(false); toast('success', 'Request logged; it now needs approval.'); load(); }} toast={toast} />
    </Card>
  );
}

function LogRequestModal({ open, onClose, onDone, toast }) {
  const [patient, setPatient] = useState(null);
  const [f, setF] = useState(null);
  useEffect(() => { if (open) { setPatient(null); setF({ requesterName: '', requesterType: 'PATIENT', purpose: '', scope: '', consentObtained: false, consentReference: '' }); } }, [open]);
  if (!open || !f) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const save = () => records.logRequest({ patientId: patient.id, requesterName: f.requesterName.trim(), requesterType: f.requesterType, purpose: f.purpose.trim(), scope: f.scope.trim(), consentObtained: f.consentObtained, consentReference: f.consentReference.trim() || undefined }).then(onDone).catch((e) => toast('error', e?.message));
  return (
    <Modal open title="Log a records request" description="A second person approves it before anything is released." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!patient || f.requesterName.trim().length < 2 || f.purpose.trim().length < 3 || f.scope.trim().length < 3} onClick={save}>Log request</Button></>}>
      <div className="space-y-3">
        {patient ? <div className="flex items-center justify-between rounded-2xl bg-clinical-50 px-4 py-3"><span className="font-semibold">{patientName(patient)} <span className="text-xs font-normal">{patient.patientCode}</span></span><button type="button" className="text-sm font-semibold text-clinical-700" onClick={() => setPatient(null)}>Change</button></div> : <PatientFinder onPick={setPatient} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Requested by" required><input className={inputClass} value={f.requesterName} onChange={set('requesterName')} maxLength={160} /></FormField>
          <FormField label="Who they are"><select className={inputClass} value={f.requesterType} onChange={set('requesterType')}>{Object.entries(REQUESTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
          <FormField label="Purpose" required><input className={inputClass} value={f.purpose} onChange={set('purpose')} maxLength={500} /></FormField>
          <FormField label="Records wanted" required><input className={inputClass} value={f.scope} onChange={set('scope')} maxLength={500} placeholder="e.g. Discharge summary, March 2026" /></FormField>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" className="h-4 w-4" checked={f.consentObtained} onChange={(e) => setF((c) => ({ ...c, consentObtained: e.target.checked }))} /> Signed consent from the patient (or their legal representative) seen</label>
        <FormField label={f.requesterType === 'COURT_OR_POLICE' ? 'Court order or police reference' : 'Consent form or ID reference'}><input className={inputClass} value={f.consentReference} onChange={set('consentReference')} maxLength={120} /></FormField>
      </div>
    </Modal>
  );
}
