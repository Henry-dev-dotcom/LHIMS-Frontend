import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BedDouble, Scissors, CheckCircle2, ClipboardList, FlaskConical, HeartPulse, Pill, Plus, Stethoscope, Trash2, XCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { isAllergyConflict } from '../../services/pharmacyService';
import { inpatientService } from '../../services/inpatientService';
import { BedPicker } from '../inpatient/BedPicker';
import { BookSurgeryModal } from '../theatre/BookSurgeryModal';
import { ClinicalFormsCard } from '../clinics/ClinicalFormsCard';
import { CLINICS } from '../clinics/clinicConfig';
import { P, STATUS, TRIAGE, ageLabel, can, patientName } from './opdUtils';

const ACTIVE = ['WAITING_TRIAGE', 'WAITING_DOCTOR', 'IN_CONSULTATION'];

const VITAL_FIELDS = [
  { key: 'temperatureC', label: 'Temp (°C)', step: '0.1' },
  { key: 'pulseBpm', label: 'Pulse (bpm)' },
  { key: 'respiratoryRate', label: 'Resp. rate (/min)' },
  { key: 'systolicBp', label: 'BP systolic' },
  { key: 'diastolicBp', label: 'BP diastolic' },
  { key: 'spo2', label: 'SpO₂ (%)' },
  { key: 'weightKg', label: 'Weight (kg)', step: '0.1' },
  { key: 'heightCm', label: 'Height (cm)', step: '0.1' },
  { key: 'painScore', label: 'Pain (0-10)' },
  { key: 'bloodGlucose', label: 'Glucose (mmol/L)', step: '0.1' }
];

const EMPTY_RX_LINE = { drugId: '', drugName: '', strength: '', dosageForm: '', dose: '', route: 'Oral', frequency: '', durationDays: '', quantity: '', instructions: '' };

function numbersOnly(values) {
  const out = {};
  for (const [key, value] of Object.entries(values)) if (value !== '' && value !== undefined) out[key] = Number(value);
  return out;
}

function vitalsSummary(v) {
  if (!v) return 'No vitals recorded yet.';
  const parts = [];
  if (v.temperatureC != null) parts.push(`T ${Number(v.temperatureC)}°C`);
  if (v.pulseBpm != null) parts.push(`P ${v.pulseBpm}`);
  if (v.respiratoryRate != null) parts.push(`RR ${v.respiratoryRate}`);
  if (v.systolicBp != null) parts.push(`BP ${v.systolicBp}/${v.diastolicBp}`);
  if (v.spo2 != null) parts.push(`SpO₂ ${v.spo2}%`);
  if (v.weightKg != null) parts.push(`${Number(v.weightKg)} kg`);
  if (v.bloodGlucose != null) parts.push(`Glucose ${Number(v.bloodGlucose)}`);
  if (v.painScore != null) parts.push(`Pain ${v.painScore}/10`);
  return parts.join(' · ');
}

