import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ClipboardCheck, Plus, RefreshCw, Scissors, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { ANAESTHESIA, theatreService } from '../../services/theatreService';
import { EncounterWorkspace } from '../opd/EncounterWorkspace';
import { ageLabel, can, patientName, todayIso } from '../opd/opdUtils';

const TP = {
  SCHEDULE: 'theatre:schedule',
  CHECKLIST: 'theatre:checklist',
  OPERATE: 'theatre:operate',
  MANAGE: 'theatre:theatres:manage'
};

const STATUS_STYLE = {
  SCHEDULED: 'bg-slate-100 text-slate-700',
  IN_THEATRE: 'bg-amber-100 text-amber-900',
  COMPLETED: 'bg-emerald-100 text-emerald-900',
  CANCELLED: 'bg-red-50 text-red-700'
};
const STATUS_LABEL = { SCHEDULED: 'Scheduled', IN_THEATRE: 'In theatre', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const URGENCY_STYLE = { ELECTIVE: 'text-slate-500', URGENT: 'text-amber-700 font-semibold', EMERGENCY: 'text-red-700 font-bold' };

const time = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const phaseOf = (s) => (s.status === 'SCHEDULED' ? 'Sign in' : s.status === 'IN_THEATRE' ? (s.timeOutAt ? 'Operating: sign out' : 'Time out') : null);

export function TheatreListPage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [date, setDate] = useState(todayIso());
  const [theatres, setTheatres] = useState([]);
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState('');
  const [theatreModal, setTheatreModal] = useState(false);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([theatreService.theatres(apiClient), theatreService.surgeries(apiClient, { date })]);
      setTheatres(listItems(t));
      setSurgeries(listItems(s));
    } catch (error) {
      toast('error', error?.message || 'The theatre list could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    if (!openId) load();
  }, [load, openId]);

  if (openId) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => setOpenId('')}><ArrowLeft className="h-4 w-4" /> Back to theatre list</Button>
        <SurgeryView surgeryId={openId} auth={auth} toast={toast} />
      </div>
    );
  }

  const active = surgeries.filter((s) => s.status !== 'CANCELLED');
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Theatre" title="Theatre list" description="The day's operations by theatre. Book operations from the patient's visit or ward stay." />
      <Card
        title="Operating list"
        subtitle={loading ? 'Loading…' : `${active.length} operation${active.length === 1 ? '' : 's'} on this day`}
        actions={(
          <>
            <label className="sr-only" htmlFor="theatre-date">Day</label>
            <input id="theatre-date" type="date" className={`${inputClass} w-auto`} value={date} onChange={(e) => setDate(e.target.value)} />
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            {can(auth, TP.MANAGE) && <Button onClick={() => setTheatreModal(true)}><Plus className="h-4 w-4" /> New theatre</Button>}
          </>
        )}
      >
        {!loading && theatres.length === 0 && <p className="text-sm text-slate-500">No theatres yet.{can(auth, TP.MANAGE) ? ' Create the first one.' : ''}</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {theatres.map((theatre) => {
            const cases = surgeries.filter((s) => s.theatre.id === theatre.id);
            return (
              <section key={theatre.id} aria-label={theatre.name} className="rounded-2xl border border-slate-200 p-4">
                <h3 className="mb-3 text-base font-bold text-slate-900">{theatre.name} {!theatre.isActive && <span className="text-sm font-normal text-slate-500">(closed)</span>}</h3>
                {cases.length === 0 ? <p className="text-sm text-slate-500">Nothing booked.</p> : (
                  <ul className="space-y-2">
                    {cases.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => setOpenId(s.id)} className={`w-full rounded-2xl border border-slate-200 px-4 py-3 text-left hover:border-clinical-300 hover:bg-clinical-50 ${s.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900">{time(s.scheduledStart)}–{time(s.scheduledEnd)} · {s.procedureName}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${STATUS_STYLE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">{patientName(s.patient)} <span className="text-xs text-slate-500">{s.patient.patientCode}{s.encounter.admission ? ` · ${s.encounter.admission.ward.name} ${s.encounter.admission.bed.label}` : ''}</span></p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            <span className={URGENCY_STYLE[s.urgency]}>{s.urgency.toLowerCase()}</span>
                            {s.surgeon ? ` · ${s.surgeon.name}` : ''}{phaseOf(s) ? ` · next: ${phaseOf(s).toLowerCase()}` : ''}
                            {s.patient.allergies?.length ? <span className="font-bold text-red-700"> · allergy</span> : null}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </Card>
      <NewTheatreModal open={theatreModal} onClose={() => setTheatreModal(false)} onSaved={() => { setTheatreModal(false); toast('success', 'Theatre created.'); load(); }} />
    </div>
  );
}

/** One operation: details, the three checklist steps in order, and the clinical record. */
function SurgeryView({ surgeryId, auth, toast }) {
  const [surgery, setSurgery] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('checklist');
  const [busy, setBusy] = useState(false);
  const [rebook, setRebook] = useState(false);

  const load = useCallback(async () => {
    try {
      setSurgery(await theatreService.surgery(apiClient, surgeryId));
      setError('');
    } catch (e) {
      setError(e?.message || 'This operation could not be loaded.');
    }
  }, [surgeryId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(async (fn, success) => {
    setBusy(true);
    try {
      setSurgery(await fn());
      toast('success', success);
      return true;
    } catch (e) {
      toast('error', e?.message || 'That did not work. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  if (error) return <Card><p role="alert" className="text-sm font-semibold text-red-600">{error}</p></Card>;
  if (!surgery) return <Card><p className="text-sm text-slate-500">Loading operation…</p></Card>;

  const p = surgery.patient;
  const canCancel = ['SCHEDULED', 'IN_THEATRE'].includes(surgery.status) && !surgery.timeOutAt && can(auth, TP.SCHEDULE);
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{surgery.surgeryCode} · {surgery.theatre.name} · {surgery.urgency.toLowerCase()}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{surgery.procedureName}</h2>
            <p className="mt-1 text-sm text-slate-700">{patientName(p)} · {[p.patientCode, ageLabel(p.dateOfBirth), p.gender].filter(Boolean).join(' · ')}{surgery.encounter.admission ? ` · ${surgery.encounter.admission.ward.name}, bed ${surgery.encounter.admission.bed.label}` : ''}</p>
            <p className="mt-1 text-sm text-slate-600">
              {formatDateTime(surgery.scheduledStart)} to {time(surgery.scheduledEnd)}
              {surgery.surgeon ? ` · Surgeon ${surgery.surgeon.name}` : ''}{surgery.anaesthetistName ? ` · Anaesthetist ${surgery.anaesthetistName}` : ''}
              {surgery.anaesthesia ? ` · ${ANAESTHESIA[surgery.anaesthesia]} anaesthesia` : ''}
            </p>
            {surgery.preopDiagnosis && <p className="mt-1 text-sm text-slate-800"><span className="font-semibold">Pre-op diagnosis:</span> {surgery.preopDiagnosis}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {p.allergies?.length ? p.allergies.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Allergy: {a.substance}{a.reaction ? ` (${a.reaction})` : ''}
                </span>
              )) : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">No known allergies recorded</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${STATUS_STYLE[surgery.status]}`}>{STATUS_LABEL[surgery.status]}</span>
            <div className="flex flex-wrap gap-2">
              {surgery.status === 'SCHEDULED' && can(auth, TP.SCHEDULE) && <Button variant="secondary" disabled={busy} onClick={() => setRebook(true)}><CalendarClock className="h-4 w-4" /> Rebook</Button>}
              {canCancel && (
                <Button variant="secondary" disabled={busy} onClick={() => {
                  const reason = window.prompt('Why is this operation being cancelled or postponed?');
                  if (reason && reason.trim().length >= 3) act(() => theatreService.cancel(apiClient, surgery.id, { reason: reason.trim() }), 'Operation cancelled.');
                }}><XCircle className="h-4 w-4" /> Cancel</Button>
              )}
            </div>
          </div>
        </div>
        {surgery.status === 'CANCELLED' && <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">Cancelled: {surgery.cancelReason}</p>}
      </Card>

      <div role="tablist" className="flex gap-2">
        {[['checklist', 'Safety checklist & note'], ['record', 'Clinical record']].map(([id, label]) => (
          <Button key={id} role="tab" aria-selected={tab === id} variant={tab === id ? 'primary' : 'secondary'} onClick={() => setTab(id)}>{label}</Button>
        ))}
      </div>

      {tab === 'record' ? <EncounterWorkspace encounterId={surgery.encounter.id} /> : (
        <div className="grid gap-4 xl:grid-cols-3">
          <SignInStep surgery={surgery} auth={auth} busy={busy} act={act} />
          <TimeOutStep surgery={surgery} auth={auth} busy={busy} act={act} />
          <SignOutStep surgery={surgery} auth={auth} busy={busy} act={act} />
        </div>
      )}

      <RebookModal open={rebook} surgery={surgery} onClose={() => setRebook(false)} onSaved={(updated) => { setRebook(false); setSurgery(updated); toast('success', 'Operation rebooked.'); }} />
    </div>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-800">
      <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Choice({ label, value, options, onChange }) {
  return (
    <FormField label={label}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </FormField>
  );
}

function Done({ entry, at }) {
  return <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"><CheckCircle2 className="h-4 w-4" /> Done {formatDateTime(at)}{entry?.by ? ` by ${entry.by}` : ''}</p>;
}

function StepCard({ number, title, subtitle, children }) {
  return (
    <Card title={`${number}. ${title}`} subtitle={subtitle}>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

/** WHO SIGN IN: before induction of anaesthesia. */
function SignInStep({ surgery, auth, busy, act }) {
  const [a, setA] = useState({ identityConfirmed: false, siteMarked: 'YES', anaesthesiaCheckDone: false, pulseOximeterOn: false, knownAllergy: Boolean(surgery.patient.allergies?.length), difficultAirway: false, bloodLossRisk: false });
  const [anaesthesia, setAnaesthesia] = useState(surgery.anaesthesia || 'GENERAL');
  const set = (key) => (value) => setA((c) => ({ ...c, [key]: value }));
  if (surgery.signInAt) return <StepCard number={1} title="Sign in" subtitle="Before induction of anaesthesia"><Done entry={surgery.checklist?.signIn} at={surgery.signInAt} /></StepCard>;
  if (surgery.status !== 'SCHEDULED') return <StepCard number={1} title="Sign in" subtitle="Before induction of anaesthesia"><p className="text-sm text-slate-500">Not done.</p></StepCard>;
  const ready = a.identityConfirmed && a.anaesthesiaCheckDone && a.pulseOximeterOn;
  return (
    <StepCard number={1} title="Sign in" subtitle="Before induction of anaesthesia">
      <Check label="Patient has confirmed identity, site, procedure and consent" checked={a.identityConfirmed} onChange={set('identityConfirmed')} />
      <Choice label="Site marked" value={a.siteMarked} onChange={set('siteMarked')} options={[['YES', 'Yes'], ['NOT_APPLICABLE', 'Not applicable']]} />
      <Check label="Anaesthesia machine and medication check complete" checked={a.anaesthesiaCheckDone} onChange={set('anaesthesiaCheckDone')} />
      <Check label="Pulse oximeter on the patient and working" checked={a.pulseOximeterOn} onChange={set('pulseOximeterOn')} />
      <Check label="Known allergy" checked={a.knownAllergy} onChange={set('knownAllergy')} />
      <Check label="Difficult airway or aspiration risk (equipment and help available)" checked={a.difficultAirway} onChange={set('difficultAirway')} />
      <Check label="Risk of more than 500 ml blood loss (7 ml/kg in children)" checked={a.bloodLossRisk} onChange={set('bloodLossRisk')} />
      <Choice label="Anaesthesia" value={anaesthesia} onChange={setAnaesthesia} options={Object.entries(ANAESTHESIA)} />
      {can(auth, TP.CHECKLIST) && (
        <Button disabled={busy || !ready} onClick={() => act(() => theatreService.signIn(apiClient, surgery.id, { anaesthesia, answers: a }), 'Sign in recorded. The patient is in theatre.')}>
          <ClipboardCheck className="h-4 w-4" /> Record sign in
        </Button>
      )}
    </StepCard>
  );
}

/** WHO TIME OUT: before skin incision. */
function TimeOutStep({ surgery, auth, busy, act }) {
  const [a, setA] = useState({ teamIntroduced: false, patientProcedureSiteConfirmed: false, antibioticProphylaxis: 'GIVEN', imagingDisplayed: 'NOT_APPLICABLE', criticalEventsReviewed: false });
  const set = (key) => (value) => setA((c) => ({ ...c, [key]: value }));
  if (surgery.timeOutAt) return <StepCard number={2} title="Time out" subtitle="Before skin incision"><Done entry={surgery.checklist?.timeOut} at={surgery.timeOutAt} /></StepCard>;
  if (surgery.status !== 'IN_THEATRE') return <StepCard number={2} title="Time out" subtitle="Before skin incision"><p className="text-sm text-slate-500">{surgery.status === 'SCHEDULED' ? 'After sign in.' : 'Not done.'}</p></StepCard>;
  const ready = a.teamIntroduced && a.patientProcedureSiteConfirmed && a.criticalEventsReviewed;
  return (
    <StepCard number={2} title="Time out" subtitle="Before skin incision">
      <Check label="All team members have introduced themselves by name and role" checked={a.teamIntroduced} onChange={set('teamIntroduced')} />
      <Check label="Patient, procedure and incision site confirmed" checked={a.patientProcedureSiteConfirmed} onChange={set('patientProcedureSiteConfirmed')} />
      <Choice label="Antibiotic prophylaxis in the last 60 minutes" value={a.antibioticProphylaxis} onChange={set('antibioticProphylaxis')} options={[['GIVEN', 'Given'], ['NOT_APPLICABLE', 'Not applicable']]} />
      <Choice label="Essential imaging displayed" value={a.imagingDisplayed} onChange={set('imagingDisplayed')} options={[['YES', 'Yes'], ['NOT_APPLICABLE', 'Not applicable']]} />
      <Check label="Anticipated critical events reviewed (surgeon, anaesthetist, nursing)" checked={a.criticalEventsReviewed} onChange={set('criticalEventsReviewed')} />
      {can(auth, TP.CHECKLIST) && (
        <Button disabled={busy || !ready} onClick={() => act(() => theatreService.timeOut(apiClient, surgery.id, { answers: a }), 'Time out recorded. The operation has started.')}>
          <ClipboardCheck className="h-4 w-4" /> Record time out
        </Button>
      )}
    </StepCard>
  );
}

/** WHO SIGN OUT and the operation note: before the patient leaves theatre. */
function SignOutStep({ surgery, auth, busy, act }) {
  const [a, setA] = useState({ procedureRecorded: false, countsCorrect: false, specimensLabelled: 'NOT_APPLICABLE', equipmentProblems: '', recoveryConcerns: '' });
  const [note, setNote] = useState({ procedurePerformed: surgery.procedureName, findings: '', complications: '', bloodLossMl: '', specimens: '', postOpPlan: '' });
  const set = (key) => (value) => setA((c) => ({ ...c, [key]: value }));
  const setN = (key) => (e) => setNote((c) => ({ ...c, [key]: e.target.value }));

  if (surgery.status === 'COMPLETED') {
    return (
      <StepCard number={3} title="Sign out & operation note" subtitle="Before the patient leaves theatre">
        <Done entry={surgery.checklist?.signOut} at={surgery.signOutAt} />
        <dl className="space-y-2 text-sm">
          {[['Procedure', surgery.procedurePerformed], ['Findings', surgery.findings], ['Complications', surgery.complications || 'None recorded'], ['Blood loss', surgery.bloodLossMl != null ? `${surgery.bloodLossMl} ml` : null], ['Specimens', surgery.specimens], ['Post-op plan', surgery.postOpPlan]]
            .filter(([, v]) => v)
            .map(([k, v]) => <div key={k}><dt className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{k}</dt><dd className="whitespace-pre-wrap text-slate-800">{v}</dd></div>)}
        </dl>
      </StepCard>
    );
  }
  if (surgery.status !== 'IN_THEATRE' || !surgery.timeOutAt) {
    return <StepCard number={3} title="Sign out & operation note" subtitle="Before the patient leaves theatre"><p className="text-sm text-slate-500">{surgery.status === 'CANCELLED' ? 'Not done.' : 'After time out.'}</p></StepCard>;
  }
  if (!can(auth, TP.OPERATE)) {
    return <StepCard number={3} title="Sign out & operation note" subtitle="Before the patient leaves theatre"><p className="text-sm text-slate-500">Operation in progress. The surgeon records the sign out and the operation note.</p></StepCard>;
  }
  const ready = a.procedureRecorded && a.countsCorrect && note.procedurePerformed.trim().length >= 3 && note.findings.trim().length >= 3 && note.postOpPlan.trim().length >= 3;
  function submit() {
    act(() => theatreService.complete(apiClient, surgery.id, {
      answers: { ...a, equipmentProblems: a.equipmentProblems.trim() || undefined, recoveryConcerns: a.recoveryConcerns.trim() || undefined },
      procedurePerformed: note.procedurePerformed.trim(),
      findings: note.findings.trim(),
      complications: note.complications.trim() || undefined,
      bloodLossMl: note.bloodLossMl === '' ? undefined : Number(note.bloodLossMl),
      specimens: note.specimens.trim() || undefined,
      postOpPlan: note.postOpPlan.trim()
    }), 'Operation recorded and added to the clinical record.');
  }
  return (
    <StepCard number={3} title="Sign out & operation note" subtitle="Before the patient leaves theatre">
      <FormField label="Procedure performed" required><input className={inputClass} value={note.procedurePerformed} onChange={setN('procedurePerformed')} maxLength={300} /></FormField>
      <FormField label="Findings" required><textarea rows={3} className={inputClass} value={note.findings} onChange={setN('findings')} maxLength={5000} /></FormField>
      <FormField label="Complications"><input className={inputClass} value={note.complications} onChange={setN('complications')} maxLength={2000} placeholder="None" /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Estimated blood loss (ml)"><input type="number" min="0" className={inputClass} value={note.bloodLossMl} onChange={setN('bloodLossMl')} /></FormField>
        <FormField label="Specimens"><input className={inputClass} value={note.specimens} onChange={setN('specimens')} maxLength={500} /></FormField>
      </div>
      <FormField label="Post-operative plan" required><textarea rows={3} className={inputClass} value={note.postOpPlan} onChange={setN('postOpPlan')} maxLength={3000} /></FormField>
      <Check label="Name of the procedure recorded" checked={a.procedureRecorded} onChange={set('procedureRecorded')} />
      <Check label="Instrument, sponge and needle counts are correct" checked={a.countsCorrect} onChange={set('countsCorrect')} />
      <Choice label="Specimens labelled with the patient's name" value={a.specimensLabelled} onChange={set('specimensLabelled')} options={[['YES', 'Yes'], ['NOT_APPLICABLE', 'No specimens']]} />
      <FormField label="Equipment problems to address"><input className={inputClass} value={a.equipmentProblems} onChange={(e) => set('equipmentProblems')(e.target.value)} maxLength={300} /></FormField>
      <FormField label="Key concerns for recovery"><input className={inputClass} value={a.recoveryConcerns} onChange={(e) => set('recoveryConcerns')(e.target.value)} maxLength={500} /></FormField>
      <Button variant="success" disabled={busy || !ready} onClick={submit}><Scissors className="h-4 w-4" /> Sign out and save note</Button>
    </StepCard>
  );
}

const toLocalInput = (value) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function RebookModal({ open, surgery, onClose, onSaved }) {
  const [theatres, setTheatres] = useState([]);
  const [form, setForm] = useState({ theatreId: '', start: '', durationMinutes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm({ theatreId: surgery.theatre.id, start: toLocalInput(surgery.scheduledStart), durationMinutes: String(Math.round((new Date(surgery.scheduledEnd) - new Date(surgery.scheduledStart)) / 60000)) });
    setError('');
    theatreService.theatres(apiClient).then((data) => setTheatres(listItems(data).filter((t) => t.isActive))).catch(() => setTheatres([]));
  }, [open, surgery]);
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  async function save() {
    setSaving(true);
    setError('');
    try {
      onSaved(await theatreService.reschedule(apiClient, surgery.id, { theatreId: form.theatreId, scheduledStart: new Date(form.start).toISOString(), durationMinutes: Number(form.durationMinutes) }));
    } catch (e) {
      setError(e?.message || 'The operation could not be rebooked.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} title="Rebook operation" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!form.start || Number(form.durationMinutes) < 10 || saving} onClick={save}>{saving ? 'Saving…' : 'Rebook'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Theatre">
          <select className={inputClass} value={form.theatreId} onChange={set('theatreId')}>
            {theatres.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormField>
        <FormField label="Start"><input type="datetime-local" className={inputClass} value={form.start} onChange={set('start')} /></FormField>
        <FormField label="Expected duration (minutes)"><input type="number" min="10" step="5" className={inputClass} value={form.durationMinutes} onChange={set('durationMinutes')} /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}

function NewTheatreModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ code: '', name: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ code: '', name: '' });
      setError('');
    }
  }, [open]);
  async function save() {
    setSaving(true);
    setError('');
    try {
      await theatreService.createTheatre(apiClient, { code: form.code.trim(), name: form.name.trim() });
      onSaved();
    } catch (e) {
      setError(e?.message || 'The theatre could not be created.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} title="New theatre" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={form.code.trim().length < 2 || form.name.trim().length < 2 || saving} onClick={save}>{saving ? 'Saving…' : 'Create theatre'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code" required><input className={`${inputClass} uppercase`} value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))} maxLength={20} placeholder="OBS" /></FormField>
        <FormField label="Name" required><input className={inputClass} value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Obstetric Theatre" /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}
