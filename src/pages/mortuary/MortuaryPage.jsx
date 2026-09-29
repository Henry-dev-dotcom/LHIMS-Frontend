import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
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
import { encounterService } from '../../services/encounterService';
import { can, patientName } from '../opd/opdUtils';

// Mortuary module (backend /mortuary).
const mortuary = {
  slots: () => apiClient.request('/mortuary/slots'),
  list: (params) => apiClient.request(`/mortuary/deceased${buildQuery(params)}`),
  get: (id) => apiClient.request(`/mortuary/deceased/${id}`),
  register: (body) => apiClient.request('/mortuary/deceased', { method: 'POST', body }),
  certify: (id, body) => apiClient.request(`/mortuary/deceased/${id}/certify`, { method: 'POST', body }),
  clearance: (id, body) => apiClient.request(`/mortuary/deceased/${id}/police-clearance`, { method: 'POST', body }),
  move: (id, body) => apiClient.request(`/mortuary/deceased/${id}/move`, { method: 'POST', body }),
  release: (id, body) => apiClient.request(`/mortuary/deceased/${id}/release`, { method: 'POST', body })
};

const PLACES = { WARD: 'Ward', EMERGENCY: 'Emergency', THEATRE: 'Theatre', OUTPATIENT: 'Outpatient', BROUGHT_IN_DEAD: 'Brought in dead' };

/** The mortuary: cold-room slots, the deceased register, certification and release. */
export function MortuaryPage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [status, setStatus] = useState('IN_STORAGE');
  const [slots, setSlots] = useState([]);
  const [data, setData] = useState({ status: null, rows: [] });
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState('');
  const [registering, setRegistering] = useState(false);
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);
  const rows = data.status === status ? data.rows : [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([mortuary.slots(), mortuary.list({ status })]);
      setSlots(listItems(s));
      setData({ status, rows: listItems(r) });
    } catch (e) {
      toast('error', e?.message || 'The mortuary could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => { if (!openId) load(); }, [load, openId]);

  if (openId) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => setOpenId('')}><ArrowLeft className="h-4 w-4" /> Back to mortuary</Button>
        <DeceasedDetail id={openId} auth={auth} slots={slots} toast={toast} />
      </div>
    );
  }

  const free = slots.filter((s) => !s.occupant).length;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Mortuary" title="Mortuary" description="Bodies in the facility’s care, their slots and tags, certification of the cause of death, and release to family." />
      <Card title="Cold room" subtitle={`${free} of ${slots.length} slots free`} actions={<Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>}>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {slots.map((s) => (
            <li key={s.id} className={`rounded-2xl border p-3 text-sm ${s.occupant ? 'border-slate-400 bg-slate-100' : 'border-emerald-300 bg-emerald-50'}`}>
              <p className="font-bold">{s.code}</p>
              {s.occupant ? <button type="button" className="mt-1 block w-full truncate text-left text-xs font-semibold underline-offset-2 hover:underline" onClick={() => setOpenId(s.occupant.id)}>{s.occupant.fullName}</button> : <p className="mt-1 text-xs text-emerald-800">Free</p>}
            </li>
          ))}
        </ul>
      </Card>
      <Card
        title="Register"
        subtitle={loading ? 'Loading…' : `${rows.length} ${status === 'IN_STORAGE' ? 'in storage' : 'released'}`}
        actions={(
          <>
            <select aria-label="Show" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="IN_STORAGE">In storage</option>
              <option value="RELEASED">Released</option>
            </select>
            {can(auth, 'mortuary:manage') && <Button onClick={() => setRegistering(true)}><Plus className="h-4 w-4" /> Register a death</Button>}
          </>
        )}
      >
        <DataTable caption="Deceased register" rowBadge={(r) => r.caseCode} rows={rows} emptyMessage={loading ? 'Loading…' : 'Nobody here.'}
          columns={[
            { key: 'name', label: 'Deceased', mobilePrimary: true, render: (r) => <span><span className="font-semibold">{r.fullName}</span><span className="block text-xs text-slate-500">{r.caseCode} · tag {r.bodyTag}{r.patient ? ` · ${r.patient.patientCode}` : ''}</span></span> },
            { key: 'death', label: 'Died', render: (r) => `${formatDateTime(r.dateOfDeath)} · ${PLACES[r.placeOfDeath]}` },
            { key: 'cert', label: 'Certified', render: (r) => (r.causeOfDeath ? 'Yes' : <span className="font-semibold text-amber-700">Awaiting doctor</span>) },
            { key: 'police', label: 'Police', render: (r) => (r.policeCase ? (r.policeClearanceRef ? 'Cleared' : <span className="font-semibold text-red-700">Awaiting clearance</span>) : '—') },
            { key: 'slot', label: status === 'IN_STORAGE' ? 'Slot' : 'Released', render: (r) => (status === 'IN_STORAGE' ? r.slot?.code : `${formatDateTime(r.releasedAt)} to ${r.releasedTo}`) },
            { key: 'actions', label: 'Actions', render: (r) => <Button size="sm" onClick={() => setOpenId(r.id)}>Open</Button> }
          ]} />
      </Card>
      <RegisterModal open={registering} slots={slots.filter((s) => !s.occupant)} onClose={() => setRegistering(false)} onDone={(r) => { setRegistering(false); toast('success', `${r.fullName} registered in slot ${r.slot.code} (${r.caseCode}).`); setOpenId(r.id); }} toast={toast} />
    </div>
  );
}

