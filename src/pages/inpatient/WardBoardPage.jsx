import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRightLeft, BedDouble, CheckCircle2, LogOut, Plus, RefreshCw, Sparkles, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { inpatientService } from '../../services/inpatientService';
import { encounterService } from '../../services/encounterService';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { EncounterWorkspace } from '../opd/EncounterWorkspace';
import { ageLabel, can, patientName } from '../opd/opdUtils';
import { BedPicker } from './BedPicker';

const IP = {
  ADMIT: 'inpatient:admit',
  TRANSFER: 'inpatient:transfer',
  DISCHARGE: 'inpatient:discharge',
  ADMINISTER: 'inpatient:administer',
  BED_STATUS: 'inpatient:beds:status',
  WARDS: 'inpatient:wards:manage'
};

const BED_STYLE = {
  AVAILABLE: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  OCCUPIED: 'border-clinical-300 bg-clinical-50 text-slate-900',
  CLEANING: 'border-amber-300 bg-amber-50 text-amber-900',
  OUT_OF_SERVICE: 'border-slate-300 bg-slate-100 text-slate-500'
};
const BED_LABEL = { AVAILABLE: 'Free', OCCUPIED: 'Occupied', CLEANING: 'Being cleaned', OUT_OF_SERVICE: 'Out of service' };

