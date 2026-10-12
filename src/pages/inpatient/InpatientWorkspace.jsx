import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRightLeft, History, LogOut, Save } from 'lucide-react';
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
import { QuickPeek } from '../clinician/QuickPeek';
import { ageLabel, can, patientName } from '../opd/opdUtils';
import { BedPicker } from './BedPicker';
import { FlowsheetTab } from './FlowsheetTab';
import { RoundsTab, EMPTY_NOTE } from './RoundsTab';
import { MedicationTab } from './MedicationTab';
import { ResultsTab } from './ResultsTab';
import { IP, bedDots } from './wardUtils';

/*
  A patient's stay, in one place.

  Four working tabs - vitals and flowsheet, the doctor's rounds, the medication chart, and
  orders and results - then the full clinical record and the bed history. The bar of actions
  at the top (save, move bed, discharge) is always in view, so the day's work can be finished
  from whichever tab the clinician is on.
*/

const TABS = [
  ['flowsheet', 'Vitals & flowsheet'],
  ['rounds', "Doctor's rounds"],
  ['mar', 'Medication chart'],
  ['results', 'Orders & results'],
  ['record', 'Clinical record'],
  ['beds', 'Bed history']
];

export function InpatientWorkspace({ admissionId, onClose }) {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);
  const [admission, setAdmission] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [flags, setFlags] = useState(null);
  const [wards, setWards] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('flowsheet');
  const [peek, setPeek] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [note, setNote] = useState(EMPTY_NOTE);

  const loadFlags = useCallback(async () => {
    try {
      const board = await inpatientService.board(apiClient);
      const bed = board.items.flatMap((w) => w.beds).find((b) => b.admission?.id === admissionId);
      setFlags(bed?.admission?.flags || null);
    } catch {
      /* the dots are a convenience; the chart itself still works without them */
    }
  }, [admissionId]);

  const load = useCallback(async () => {
    try {
      const a = await inpatientService.admission(apiClient, admissionId);
      setAdmission(a);
      setEncounter(await encounterService.get(apiClient, a.encounter.id));
      setError('');
    } catch (e) {
      setError(e?.message || 'The stay could not be loaded.');
    }
  }, [admissionId]);

  useEffect(() => {
    load();
    loadFlags();
    inpatientService.wards(apiClient).then((w) => setWards(listItems(w))).catch(() => setWards([]));
  }, [load, loadFlags]);

  const changed = useCallback(() => {
    loadFlags();
  }, [loadFlags]);

  /** Runs a write against the visit, then brings the page in line with the server. */
  const act = useCallback(async (fn, success) => {
    setBusy(true);
    try {
      const updated = await fn();
      if (updated?.id && updated.patient) setEncounter(updated);
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

  const saveNote = useCallback(async () => {
    const payload = Object.fromEntries(Object.entries(note).map(([k, v]) => [k, v.trim() || undefined]));
    const ok = await act(() => encounterService.addNote(apiClient, encounter.id, payload), 'Note saved.');
    if (ok) setNote(EMPTY_NOTE);
    return ok;
  }, [act, encounter, note]);

  if (error) return <Card><p role="alert" className="text-sm font-semibold text-red-600">{error}</p></Card>;
  if (!admission || !encounter) return <Card><p className="text-sm text-slate-500">Loading stay…</p></Card>;

  const active = admission.status === 'ADMITTED';
  const patient = admission.patient;
  const dots = bedDots(flags);
  const unsaved = Object.values(note).some((v) => v.trim());

  async function saveUpdates() {
    if (!unsaved) {
      toast('success', 'Everything is already saved. Vitals, fluids and doses save as you record them.');
      return;
    }
    await saveNote();
  }

  async function run(fn, message) {
    setBusy(true);
    try {
      await fn();
      if (message) toast('success', message);
      return true;
    } catch (e) {
      toast('error', e?.message || 'That did not work.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" onClick={onClose}><ArrowLeft className="h-4 w-4" /> Back to wards</Button>
        <Button variant="secondary" onClick={() => setPeek((v) => !v)} aria-pressed={peek}><History className="h-4 w-4" /> Last visits</Button>
      </div>

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
            {active && dots.reasons.length > 0 && (
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800" role="status">
                {dots.red && <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden="true" />}
                {dots.yellow && <span className="h-3 w-3 rounded-full bg-amber-400" aria-hidden="true" />}
                Needs attention: {dots.reasons.join(', ')}
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <StatusBadge status={active ? 'Admitted' : admission.status === 'DISCHARGED' ? `Discharged ${formatDateTime(admission.dischargedAt)}` : 'Cancelled'} />
            {active && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Ward actions">
                <Button variant="secondary" disabled={busy} onClick={saveUpdates}><Save className="h-4 w-4" /> Save updates{unsaved ? ' •' : ''}</Button>
                {can(auth, IP.TRANSFER) && <Button variant="secondary" disabled={busy} onClick={() => setMoveOpen(true)}><ArrowRightLeft className="h-4 w-4" /> Transfer bed</Button>}
                {can(auth, IP.DISCHARGE) && <Button variant="success" disabled={busy} onClick={() => setDischargeOpen(true)}><LogOut className="h-4 w-4" /> Discharge</Button>}
              </div>
            )}
          </div>
        </div>
        {admission.dischargeSummary && <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700"><span className="font-semibold">Discharge ({admission.dischargeOutcome?.toLowerCase().replace(/_/g, ' ')}):</span> {admission.dischargeSummary}</p>}
      </Card>

      <div role="tablist" aria-label="Stay sections" className="flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {label}{id === 'rounds' && unsaved ? ' •' : ''}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {tab === 'flowsheet' && <FlowsheetTab admission={admission} encounter={encounter} auth={auth} open={active} busy={busy} act={act} toast={toast} onChanged={changed} />}
          {tab === 'rounds' && <RoundsTab encounter={encounter} auth={auth} open={active} busy={busy} note={note} setNote={setNote} onSave={saveNote} />}
          {tab === 'mar' && <MedicationTab admission={admission} auth={auth} toast={toast} onChanged={changed} />}
          {tab === 'results' && <ResultsTab admission={admission} encounter={encounter} auth={auth} open={active} busy={busy} act={act} toast={toast} newResults={flags?.newResults || 0} onChanged={changed} />}
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
        </div>
        {peek && <QuickPeek patientId={patient.id} currentEncounterId={admission.encounter.id} onClose={() => setPeek(false)} />}
      </div>

      <MoveModal open={moveOpen} admission={admission} wards={wards} onClose={() => setMoveOpen(false)} busy={busy}
        onMove={async (payload) => { if (await run(() => inpatientService.transfer(apiClient, admission.id, payload), 'Patient moved.')) { setMoveOpen(false); load(); } }} />
      <DischargeModal open={dischargeOpen} hasDiagnosis={admission.encounter.diagnoses.length > 0} onClose={() => setDischargeOpen(false)} busy={busy}
        onDischarge={async (payload) => { if (await run(() => inpatientService.discharge(apiClient, admission.id, payload), 'Patient discharged. The bed is marked for cleaning.')) { setDischargeOpen(false); load(); } }} />
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
    <Modal open={open} title="Transfer bed" onClose={onClose}
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