function RegisterModal({ open, slots, onClose, onDone, toast }) {
  const [known, setKnown] = useState(true);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [f, setF] = useState(null);
  const now = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  useEffect(() => {
    if (!open) return;
    setKnown(true); setSearch(''); setResults([]); setPatient(null);
    setF({ fullName: '', sex: 'Unknown', estimatedAgeYears: '', dateOfDeath: now(), placeOfDeath: 'WARD', slotId: slots[0]?.id || '', bodyTag: '', policeCase: false, policeReference: '', notes: '' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !f) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const find = async (e) => { e.preventDefault(); if (search.trim().length >= 2) setResults(listItems(await encounterService.searchPatients(apiClient, search.trim()))); };
  const ready = f.slotId && f.bodyTag.trim().length >= 2 && (known ? patient : f.fullName.trim()) && (!f.policeCase || f.policeReference.trim());
  const save = () => mortuary.register({
    patientId: known ? patient.id : undefined,
    fullName: known ? undefined : f.fullName.trim(),
    sex: known ? undefined : f.sex,
    estimatedAgeYears: !known && f.estimatedAgeYears ? Number(f.estimatedAgeYears) : undefined,
    dateOfDeath: new Date(f.dateOfDeath).toISOString(),
    placeOfDeath: f.placeOfDeath,
    slotId: f.slotId,
    bodyTag: f.bodyTag.trim(),
    policeCase: f.policeCase,
    policeReference: f.policeCase ? f.policeReference.trim() : undefined,
    notes: f.notes.trim() || undefined
  }).then(onDone).catch((e) => toast('error', e?.message || 'The death could not be registered.'));
  return (
    <Modal open title="Register a death" description="Tag the body before it enters the cold room." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready} onClick={save}>Register</Button></>}>
      <div className="space-y-4">
        <div className="flex gap-4 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="radio" checked={known} onChange={() => setKnown(true)} /> Our patient</label>
          <label className="flex items-center gap-2"><input type="radio" checked={!known} onChange={() => { setKnown(false); setPatient(null); }} /> Not registered / unidentified</label>
        </div>
        {known ? (patient ? (
          <div className="flex items-center justify-between rounded-2xl bg-clinical-50 px-4 py-3"><span className="font-semibold">{patientName(patient)} <span className="text-xs font-normal">{patient.patientCode}</span></span><button type="button" className="text-sm font-semibold text-clinical-700" onClick={() => setPatient(null)}>Change</button></div>
        ) : (
          <>
            <form onSubmit={find} className="flex gap-2"><input aria-label="Search patients" className={inputClass} placeholder="Name or patient number" value={search} onChange={(e) => setSearch(e.target.value)} /><Button type="submit" variant="secondary">Find</Button></form>
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200">{results.map((p) => <li key={p.id}><button type="button" className="w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => setPatient(p)}>{patientName(p)} <span className="text-xs text-slate-500">{p.patientCode}</span></button></li>)}</ul>
          </>
        )) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Name" required help='"Unknown male" if unidentified.' className="sm:col-span-3"><input className={inputClass} value={f.fullName} onChange={set('fullName')} maxLength={160} /></FormField>
            <FormField label="Sex"><select className={inputClass} value={f.sex} onChange={set('sex')}><option>Unknown</option><option>Male</option><option>Female</option></select></FormField>
            <FormField label="Estimated age"><input type="number" min="0" max="130" className={inputClass} value={f.estimatedAgeYears} onChange={set('estimatedAgeYears')} /></FormField>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Date and time of death" required><input type="datetime-local" className={inputClass} value={f.dateOfDeath} onChange={set('dateOfDeath')} /></FormField>
          <FormField label="Place of death"><select className={inputClass} value={f.placeOfDeath} onChange={set('placeOfDeath')}>{Object.entries(PLACES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
          <FormField label="Slot" required><select className={inputClass} value={f.slotId} onChange={set('slotId')}>{slots.length ? slots.map((s) => <option key={s.id} value={s.id}>{s.code}</option>) : <option value="">No free slots</option>}</select></FormField>
          <FormField label="Body tag number" required><input className={`${inputClass} uppercase`} value={f.bodyTag} onChange={set('bodyTag')} maxLength={30} /></FormField>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" className="h-4 w-4" checked={f.policeCase} onChange={(e) => setF((c) => ({ ...c, policeCase: e.target.checked }))} /> Police (coroner’s) case</label>
        {f.policeCase && <FormField label="Police reference" required><input className={inputClass} value={f.policeReference} onChange={set('policeReference')} maxLength={80} /></FormField>}
        <FormField label="Notes"><input className={inputClass} value={f.notes} onChange={set('notes')} maxLength={1000} placeholder="Property, identifying marks…" /></FormField>
      </div>
    </Modal>
  );
}

function DeceasedDetail({ id, auth, slots, toast }) {
  const [r, setR] = useState(null);
  const [modal, setModal] = useState('');
  const load = useCallback(() => mortuary.get(id).then(setR).catch((e) => toast('error', e?.message)), [id, toast]);
  useEffect(() => { load(); }, [load]);
  if (!r) return <Card><p className="text-sm text-slate-500">Loading…</p></Card>;
  const act = (fn, message) => fn().then((updated) => { setR(updated); toast('success', message); setModal(''); }).catch((e) => toast('error', e?.message || 'That did not work.'));
  const stored = r.status === 'IN_STORAGE';
  const manage = can(auth, 'mortuary:manage');
  const releasable = r.causeOfDeath || (r.policeCase && r.policeClearanceRef);
  const blocked = r.policeCase && !r.policeClearanceRef ? 'Waiting for police clearance.' : !r.causeOfDeath && !r.policeCase ? 'Waiting for a doctor to certify the cause of death.' : null;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{r.caseCode} · tag {r.bodyTag} · {stored ? `slot ${r.slot?.code}` : 'released'}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{r.fullName}</h2>
        <p className="mt-1 text-sm text-slate-700">{r.sex}{r.estimatedAgeYears != null ? ` · about ${r.estimatedAgeYears} years` : ''}{r.patient ? ` · ${r.patient.patientCode}` : ''} · died {formatDateTime(r.dateOfDeath)} ({PLACES[r.placeOfDeath]}) · registered by {r.registeredBy?.name} {formatDateTime(r.admittedAt)}</p>
        {r.policeCase && <p className="mt-2 text-sm"><span className="font-semibold">Police case</span> {r.policeReference}{r.policeClearanceRef ? ` · cleared (${r.policeClearanceRef})` : <span className="font-semibold text-red-700"> · not yet cleared</span>}</p>}
        <p className="mt-2 text-sm">{r.causeOfDeath ? <><span className="font-semibold">Cause of death:</span> {r.causeOfDeath}{r.causeIcd10 ? ` (${r.causeIcd10})` : ''} · certified by {r.certifiedBy?.name} {formatDateTime(r.certifiedAt)}</> : <span className="font-semibold text-amber-700">Cause of death not yet certified.</span>}</p>
        {r.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{r.notes}</p>}
        {!stored && <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm">Released {formatDateTime(r.releasedAt)} to {r.releasedTo} ({r.releasedToRelation}, ID {r.releasedToIdNumber}) by {r.releasedBy?.name} after {r.storageDays} day{r.storageDays === 1 ? '' : 's'}.</p>}
        {stored && (
          <div className="mt-3 flex flex-wrap gap-2">
            {can(auth, 'mortuary:certify') && !r.causeOfDeath && <Button onClick={() => setModal('certify')}>Certify cause of death</Button>}
            {manage && r.policeCase && !r.policeClearanceRef && <Button variant="secondary" onClick={() => { const ref = window.prompt('Police clearance reference'); if (ref && ref.trim().length >= 2) act(() => mortuary.clearance(r.id, { clearanceRef: ref.trim() }), 'Police clearance recorded.'); }}>Record police clearance</Button>}
            {manage && <Button variant="secondary" onClick={() => setModal('move')}>Move slot</Button>}
            {manage && <Button variant="success" disabled={!releasable || Boolean(blocked)} onClick={() => setModal('release')}>Release body</Button>}
          </div>
        )}
        {stored && blocked && <p className="mt-2 text-xs font-semibold text-slate-500">{blocked}</p>}
      </Card>
      <CertifyModal open={modal === 'certify'} onClose={() => setModal('')} onSave={(body) => act(() => mortuary.certify(r.id, body), 'Death certified.')} />
      <MoveModal open={modal === 'move'} slots={slots.filter((s) => !s.occupant)} onClose={() => setModal('')} onSave={(slotId) => act(() => mortuary.move(r.id, { slotId }), 'Body moved.')} />
      <ReleaseModal open={modal === 'release'} record={r} onClose={() => setModal('')} onSave={(body) => act(() => mortuary.release(r.id, body), 'Body released.')} />
    </div>
  );
}

function CertifyModal({ open, onClose, onSave }) {
  const [cause, setCause] = useState('');
  const [icd, setIcd] = useState('');
  useEffect(() => { if (open) { setCause(''); setIcd(''); } }, [open]);
  if (!open) return null;
  return (
    <Modal open title="Medical certificate of cause of death" description="Give the underlying cause: the disease or injury that started the train of events." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={cause.trim().length < 3} onClick={() => onSave({ causeOfDeath: cause.trim(), causeIcd10: icd.trim() || undefined })}>Certify</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Cause of death" required className="sm:col-span-2"><input className={inputClass} value={cause} onChange={(e) => setCause(e.target.value)} maxLength={500} /></FormField>
        <FormField label="ICD-10"><input className={`${inputClass} uppercase`} value={icd} onChange={(e) => setIcd(e.target.value)} maxLength={12} /></FormField>
      </div>
    </Modal>
  );
}

function MoveModal({ open, slots, onClose, onSave }) {
  const [slotId, setSlotId] = useState('');
  useEffect(() => { if (open) setSlotId(slots[0]?.id || ''); }, [open, slots]);
  if (!open) return null;
  return (
    <Modal open title="Move to another slot" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!slotId} onClick={() => onSave(slotId)}>Move</Button></>}>
      <FormField label="Free slot"><select className={inputClass} value={slotId} onChange={(e) => setSlotId(e.target.value)}>{slots.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></FormField>
    </Modal>
  );
}