export function WardBoardPage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdmission, setOpenAdmission] = useState('');
  const [admitBed, setAdmitBed] = useState(null);
  const [wardModal, setWardModal] = useState(false);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWards(listItems(await inpatientService.wards(apiClient)));
    } catch (error) {
      toast('error', error?.message || 'Wards could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!openAdmission) load();
  }, [load, openAdmission]);

  async function markBed(bed, status) {
    try {
      setWards(listItems(await inpatientService.setBedStatus(apiClient, bed.id, status)));
      toast('success', `Bed ${bed.label}: ${BED_LABEL[status].toLowerCase()}.`);
    } catch (error) {
      toast('error', error?.message || 'The bed could not be updated.');
    }
  }

  if (openAdmission) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => setOpenAdmission('')}><ArrowLeft className="h-4 w-4" /> Back to wards</Button>
        <AdmissionView admissionId={openAdmission} auth={auth} toast={toast} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Wards" title="Ward board" description="Every bed at a glance. Open an occupied bed for the patient's stay." />
      <Card
        title="Wards"
        subtitle={loading ? 'Loading…' : `${wards.reduce((n, w) => n + w.occupancy.occupied, 0)} of ${wards.reduce((n, w) => n + w.occupancy.total, 0)} beds occupied`}
        actions={(
          <>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            {can(auth, IP.WARDS) && <Button onClick={() => setWardModal(true)}><Plus className="h-4 w-4" /> New ward</Button>}
          </>
        )}
      >
        {!loading && wards.length === 0 && <p className="text-sm text-slate-500">No wards yet.{can(auth, IP.WARDS) ? ' Create the first one.' : ''}</p>}
        <div className="space-y-6">
          {wards.map((ward) => (
            <section key={ward.id} aria-label={ward.name}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900">{ward.name} {!ward.isActive && <span className="text-sm font-normal text-slate-500">(closed)</span>}</h3>
                <p className="text-xs text-slate-500">{ward.gender === 'MIXED' ? 'Mixed' : ward.gender === 'MALE' ? 'Male' : 'Female'} · {ward.occupancy.occupied}/{ward.occupancy.total} occupied · {Number(ward.dailyRate).toFixed(2)} per night</p>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {ward.beds.map((bed) => (
                  <li key={bed.id} className={`rounded-2xl border p-3 text-sm ${BED_STYLE[bed.status]}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold"><BedDouble className="h-4 w-4" aria-hidden="true" /> {bed.label}</span>
                      <span className="text-[11px] font-semibold uppercase">{BED_LABEL[bed.status]}</span>
                    </div>
                    {bed.admission ? (
                      <button type="button" className="mt-2 block w-full text-left" onClick={() => setOpenAdmission(bed.admission.id)}>
                        <span className="block truncate font-semibold underline-offset-2 hover:underline">{patientName(bed.admission.patient)}</span>
                        <span className="block truncate text-xs text-slate-600">{bed.admission.reason}</span>
                      </button>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {bed.status === 'AVAILABLE' && ward.isActive && can(auth, IP.ADMIT) && (
                          <Button size="sm" variant="secondary" onClick={() => setAdmitBed({ ward, bed })}><UserPlus className="h-3.5 w-3.5" /> Admit</Button>
                        )}
                        {bed.status === 'CLEANING' && can(auth, IP.BED_STATUS) && (
                          <Button size="sm" variant="secondary" onClick={() => markBed(bed, 'AVAILABLE')}><Sparkles className="h-3.5 w-3.5" /> Ready</Button>
                        )}
                        {bed.status === 'OUT_OF_SERVICE' && can(auth, IP.BED_STATUS) && (
                          <Button size="sm" variant="ghost" onClick={() => markBed(bed, 'AVAILABLE')}>Return to service</Button>
                        )}
                        {bed.status === 'AVAILABLE' && can(auth, IP.BED_STATUS) && (
                          <Button size="sm" variant="ghost" onClick={() => markBed(bed, 'OUT_OF_SERVICE')}>Out of service</Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Card>

      <DirectAdmitModal target={admitBed} wards={wards} onClose={() => setAdmitBed(null)} onAdmitted={(admission) => { setAdmitBed(null); toast('success', `${patientName(admission.patient)} admitted to bed ${admission.bed.label}.`); setOpenAdmission(admission.id); }} />
      <NewWardModal open={wardModal} onClose={() => setWardModal(false)} onSaved={() => { setWardModal(false); toast('success', 'Ward created.'); load(); }} />
    </div>
  );
}

/** Planned (elective) admission straight onto a chosen bed. */
function DirectAdmitModal({ target, wards, onClose, onAdmitted }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (target) {
      setSearch('');
      setResults([]);
      setPatient(null);
      setReason('');
      setError('');
    }
  }, [target]);

  async function find(event) {
    event.preventDefault();
    if (search.trim().length < 2) return;
    setResults(listItems(await encounterService.searchPatients(apiClient, search.trim())));
  }

  async function admit() {
    setSaving(true);
    setError('');
    try {
      onAdmitted(await inpatientService.admit(apiClient, { patientId: patient.id, wardId: target.ward.id, bedId: target.bed.id, reason: reason.trim() }));
    } catch (e) {
      setError(e?.message || 'The patient could not be admitted.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={Boolean(target)} title={target ? `Admit to ${target.ward.name}, bed ${target.bed.label}` : 'Admit'}
      description="For planned admissions. To admit from a clinic or emergency visit, use Admit to ward inside the visit."
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!patient || reason.trim().length < 3 || saving} onClick={admit}>{saving ? 'Admitting…' : 'Admit'}</Button></>}>
      <div className="space-y-4">
        {!patient ? (
          <>
            <form onSubmit={find} className="flex gap-2">
              <label className="sr-only" htmlFor="admit-search">Search patients</label>
              <input id="admit-search" className={inputClass} placeholder="Name, patient number or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button type="submit" variant="secondary">Find</Button>
            </form>
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200">
              {results.map((p) => (
                <li key={p.id}><button type="button" className="w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => setPatient(p)}><span className="font-semibold">{patientName(p)}</span> <span className="text-xs text-slate-500">{p.patientCode}</span></button></li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex items-center justify-between rounded-2xl bg-clinical-50 px-4 py-3">
            <span className="font-semibold">{patientName(patient)} <span className="text-xs font-normal text-slate-600">{patient.patientCode}</span></span>
            <button type="button" className="text-sm font-semibold text-clinical-700 hover:underline" onClick={() => setPatient(null)}>Change</button>
          </div>
        )}
        <FormField label="Reason for admission" required><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Elective hernia repair" /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

function NewWardModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ code: '', name: '', type: 'GENERAL', gender: 'MIXED', dailyRate: '', beds: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ code: '', name: '', type: 'GENERAL', gender: 'MIXED', dailyRate: '', beds: '' });
      setError('');
    }
  }, [open]);
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const beds = form.beds.split(',').map((b) => b.trim()).filter(Boolean);
  async function save() {
    setSaving(true);
    setError('');
    try {
      await inpatientService.createWard(apiClient, { code: form.code.trim(), name: form.name.trim(), type: form.type, gender: form.gender, dailyRate: form.dailyRate === '' ? 0 : Number(form.dailyRate), beds });
      onSaved();
    } catch (e) {
      setError(e?.message || 'The ward could not be created.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} title="New ward" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={form.code.trim().length < 2 || form.name.trim().length < 2 || saving} onClick={save}>{saving ? 'Saving…' : 'Create ward'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code" required><input className={`${inputClass} uppercase`} value={form.code} onChange={set('code')} maxLength={20} placeholder="SW1" /></FormField>
        <FormField label="Name" required><input className={inputClass} value={form.name} onChange={set('name')} placeholder="Surgical Ward 1" /></FormField>
        <FormField label="Type">
          <select className={inputClass} value={form.type} onChange={set('type')}>
            {['GENERAL', 'MEDICAL', 'SURGICAL', 'MATERNITY', 'PAEDIATRIC', 'ICU', 'PRIVATE'].map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </select>
        </FormField>
        <FormField label="Patients">
          <select className={inputClass} value={form.gender} onChange={set('gender')}>
            <option value="MIXED">Mixed</option>
            <option value="MALE">Male only</option>
            <option value="FEMALE">Female only</option>
          </select>
        </FormField>
        <FormField label="Charge per night"><input type="number" min="0" step="0.01" className={inputClass} value={form.dailyRate} onChange={set('dailyRate')} /></FormField>
        <FormField label="Beds" help={`Comma-separated labels${beds.length ? ` (${beds.length})` : ''}.`}><input className={inputClass} value={form.beds} onChange={set('beds')} placeholder="S1, S2, S3" /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}

function AdmissionView({ admissionId, auth, toast }) {
  const [admission, setAdmission] = useState(null);
  const [wards, setWards] = useState([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('mar');

  const load = useCallback(async () => {
    const [a, w] = await Promise.all([inpatientService.admission(apiClient, admissionId), inpatientService.wards(apiClient)]);
    setAdmission(a);
    setWards(listItems(w));
  }, [admissionId]);

  useEffect(() => {
    load().catch((e) => toast('error', e?.message || 'The stay could not be loaded.'));
  }, [load, toast]);

  const run = async (fn, message) => {
    setBusy(true);
    try {
      const result = await fn();
      if (result?.id) setAdmission(result);
      if (message) toast('success', message);
      return true;
    } catch (e) {
      toast('error', e?.message || 'That did not work.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!admission) return <Card><p className="text-sm text-slate-500">Loading stay…</p></Card>;
  const active = admission.status === 'ADMITTED';
  const patient = admission.patient;
  const medicines = admission.encounter.prescriptions.flatMap((rx) => rx.items.map((item) => ({ ...item, prescriptionCode: rx.prescriptionCode, prescriber: rx.prescriber })));
  const lastDose = (itemId) => admission.administrations.find((a) => a.prescriptionItemId === itemId);

  async function record(item, status) {
    let notes;
    if (status !== 'GIVEN') {
      notes = window.prompt(`Why was ${item.drugName} ${status.toLowerCase()}?`);
      if (!notes || !notes.trim()) return;
    }
    await run(() => inpatientService.administer(apiClient, admission.id, item.id, { status, notes: notes?.trim() }), `${item.drugName}: ${status.toLowerCase()} recorded.`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{admission.admissionCode} · {admission.ward.name}, bed {admission.bed.label}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{patientName(patient)}</h2>
            <p className="text-sm text-slate-600">{[patient.patientCode, ageLabel(patient.dateOfBirth), patient.gender].filter(Boolean).join(' · ')}</p>
            <p className="mt-2 text-sm text-slate-800"><span className="font-semibold">Admitted</span> {formatDateTime(admission.admittedAt)} by {admission.admittedBy?.name || '—'}: {admission.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {patient.allergies?.length ? patient.allergies.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Allergy: {a.substance}</span>
              )) : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">No known allergies recorded</span>}
              {admission.encounter.diagnoses.map((d) => <span key={d.id} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{d.code ? `${d.code} ` : ''}{d.description}</span>)}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <StatusBadge status={active ? 'Admitted' : admission.status === 'DISCHARGED' ? `Discharged ${formatDateTime(admission.dischargedAt)}` : 'Cancelled'} />
            {active && (
              <div className="flex flex-wrap gap-2">
                {can(auth, IP.TRANSFER) && <Button variant="secondary" disabled={busy} onClick={() => setMoveOpen(true)}><ArrowRightLeft className="h-4 w-4" /> Move bed</Button>}
                {can(auth, IP.DISCHARGE) && <Button variant="success" disabled={busy} onClick={() => setDischargeOpen(true)}><LogOut className="h-4 w-4" /> Discharge</Button>}
              </div>
            )}
          </div>
        </div>
        {admission.dischargeSummary && <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700"><span className="font-semibold">Discharge ({admission.dischargeOutcome?.toLowerCase().replace(/_/g, ' ')}):</span> {admission.dischargeSummary}</p>}
      </Card>

      <div role="tablist" aria-label="Stay sections" className="flex flex-wrap gap-2">
        {[['mar', 'Medication chart'], ['record', 'Clinical record'], ['beds', 'Bed history']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
        ))}
      </div>

      {tab === 'mar' && (
        <Card title="Medication chart" subtitle="Prescribe in the clinical record; record each dose here.">
          {medicines.length === 0 ? <p className="text-sm text-slate-500">Nothing prescribed for this stay yet.</p> : (
            <ul className="space-y-3">
              {medicines.map((item) => {
                const last = lastDose(item.id);
                return (
                  <li key={item.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{[item.drugName, item.strength, item.dosageForm].filter(Boolean).join(' ')}</p>
                        <p className="text-sm text-slate-600">{item.dose} {item.route}, {item.frequency}{item.durationDays ? ` for ${item.durationDays} days` : ''}</p>
                        <p className="text-xs text-slate-500">{last ? `Last: ${last.status.toLowerCase()} ${formatDateTime(last.administeredAt)} by ${last.administeredBy?.name || '—'}${last.notes ? ` (${last.notes})` : ''}` : 'No doses recorded yet'}</p>
                      </div>
                      {active && can(auth, IP.ADMINISTER) && (
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="success" disabled={busy} onClick={() => record(item, 'GIVEN')}><CheckCircle2 className="h-3.5 w-3.5" /> Given</Button>
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => record(item, 'HELD')}>Held</Button>
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => record(item, 'REFUSED')}>Refused</Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => record(item, 'MISSED')}>Missed</Button>
                        </div>
                      )}
                    </div>
                    {admission.administrations.filter((a) => a.prescriptionItemId === item.id).length > 1 && (
                      <details className="mt-2 text-xs text-slate-600">
                        <summary className="cursor-pointer font-semibold">All doses</summary>
                        <ul className="mt-1 space-y-0.5">
                          {admission.administrations.filter((a) => a.prescriptionItemId === item.id).map((a) => (
                            <li key={a.id}>{formatDateTime(a.administeredAt)} · {a.status.toLowerCase()}{a.doseGiven ? ` ${a.doseGiven}` : ''} · {a.administeredBy?.name || ''}{a.notes ? ` · ${a.notes}` : ''}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'record' && <EncounterWorkspace encounterId={admission.encounter.id} key={admission.encounter.id} />}

      {tab === 'beds' && (
        <Card title="Bed history">
          <ul className="divide-y divide-slate-100 text-sm">
            {admission.bedAssignments.map((b) => (
              <li key={b.id} className="py-2"><span className="font-semibold">{b.ward.name}, bed {b.bed.label}</span> · {formatDateTime(b.startedAt)} – {b.endedAt ? formatDateTime(b.endedAt) : 'now'}{b.reason ? ` · ${b.reason}` : ''}{b.assignedBy ? ` · ${b.assignedBy.name}` : ''}</li>
            ))}
          </ul>
        </Card>
      )}

      <MoveModal open={moveOpen} admission={admission} wards={wards} onClose={() => setMoveOpen(false)}
        onMove={async (payload) => { if (await run(() => inpatientService.transfer(apiClient, admission.id, payload), 'Patient moved.')) { setMoveOpen(false); load(); } }} busy={busy} />
      <DischargeModal open={dischargeOpen} hasDiagnosis={admission.encounter.diagnoses.length > 0} onClose={() => setDischargeOpen(false)}
        onDischarge={async (payload) => { if (await run(() => inpatientService.discharge(apiClient, admission.id, payload), 'Patient discharged. The bed is marked for cleaning.')) setDischargeOpen(false); }} busy={busy} />
    </div>
  );
}

function MoveModal({ open, admission, wards, onClose, onMove, busy }) {
  const [target, setTarget] = useState({ wardId: '', bedId: '' });
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) {
      setTarget({ wardId: admission.ward.id, bedId: '' });
      setReason('');
    }
  }, [open, admission]);
  return (
    <Modal open={open} title="Move bed" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!target.bedId || reason.trim().length < 3 || busy} onClick={() => onMove({ ...target, reason: reason.trim() })}>Move patient</Button></>}>
      <div className="space-y-3">
        <BedPicker wards={wards} gender={admission.patient.gender} value={target} onChange={setTarget} excludeBedId={admission.bed.id} />
        <FormField label="Reason" required><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Needs isolation" /></FormField>
      </div>
    </Modal>
  );
}

function DischargeModal({ open, hasDiagnosis, onClose, onDischarge, busy }) {
  const [outcome, setOutcome] = useState('DISCHARGED_HOME');
  const [summary, setSummary] = useState('');
  useEffect(() => {
    if (open) {
      setOutcome('DISCHARGED_HOME');
      setSummary('');
    }
  }, [open]);
  return (
    <Modal open={open} title="Discharge" description="Ends the stay, bills the ward nights and sends the bed for cleaning." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="success" disabled={!hasDiagnosis || summary.trim().length < 10 || busy} onClick={() => onDischarge({ outcome, summary: summary.trim() })}><LogOut className="h-4 w-4" /> Discharge</Button></>}>
      <div className="space-y-3">
        {!hasDiagnosis && <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Record a diagnosis in the clinical record first.</p>}
        <FormField label="Outcome">
          <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="DISCHARGED_HOME">Discharged home</option>
            <option value="REFERRED">Referred to another facility</option>
            <option value="DISCHARGED_AGAINST_ADVICE">Discharged against medical advice</option>
            <option value="ABSCONDED">Absconded</option>
            <option value="DECEASED">Deceased</option>
          </select>
        </FormField>
        <FormField label="Discharge summary" required help="Diagnosis, treatment given, medicines to continue, follow-up.">
          <textarea rows={5} className={inputClass} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={5000} />
        </FormField>
      </div>
    </Modal>
  );
}