export function EncounterWorkspace({ encounterId }) {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [encounter, setEncounter] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [surgeryOpen, setSurgeryOpen] = useState(false);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    try {
      setEncounter(await encounterService.get(apiClient, encounterId));
      setError('');
    } catch (e) {
      setError(e?.message || 'This visit could not be loaded.');
    }
  }, [encounterId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Runs a write, shows the result, and keeps the page in sync with the server's view of the visit. */
  const act = useCallback(async (fn, success) => {
    setBusy(true);
    try {
      const updated = await fn();
      if (updated?.id) setEncounter(updated);
      else await load();
      if (success) toast('success', success);
      return true;
    } catch (e) {
      toast('error', e?.message || 'That did not work. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [load, toast]);

  if (error) return <Card><p role="alert" className="text-sm font-semibold text-red-600">{error}</p></Card>;
  if (!encounter) return <Card><p className="text-sm text-slate-500">Loading visit…</p></Card>;

  const open = ACTIVE.includes(encounter.status);
  const inConsult = encounter.status === 'IN_CONSULTATION';
  // Inpatient stays are opened by admission and closed by discharge, on the ward screens.
  const inpatient = encounter.type === 'INPATIENT';
  const canAdmit = inConsult && !inpatient && can(auth, 'inpatient:admit') && (auth?.modules || []).includes('inpatient');
  const canBookSurgery = open && can(auth, 'theatre:schedule') && (auth?.modules || []).includes('theatre');
  const patient = encounter.patient;
  const latestVitals = encounter.vitalSigns?.[0];

  return (
    <div className="space-y-4">
      {/* Patient banner: identity, safety alerts and the visit's state. */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{encounter.encounterCode} · {encounter.type === 'EMERGENCY' ? 'Emergency' : inpatient ? 'Inpatient stay' : encounter.clinic && encounter.clinic !== 'GENERAL' ? CLINICS[encounter.clinic]?.label || encounter.clinic : 'Outpatient'}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{patientName(patient)}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {[patient.patientCode, ageLabel(patient.dateOfBirth), patient.gender, patient.insuranceProvider && `${patient.insuranceProvider}${patient.policyNumber ? ` ${patient.policyNumber}` : ''}`].filter(Boolean).join(' · ')}
            </p>
            {encounter.chiefComplaint && <p className="mt-2 text-sm text-slate-800"><span className="font-semibold">Complaint:</span> {encounter.chiefComplaint}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {patient.allergies?.length ? patient.allergies.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Allergy: {a.substance}{a.reaction ? ` (${a.reaction})` : ''}
                </span>
              )) : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">No known allergies recorded</span>}
              {patient.diagnoses?.map((d) => (
                <span key={d.id} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{d.code ? `${d.code} ` : ''}{d.description}</span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {encounter.triageLevel && <span className={`rounded-full px-3 py-1 text-xs font-bold ${TRIAGE[encounter.triageLevel].className}`}>{TRIAGE[encounter.triageLevel].label}</span>}
              <StatusBadge status={STATUS[encounter.status]} />
            </div>
            {encounter.attending && <p className="text-xs text-slate-500">Clinician: {encounter.attending.name}</p>}
            <div className="flex flex-wrap gap-2">
              {open && !inConsult && can(auth, P.CONSULT) && (
                <Button disabled={busy} onClick={() => act(() => encounterService.startConsultation(apiClient, encounter.id), 'Consultation started.')}>
                  <Stethoscope className="h-4 w-4" /> Start consultation
                </Button>
              )}
              {canBookSurgery && (
                <Button variant="secondary" disabled={busy} onClick={() => setSurgeryOpen(true)}><Scissors className="h-4 w-4" /> Book operation</Button>
              )}
              {canAdmit && (
                <Button variant="secondary" disabled={busy} onClick={() => setAdmitOpen(true)}><BedDouble className="h-4 w-4" /> Admit to ward</Button>
              )}
              {inConsult && !inpatient && can(auth, P.COMPLETE) && (
                <Button variant="success" disabled={busy} onClick={() => setCompleteOpen(true)}><CheckCircle2 className="h-4 w-4" /> Complete visit</Button>
              )}
              {open && !inConsult && !inpatient && can(auth, P.CANCEL) && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    const reason = window.prompt('Why is this visit being cancelled?');
                    if (reason && reason.trim().length >= 3) act(() => encounterService.cancel(apiClient, encounter.id, { reason: reason.trim() }), 'Visit cancelled.');
                  }}
                >
                  <XCircle className="h-4 w-4" /> Cancel visit
                </Button>
              )}
            </div>
          </div>
        </div>
        {!open && (
          <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            This visit is {STATUS[encounter.status].toLowerCase()}{encounter.outcome ? ` (${encounter.outcome.toLowerCase().replace(/_/g, ' ')})` : ''}{encounter.cancelReason ? `: ${encounter.cancelReason}` : ''}. It is read-only.
          </p>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <VitalsCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} latest={latestVitals} />
        <AllergiesCard encounter={encounter} auth={auth} busy={busy} act={act} />
        <NotesCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} />
        <ClinicalFormsCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} />
        <DiagnosesCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} />
        <OrdersCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} />
        <PrescriptionsCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} />
        <ChargesCard encounter={encounter} />
      </div>

      <BookSurgeryModal
        open={surgeryOpen}
        encounter={encounter}
        onClose={() => setSurgeryOpen(false)}
        onBooked={(surgery) => {
          setSurgeryOpen(false);
          toast('success', `${surgery.procedureName} booked in ${surgery.theatre.name}, ${formatDateTime(surgery.scheduledStart)} (${surgery.surgeryCode}). See the Theatre List.`);
        }}
      />

      <AdmitFromVisitModal
        open={admitOpen}
        encounter={encounter}
        onClose={() => setAdmitOpen(false)}
        onAdmitted={async (admission) => {
          setAdmitOpen(false);
          toast('success', `Admitted to ${admission.ward.name}, bed ${admission.bed.label} (${admission.admissionCode}). This visit is now closed.`);
          await load();
        }}
      />

      <CompleteModal
        open={completeOpen}
        hasDiagnosis={encounter.diagnoses?.length > 0}
        onClose={() => setCompleteOpen(false)}
        onComplete={async (payload) => {
          const ok = await act(() => encounterService.complete(apiClient, encounter.id, payload), 'Visit completed.');
          if (ok) setCompleteOpen(false);
        }}
        busy={busy}
      />
    </div>
  );
}

function VitalsCard({ encounter, auth, open, busy, act, latest }) {
  const [values, setValues] = useState({});
  const [triageLevel, setTriageLevel] = useState(encounter.triageLevel || '');
  const [notes, setNotes] = useState('');
  const canRecord = open && (can(auth, P.TRIAGE) || can(auth, P.CONSULT));
  const triaging = encounter.status === 'WAITING_TRIAGE';

  async function save(completeTriage) {
    const ok = await act(
      () => encounterService.recordVitals(apiClient, encounter.id, { ...numbersOnly(values), notes: notes.trim() || undefined, triageLevel: triageLevel || undefined, completeTriage }),
      completeTriage ? 'Triage complete. The patient is in the doctor queue.' : 'Vitals recorded.'
    );
    if (ok) {
      setValues({});
      setNotes('');
    }
  }

  return (
    <Card title="Vitals & triage" subtitle={vitalsSummary(latest)}>
      {canRecord && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {VITAL_FIELDS.map((field) => (
              <FormField key={field.key} label={field.label}>
                <input type="number" inputMode="decimal" step={field.step || '1'} className={inputClass} value={values[field.key] ?? ''} onChange={(e) => setValues((c) => ({ ...c, [field.key]: e.target.value }))} />
              </FormField>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Triage level">
              <select className={inputClass} value={triageLevel} onChange={(e) => setTriageLevel(e.target.value)}>
                <option value="">Not set</option>
                {Object.entries(TRIAGE).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label="Notes"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => save(false)}><HeartPulse className="h-4 w-4" /> Save vitals</Button>
            {triaging && can(auth, P.TRIAGE) && (
              <Button disabled={busy || !triageLevel} onClick={() => save(true)}><CheckCircle2 className="h-4 w-4" /> Save & send to doctor</Button>
            )}
          </div>
        </div>
      )}
      {encounter.vitalSigns?.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {encounter.vitalSigns.map((v) => (
            <li key={v.id} className="py-2">
              <span className="text-slate-900">{vitalsSummary(v)}</span>
              <span className="block text-xs text-slate-500">{formatDateTime(v.recordedAt)}{v.recordedBy ? ` · ${v.recordedBy.name}` : ''}{v.notes ? ` · ${v.notes}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AllergiesCard({ encounter, auth, busy, act }) {
  const [substance, setSubstance] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState('MODERATE');
  if (!can(auth, P.ALLERGIES)) return null;

  async function add(event) {
    event.preventDefault();
    const ok = await act(
      async () => {
        await encounterService.addAllergy(apiClient, encounter.patient.id, { substance: substance.trim(), reaction: reaction.trim() || undefined, severity });
        return null;
      },
      `Allergy to ${substance.trim()} recorded.`
    );
    if (ok) {
      setSubstance('');
      setReaction('');
    }
  }

  return (
    <Card title="Record an allergy" subtitle="Allergies show on every visit for this patient.">
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-3">
        <FormField label="Substance" required><input className={inputClass} value={substance} onChange={(e) => setSubstance(e.target.value)} maxLength={120} /></FormField>
        <FormField label="Reaction"><input className={inputClass} value={reaction} onChange={(e) => setReaction(e.target.value)} maxLength={240} /></FormField>
        <FormField label="Severity">
          <select className={inputClass} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="MILD">Mild</option>
            <option value="MODERATE">Moderate</option>
            <option value="SEVERE">Severe</option>
          </select>
        </FormField>
        <div className="sm:col-span-3"><Button type="submit" variant="secondary" disabled={busy || substance.trim().length < 2}><AlertTriangle className="h-4 w-4" /> Add allergy</Button></div>
      </form>
    </Card>
  );
}

function NotesCard({ encounter, auth, open, busy, act }) {
  const [note, setNote] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const canWrite = open && (can(auth, P.CONSULT) || can(auth, P.TRIAGE));
  const empty = !Object.values(note).some((v) => v.trim());

  async function save(event) {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(note).map(([k, v]) => [k, v.trim() || undefined]));
    const ok = await act(() => encounterService.addNote(apiClient, encounter.id, payload), 'Note saved.');
    if (ok) setNote({ subjective: '', objective: '', assessment: '', plan: '' });
  }

  return (
    <Card title="Clinical notes" subtitle="Notes cannot be edited once saved; add a new note to correct one.">
      {canWrite && (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {[['subjective', 'Subjective (history)'], ['objective', 'Objective (examination)'], ['assessment', 'Assessment'], ['plan', 'Plan']].map(([key, label]) => (
            <FormField key={key} label={label}>
              <textarea rows={3} className={inputClass} value={note[key]} onChange={(e) => setNote((c) => ({ ...c, [key]: e.target.value }))} maxLength={5000} />
            </FormField>
          ))}
          <div className="sm:col-span-2"><Button type="submit" variant="secondary" disabled={busy || empty}><ClipboardList className="h-4 w-4" /> Save note</Button></div>
        </form>
      )}
      <ul className="mt-4 space-y-3">
        {encounter.notes?.length ? encounter.notes.map((n) => (
          <li key={n.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{n.type.toLowerCase()} · {n.author?.name || 'Unknown'} · {formatDateTime(n.createdAt)}{n.amendsId ? ' · correction' : ''}</p>
            {[['S', n.subjective], ['O', n.objective], ['A', n.assessment], ['P', n.plan]].filter(([, v]) => v).map(([k, v]) => (
              <p key={k} className="mt-1 whitespace-pre-wrap text-slate-800"><span className="font-bold">{k}:</span> {v}</p>
            ))}
          </li>
        )) : <li className="text-sm text-slate-500">No notes yet.</li>}
      </ul>
    </Card>
  );
}

function DiagnosesCard({ encounter, auth, open, busy, act }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [type, setType] = useState('PRIMARY');
  const [isChronic, setIsChronic] = useState(false);
  const canWrite = open && can(auth, P.CONSULT);

  useEffect(() => {
    if (!canWrite || query.trim().length < 2 || chosen) {
      setMatches([]);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      encounterService.diagnosisCodes(apiClient, query.trim()).then((data) => setMatches(listItems(data))).catch(() => setMatches([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, chosen, canWrite]);

  async function add(event) {
    event.preventDefault();
    const description = chosen?.description || query.trim();
    const ok = await act(() => encounterService.addDiagnosis(apiClient, encounter.id, { code: chosen?.code, description, type, isChronic }), 'Diagnosis recorded.');
    if (ok) {
      setQuery('');
      setChosen(null);
      setIsChronic(false);
      setType('SECONDARY');
    }
  }

  return (
    <Card title="Diagnoses" subtitle="Search ICD-10 or type a diagnosis. Chronic conditions join the problem list.">
      {canWrite && (
        <form onSubmit={add} className="space-y-3">
          <div className="relative">
            <FormField label="Diagnosis">
              <input
                className={inputClass}
                value={chosen ? `${chosen.code} ${chosen.description}` : query}
                onChange={(e) => { setChosen(null); setQuery(e.target.value); }}
                placeholder="e.g. malaria, I10"
                autoComplete="off"
                aria-autocomplete="list"
              />
            </FormField>
            {matches.length > 0 && (
              <ul role="listbox" className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                {matches.map((m) => (
                  <li key={m.code}>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setChosen(m); setMatches([]); }}>
                      <span className="font-mono font-semibold">{m.code}</span> {m.description}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Type">
              <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="PRIMARY">Primary</option>
                <option value="SECONDARY">Secondary</option>
                <option value="PROVISIONAL">Provisional</option>
              </select>
            </FormField>
            <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-clinical-600" checked={isChronic} onChange={(e) => setIsChronic(e.target.checked)} /> Chronic condition
            </label>
            <Button type="submit" variant="secondary" disabled={busy || (!chosen && query.trim().length < 2)}><Plus className="h-4 w-4" /> Add</Button>
          </div>
        </form>
      )}
      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {encounter.diagnoses?.length ? encounter.diagnoses.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 py-2">
            <span>
              <span className="font-semibold text-slate-900">{d.code ? `${d.code} ` : ''}{d.description}</span>
              <span className="block text-xs text-slate-500">{d.type.toLowerCase()}{d.isChronic ? ' · chronic' : ''}{d.status === 'RESOLVED' ? ' · resolved' : ''}</span>
            </span>
            {can(auth, P.CONSULT) && d.status === 'ACTIVE' && d.isChronic && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => encounterService.resolveDiagnosis(apiClient, encounter.id, d.id), 'Marked resolved.')}>Resolve</Button>
            )}
          </li>
        )) : <li className="text-slate-500">No diagnosis yet. One is required to complete the visit.</li>}
      </ul>
    </Card>
  );
}

function OrdersCard({ encounter, auth, open, busy, act }) {
  const [catalog, setCatalog] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState([]);
  const [urgency, setUrgency] = useState('ROUTINE');
  const canOrder = open && can(auth, P.ORDER);
  const modules = auth?.modules || [];

  useEffect(() => {
    if (!canOrder) return;
    encounterService.catalog(apiClient)
      .then((data) => setCatalog(listItems(data).filter((item) => item.isActive !== false && (
        (item.type === 'LAB' && modules.includes('laboratory')) || (item.type === 'SCAN' && modules.includes('imaging'))
      ))))
      .catch(() => setCatalog([]));
  }, [canOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return catalog.filter((item) => !q || item.name.toLowerCase().includes(q) || String(item.catalogCode).toLowerCase().includes(q)).slice(0, 30);
  }, [catalog, filter]);

  async function order() {
    const ok = await act(() => encounterService.order(apiClient, encounter.id, { items: selected.map((id) => ({ catalogItemId: id })), urgency }), 'Sent to the lab / imaging queue.');
    if (ok) setSelected([]);
  }

  return (
    <Card title="Investigations" subtitle="Tests and scans go straight to the lab and imaging queues.">
      {canOrder && (
        <div className="space-y-3">
          <input className={inputClass} placeholder="Search tests and scans" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search tests and scans" />
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2">
            {visible.length ? visible.map((item) => (
              <label key={item.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-clinical-600" checked={selected.includes(item.id)} onChange={() => setSelected((c) => (c.includes(item.id) ? c.filter((x) => x !== item.id) : [...c, item.id]))} />
                <span className="flex-1">{item.name}</span>
                <span className="text-xs text-slate-500">{item.type === 'LAB' ? 'Lab' : 'Scan'}</span>
              </label>
            )) : <p className="px-2 py-1.5 text-sm text-slate-500">No matching tests or scans.</p>}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Urgency">
              <select className={inputClass} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </FormField>
            <Button variant="secondary" disabled={busy || selected.length === 0} onClick={order}><FlaskConical className="h-4 w-4" /> Order {selected.length || ''}</Button>
          </div>
        </div>
      )}
      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {encounter.orders?.length ? encounter.orders.map((o) => (
          <li key={o.id} className="py-2">
            <span className="font-semibold text-slate-900">{o.orderCode}</span> <StatusBadge status={o.status.replace(/_/g, ' ').toLowerCase()} />
            <span className="block text-xs text-slate-600">{o.items.map((i) => i.catalogItem?.name).join(', ')}</span>
          </li>
        )) : <li className="text-slate-500">Nothing ordered.</li>}
      </ul>
    </Card>
  );
}

function PrescriptionsCard({ encounter, auth, open, busy, act }) {
  const [lines, setLines] = useState([{ ...EMPTY_RX_LINE }]);
  const canWrite = open && can(auth, P.PRESCRIBE);
  const valid = lines.every((l) => l.drugName.trim().length >= 2 && l.dose.trim() && l.route.trim() && l.frequency.trim());

  const setLine = (index, key, value) => setLines((c) => c.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  // Prescribe from the pharmacy's drug list when this facility runs a pharmacy.
  const useFormulary = can(auth, 'pharmacy:formulary:read') && (auth?.modules || []).includes('pharmacy');

  async function save() {
    const items = lines.map((l) => ({
      drugId: l.drugId || undefined,
      drugName: l.drugName.trim(),
      strength: l.strength.trim() || undefined,
      dosageForm: l.dosageForm.trim() || undefined,
      dose: l.dose.trim(),
      route: l.route.trim(),
      frequency: l.frequency.trim(),
      durationDays: l.durationDays ? Number(l.durationDays) : undefined,
      quantity: l.quantity ? Number(l.quantity) : undefined,
      instructions: l.instructions.trim() || undefined
    }));
    const ok = await act(async () => {
      try {
        return await encounterService.prescribe(apiClient, encounter.id, { items });
      } catch (error) {
        // A recorded allergy blocks the prescription unless the prescriber gives a reason.
        if (!isAllergyConflict(error)) throw error;
        const reason = window.prompt(`${error.message}\n\nReason for prescribing anyway:`);
        if (!reason || reason.trim().length < 5) throw new Error('Prescription not issued: an allergy override needs a reason (at least 5 characters).');
        return encounterService.prescribe(apiClient, encounter.id, { items, allergyOverrideReason: reason.trim() });
      }
    }, 'Prescription issued.');
    if (ok) setLines([{ ...EMPTY_RX_LINE }]);
  }

  return (
    <Card title="Prescriptions" subtitle={encounter.patient.allergies?.length ? `Check allergies: ${encounter.patient.allergies.map((a) => a.substance).join(', ')}.` : undefined}>
      {canWrite && (
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                {useFormulary ? (
                  <DrugPicker
                    line={line}
                    onText={(value) => setLines((c) => c.map((l, i) => (i === index ? { ...l, drugName: value, drugId: '' } : l)))}
                    onPick={(drug) => setLines((c) => c.map((l, i) => (i === index ? { ...l, drugId: drug.id, drugName: drug.genericName, strength: drug.strength || l.strength, dosageForm: drug.dosageForm || l.dosageForm } : l)))}
                  />
                ) : (
                  <FormField label="Medicine" required><input className={inputClass} value={line.drugName} onChange={(e) => setLine(index, 'drugName', e.target.value)} /></FormField>
                )}
              </div>
              <FormField label="Strength"><input className={inputClass} value={line.strength} onChange={(e) => setLine(index, 'strength', e.target.value)} placeholder="500 mg" /></FormField>
              <FormField label="Form"><input className={inputClass} value={line.dosageForm} onChange={(e) => setLine(index, 'dosageForm', e.target.value)} placeholder="Tablet" /></FormField>
              <FormField label="Dose" required><input className={inputClass} value={line.dose} onChange={(e) => setLine(index, 'dose', e.target.value)} placeholder="1 tablet" /></FormField>
              <FormField label="Route" required><input className={inputClass} value={line.route} onChange={(e) => setLine(index, 'route', e.target.value)} /></FormField>
              <FormField label="Frequency" required><input className={inputClass} value={line.frequency} onChange={(e) => setLine(index, 'frequency', e.target.value)} placeholder="Twice daily" /></FormField>
              <FormField label="Days"><input type="number" min="1" className={inputClass} value={line.durationDays} onChange={(e) => setLine(index, 'durationDays', e.target.value)} /></FormField>
              <FormField label="Quantity"><input type="number" min="1" className={inputClass} value={line.quantity} onChange={(e) => setLine(index, 'quantity', e.target.value)} /></FormField>
              <FormField label="Instructions" className="sm:col-span-2"><input className={inputClass} value={line.instructions} onChange={(e) => setLine(index, 'instructions', e.target.value)} placeholder="After meals" /></FormField>
              {lines.length > 1 && (
                <div className="flex items-end"><Button size="sm" variant="ghost" onClick={() => setLines((c) => c.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /> Remove</Button></div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setLines((c) => [...c, { ...EMPTY_RX_LINE }])}><Plus className="h-4 w-4" /> Another medicine</Button>
            <Button variant="secondary" disabled={busy || !valid} onClick={save}><Pill className="h-4 w-4" /> Issue prescription</Button>
          </div>
        </div>
      )}
      <ul className="mt-4 space-y-2 text-sm">
        {encounter.prescriptions?.length ? encounter.prescriptions.map((rx) => (
          <li key={rx.id} className="rounded-2xl border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500">{rx.prescriptionCode} · {rx.prescriber?.name || ''} · {formatDateTime(rx.createdAt)}</p>
            <ul className="mt-1 list-disc pl-5 text-slate-800">
              {rx.items.map((item) => (
                <li key={item.id}>{[item.drugName, item.strength, item.dosageForm].filter(Boolean).join(' ')} — {item.dose} {item.route}, {item.frequency}{item.durationDays ? ` for ${item.durationDays} days` : ''}{item.quantity ? ` (qty ${item.quantity})` : ''}{item.instructions ? `; ${item.instructions}` : ''}</li>
              ))}
            </ul>
          </li>
        )) : <li className="text-slate-500">No prescriptions.</li>}
      </ul>
    </Card>
  );
}

/** Medicine field with suggestions from the pharmacy's drug list; free text is still allowed. */
function DrugPicker({ line, onText, onPick }) {
  const [matches, setMatches] = useState([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const q = line.drugName.trim();
    if (!focused || line.drugId || q.length < 2) {
      setMatches([]);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      encounterService.formulary(apiClient, q).then((data) => setMatches(listItems(data))).catch(() => setMatches([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [line.drugName, line.drugId, focused]);

  return (
    <div className="relative">
      <FormField label="Medicine" required help={line.drugId ? 'From the pharmacy drug list.' : 'Type to search the drug list, or enter any medicine.'}>
        <input
          className={inputClass}
          value={line.drugName}
          onChange={(e) => onText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          autoComplete="off"
          aria-autocomplete="list"
        />
      </FormField>
      {matches.length > 0 && (
        <ul role="listbox" className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
          {matches.map((drug) => (
            <li key={drug.id}>
              <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(drug); setMatches([]); }}>
                <span>{[drug.genericName, drug.strength, drug.dosageForm].filter(Boolean).join(' ')}{drug.brandName ? ` (${drug.brandName})` : ''}</span>
                <span className={`text-xs font-semibold ${drug.onHand > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{drug.onHand > 0 ? `${drug.onHand} in stock` : 'Out of stock'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChargesCard({ encounter }) {
  // Encounter charges (e.g. consultation fee); investigation bills belong to their orders.
  const orderInvoices = encounter.orders?.length || 0;
  return (
    <Card title="Charges" subtitle={orderInvoices ? 'Tests and scans are billed separately on their orders.' : undefined}>
      <ul className="divide-y divide-slate-100 text-sm">
        {encounter.invoices?.length ? encounter.invoices.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between py-2">
            <span>
              <span className="font-semibold text-slate-900">{inv.invoiceCode}</span>
              <span className="block text-xs text-slate-500">{inv.items.map((i) => i.description).join(', ')}</span>
            </span>
            <span className="text-right">
              <span className="block font-semibold">{Number(inv.total).toFixed(2)}</span>
              <span className="block text-xs text-slate-500">{Number(inv.balance) > 0 ? `${Number(inv.balance).toFixed(2)} due` : 'Paid'}</span>
            </span>
          </li>
        )) : <li className="text-slate-500">No visit charges.</li>}
      </ul>
    </Card>
  );
}

/** The decision to admit: choose a ward and bed; the visit closes as ADMITTED. */
function AdmitFromVisitModal({ open, encounter, onClose, onAdmitted }) {
  const [wards, setWards] = useState([]);
  const [target, setTarget] = useState({ wardId: '', bedId: '' });
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setTarget({ wardId: '', bedId: '' });
    setReason(encounter.diagnoses?.[0]?.description || encounter.chiefComplaint || '');
    setError('');
    inpatientService.wards(apiClient).then((data) => setWards(listItems(data))).catch(() => setWards([]));
  }, [open, encounter]);
  async function admit() {
    setSaving(true);
    setError('');
    try {
      onAdmitted(await inpatientService.admit(apiClient, { patientId: encounter.patient.id, ...target, reason: reason.trim(), sourceEncounterId: encounter.id }));
    } catch (e) {
      setError(e?.message || 'The patient could not be admitted.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} title="Admit to ward" description="Diagnoses from this visit carry over to the stay, and this visit closes as admitted." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!target.bedId || reason.trim().length < 3 || saving} onClick={admit}><BedDouble className="h-4 w-4" /> {saving ? 'Admitting…' : 'Admit'}</Button></>}>
      <div className="space-y-3">
        {!encounter.diagnoses?.length && <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Record a diagnosis before admitting.</p>}
        <BedPicker wards={wards} gender={encounter.patient.gender} value={target} onChange={setTarget} />
        <FormField label="Reason for admission" required><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

function CompleteModal({ open, hasDiagnosis, onClose, onComplete, busy }) {
  const [outcome, setOutcome] = useState('DISCHARGED');
  const [summary, setSummary] = useState('');
  useEffect(() => {
    if (open) {
      setOutcome('DISCHARGED');
      setSummary('');
    }
  }, [open]);
  return (
    <Modal
      open={open}
      title="Complete visit"
      description="The visit becomes read-only once completed."
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="success" disabled={busy || !hasDiagnosis} onClick={() => onComplete({ outcome, summary: summary.trim() || undefined })}>
            <CheckCircle2 className="h-4 w-4" /> Complete visit
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        {!hasDiagnosis && <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Record at least one diagnosis first.</p>}
        <FormField label="Outcome">
          <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="DISCHARGED">Discharged home</option>
            <option value="REFERRED">Referred</option>
            <option value="ADMITTED">Admitted</option>
            <option value="DECEASED">Deceased</option>
          </select>
        </FormField>
        <FormField label="Discharge summary / advice">
          <textarea rows={4} className={inputClass} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={5000} />
        </FormField>
      </div>
    </Modal>
  );
}