function ReleaseModal({ open, record, onClose, onSave }) {
  const [f, setF] = useState({ releasedTo: '', relationship: '', idNumber: '', notes: '' });
  useEffect(() => { if (open) setF({ releasedTo: '', relationship: '', idNumber: '', notes: '' }); }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  return (
    <Modal open title={`Release ${record.fullName}`} description="Check the body tag against the register and the collector’s ID before release. Storage days are charged to the patient’s account." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="success" disabled={f.releasedTo.trim().length < 3 || f.relationship.trim().length < 2 || f.idNumber.trim().length < 4} onClick={() => onSave({ releasedTo: f.releasedTo.trim(), relationship: f.relationship.trim(), idNumber: f.idNumber.trim(), notes: f.notes.trim() || undefined })}>Release</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Collected by" required><input className={inputClass} value={f.releasedTo} onChange={set('releasedTo')} maxLength={160} /></FormField>
        <FormField label="Relationship" required><input className={inputClass} value={f.relationship} onChange={set('relationship')} maxLength={60} placeholder="Son, wife, undertaker…" /></FormField>
        <FormField label="ID (Ghana Card) number" required><input className={inputClass} value={f.idNumber} onChange={set('idNumber')} maxLength={40} /></FormField>
        <FormField label="Notes"><input className={inputClass} value={f.notes} onChange={set('notes')} maxLength={1000} placeholder="Property handed over…" /></FormField>
      </div>
    </Modal>
  );
}
