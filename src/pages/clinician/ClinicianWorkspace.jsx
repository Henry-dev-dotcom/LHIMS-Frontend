import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, BedDouble, CheckCircle2, FlaskConical, History, PauseCircle, Stethoscope } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';
import { AdmitFromVisitModal, vitalsSummary } from '../opd/EncounterWorkspace';
import { isAllergyConflict } from '../../services/pharmacyService';
import { RequestBloodModal } from '../bloodBank/BloodBankPage';
import { BookSurgeryModal } from '../theatre/BookSurgeryModal';
import { P, STATUS, TRIAGE, ageLabel, can, patientName } from '../opd/opdUtils';
import { formatDateTime } from '../../utils/formatters';
import { cleanNoteText } from './clinicalContent';
import { ConsultationTab } from './ConsultationTab';
import { InvestigationsTab } from './InvestigationsTab';
import { QuickPeek } from './QuickPeek';
import { PrescriptionsTab, lineIsBlank, lineIsComplete, toPrescriptionItem } from './PrescriptionsTab';
import { AllergyOverrideModal, CompleteConfirmModal, DispositionTab, buildSummary } from './DispositionTab';

/*
  The consultation workspace: three clinical work areas and a deliberate finish-visit step.

  Everything the clinician needs comes to this screen - they never go looking for labs or
  prescriptions in other modules. What they type is a draft that saves itself, and only
  becomes part of the permanent record when they save it, send the patient for tests, or
  complete the visit.

  The bottom bar shows autosave status and routes the patient to the next step.
    Send to Diagnostics & Suspend sends staged tests, parks the visit, and returns to the queue
    Complete & Discharge closes the visit
*/

const TABS = [
  { id: 'consultation', label: 'Visit' },
  { id: 'investigations', label: 'Tests & Results' },
  { id: 'prescriptions', label: 'Medicines' }
];

const EMPTY_DRAFT = {
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  stagedTestIds: [],
  urgency: 'ROUTINE',
  rxLines: [],
  disposition: 'DISCHARGED',
  followUp: '',
  referralTo: '',
  referralReason: ''
};
const AUTOSAVE_MS = 1200;
const NOTE_KEYS = ['subjective', 'objective', 'assessment', 'plan'];

export function ClinicianWorkspace({ encounterId, onClose, initialTab = 'consultation' }) {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [encounter, setEncounter] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [finishOpen, setFinishOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [surgeryOpen, setSurgeryOpen] = useState(false);
  const [bloodOpen, setBloodOpen] = useState(false);
  const [overridePrompt, setOverridePrompt] = useState(null);
  const overrideResolver = useRef(null);

  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftReady, setDraftReady] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [draftSaveState, setDraftSaveState] = useState('idle');
  const draftRef = useRef(EMPTY_DRAFT);
  const dirty = useRef(false);
  const draftVersion = useRef(0);
  const draftSaveInFlight = useRef(false);
  const timer = useRef(null);
  const closed = useRef(false);

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

  /** Runs a write, shows the result, and keeps the screen in step with the server's view of the visit. */
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

  const open = encounter ? ['WAITING_TRIAGE', 'WAITING_DOCTOR', 'IN_CONSULTATION'].includes(encounter.status) : false;
  closed.current = encounter ? !open : false;

  /* ----------------------------------------------------------------- draft */

  // Pick up where the clinician left off.
  useEffect(() => {
    let live = true;
    encounterService.getDraft(apiClient, encounterId)
      .then((res) => {
        if (!live) return;
        if (res?.data) {
          const restored = { ...EMPTY_DRAFT, ...res.data };
          draftRef.current = restored;
          setDraft(restored);
          if (res.updatedAt) setSavedAt(new Date(res.updatedAt));
        }
      })
      .catch(() => {})
      .finally(() => live && setDraftReady(true));
    return () => {
      live = false;
    };
  }, [encounterId]);

  const saveDraftNow = useCallback(async ({ quiet = true } = {}) => {
    window.clearTimeout(timer.current);
    if (closed.current || !dirty.current || draftSaveInFlight.current) return true;
    const versionAtStart = draftVersion.current;
    let savedThisVersion = false;
    draftSaveInFlight.current = true;
    setDraftSaveState('saving');
    try {
      const res = await encounterService.saveDraft(apiClient, encounterId, draftRef.current);
      savedThisVersion = true;
      setSavedAt(res?.updatedAt ? new Date(res.updatedAt) : new Date());
      if (draftVersion.current === versionAtStart) {
        dirty.current = false;
        setDraftSaveState('saved');
        if (!quiet) toast('success', 'Draft saved.');
      } else {
        // A newer edit arrived while this snapshot was being saved. Keep the status
        // honest and let the latest version save after the debounce interval.
        setDraftSaveState('saving');
      }
      return true;
    } catch (e) {
      setDraftSaveState('error');
      if (!quiet) toast('error', e?.message || 'The draft could not be saved.');
      return false;
    } finally {
      draftSaveInFlight.current = false;
      if (savedThisVersion && draftVersion.current !== versionAtStart && dirty.current && !closed.current) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => saveDraftNow(), AUTOSAVE_MS);
      }
    }
  }, [encounterId, toast]);

  const updateDraft = useCallback((patch) => {
    // The ref is the truth and is updated at once: anything that saves straight after a change
    // (sending tests, leaving the screen) must see that change, not wait for React to render it.
    const base = draftRef.current;
    const next = { ...base, ...(typeof patch === 'function' ? patch(base) : patch) };
    draftRef.current = next;
    setDraft(next);
    dirty.current = true;
    draftVersion.current += 1;
    setDraftSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => saveDraftNow(), AUTOSAVE_MS);
  }, [saveDraftNow]);

  // Leaving the screen any way at all must not lose typing.
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    if (dirty.current && !closed.current) encounterService.saveDraft(apiClient, encounterId, draftRef.current).catch(() => {});
  }, [encounterId]);

  const leave = useCallback(async () => {
    await saveDraftNow();
    onClose();
  }, [onClose, saveDraftNow]);

  /* --------------------------------------------------------------- actions */

  /** Turns the typed notes into a permanent note. Resolves true when there was nothing to save, or it saved. */
  const saveNote = useCallback(async () => {
    const payload = {};
    for (const key of NOTE_KEYS) {
      const text = cleanNoteText(draftRef.current[key]);
      if (text) payload[key] = text;
    }
    if (Object.keys(payload).length === 0) return true;
    const ok = await act(() => encounterService.addNote(apiClient, encounterId, payload), 'Note saved to the record.');
    if (ok) updateDraft({ subjective: '', objective: '', assessment: '', plan: '' });
    return ok;
  }, [act, encounterId, updateDraft]);

  const sendOrdersNow = useCallback(async () => {
    const ids = draftRef.current.stagedTestIds || [];
    if (ids.length === 0) return true;
    const ok = await act(
      () => encounterService.order(apiClient, encounterId, { items: ids.map((id) => ({ catalogItemId: id })), urgency: draftRef.current.urgency || 'ROUTINE' }),
      'Sent to the laboratory and imaging queues.'
    );
    if (ok) updateDraft({ stagedTestIds: [] });
    return ok;
  }, [act, encounterId, updateDraft]);

  /** Send to Diagnostics & Suspend: save the note, send staged tests, park the visit and go back to the queue. */
  const sendToLab = useCallback(async () => {
    setFlow(true);
    try {
      if (!(await saveNote())) return;
      if (!(await sendOrdersNow())) return;
      try {
        await encounterService.suspend(apiClient, encounterId);
      } catch (e) {
        toast('error', e?.message || 'The visit could not be paused.');
        await load();
        return;
      }
      setSuspendOpen(false);
      await saveDraftNow();
      toast('success', `${patientName(encounter.patient)} has been sent for diagnostic tests and is under Pending Diagnosis.`);
      onClose();
    } finally {
      setFlow(false);
    }
  }, [encounter, encounterId, load, onClose, saveDraftNow, saveNote, sendOrdersNow, toast]);

  /** Asks, in a dialog, why a medicine is going ahead despite a recorded allergy. Resolves with the reason, or null. */
  const askOverride = useCallback((message) => new Promise((resolve) => {
    overrideResolver.current = resolve;
    setOverridePrompt({ message });
  }), []);
  const resolveOverride = useCallback((reason) => {
    setOverridePrompt(null);
    overrideResolver.current?.(reason);
    overrideResolver.current = null;
  }, []);

  /** Sends the medicines waiting on the Prescriptions tab to the pharmacy. Resolves true when there was nothing to send, or it sent. */
  const issuePrescription = useCallback(async () => {
    const lines = (draftRef.current.rxLines || []).filter((l) => !lineIsBlank(l));
    if (lines.length === 0) return true;
    if (!lines.every(lineIsComplete)) {
      toast('error', 'Finish every medicine (name, dose, route and how often) or remove it before sending.');
      return false;
    }
    const items = lines.map(toPrescriptionItem);
    const ok = await act(async () => {
      try {
        return await encounterService.prescribe(apiClient, encounterId, { items });
      } catch (error) {
        // A recorded allergy blocks the prescription unless the prescriber gives a reason.
        if (!isAllergyConflict(error)) throw error;
        const reason = await askOverride(error.message);
        if (!reason) throw new Error('Prescription not issued: an allergy needs a reason to go ahead, or the medicine has to change.');
        return encounterService.prescribe(apiClient, encounterId, { items, allergyOverrideReason: reason });
      }
    }, 'Prescription sent to the pharmacy.');
    if (ok) updateDraft({ rxLines: [] });
    return ok;
  }, [act, askOverride, encounterId, toast, updateDraft]);

  /** Admitting closes the visit, so the note goes in first and nothing may be left half-sent. */
  const openAdmit = useCallback(async () => {
    const staged = (draftRef.current.stagedTestIds || []).length;
    if (staged > 0) {
      toast('error', `${staged} test${staged === 1 ? ' is' : 's are'} waiting to be sent. Send ${staged === 1 ? 'it' : 'them'} from Investigations, or remove ${staged === 1 ? 'it' : 'them'}, before admitting.`);
      return;
    }
    if (!(await saveNote())) return;
    if (!(await issuePrescription())) return;
    setAdmitOpen(true);
  }, [issuePrescription, saveNote, toast]);

  const resume = useCallback(() => act(() => encounterService.resume(apiClient, encounterId), 'Consultation resumed.'), [act, encounterId]);

  if (error) return <Card><p role="alert" className="text-sm font-semibold text-red-600">{error}</p><Button className="mt-3" variant="secondary" onClick={onClose}>Back to queue</Button></Card>;
  if (!encounter || !draftReady) return <Card><p className="text-sm text-slate-500">Loading visit…</p></Card>;

  const patient = encounter.patient;
  const latest = encounter.vitalSigns?.[0];
  const inConsult = encounter.status === 'IN_CONSULTATION';
  const paused = Boolean(encounter.suspendedAt);
  const canConsult = can(auth, P.CONSULT);
  const modules = auth?.modules || [];
  const stagedCount = (draft.stagedTestIds || []).length;
  const outstanding = encounter.tests?.outstanding?.length || 0;
  const canAdmit = inConsult && encounter.type !== 'INPATIENT' && can(auth, 'inpatient:admit') && modules.includes('inpatient');
  const canRequestBlood = open && can(auth, 'bloodbank:request') && (!Array.isArray(modules) || modules.includes('blood_bank'));
  const canBookSurgery = open && can(auth, 'theatre:schedule') && modules.includes('theatre');
  const hasNoteText = NOTE_KEYS.some((key) => cleanNoteText(draft[key]));
  const disposition = draft.disposition || 'DISCHARGED';
  const medicineLines = (draft.rxLines || []).filter((l) => !lineIsBlank(l));
  const readyMedicines = medicineLines.length;
  // Anything that would be silently lost or half-sent stops the visit being closed, and says why.
  const completeBlocker = stagedCount > 0
    ? `${stagedCount} test${stagedCount === 1 ? ' is' : 's are'} waiting to be sent. Send ${stagedCount === 1 ? 'it' : 'them'} from Investigations, or remove ${stagedCount === 1 ? 'it' : 'them'}, first.`
    : medicineLines.some((l) => !lineIsComplete(l))
      ? 'A medicine on the Prescriptions tab is unfinished. Complete it or remove it first.'
      : '';

  const commonTabProps = { encounter, auth, open, busy: busy || flow, act, draft, updateDraft };

  return (
    <div className="space-y-4">
      {/* Patient band: who this is, and what a clinician must not miss. */}
      <header className="rounded-2xl bg-[#09101a] p-4 text-white shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button type="button" onClick={leave} aria-label="Back to queue" className="mt-0.5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Queue</span>
            </button>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{patientName(patient)}</h2>
              <p className="text-xs text-slate-400">
                {[ageLabel(patient.dateOfBirth), patient.gender, patient.patientCode, encounter.encounterCode].filter(Boolean).join(' • ')}
              </p>
              {encounter.chiefComplaint && <p className="mt-1 text-sm text-slate-200"><span className="font-semibold">Complaint:</span> {encounter.chiefComplaint}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {encounter.triageLevel && <span className={`rounded-full px-3 py-1 text-xs font-bold ${TRIAGE[encounter.triageLevel].className}`}>{TRIAGE[encounter.triageLevel].label}</span>}
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">{paused ? (encounter.queueState === 'REVIEW_READY' ? 'Results ready' : 'Paused for results') : STATUS[encounter.status]}</span>
            <button
              type="button"
              onClick={() => setPeek((v) => !v)}
              aria-pressed={peek}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${peek ? 'bg-[#1ce7d6] text-slate-900' : 'bg-white/10 text-slate-100 hover:bg-white/20'}`}
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" /> History
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-200" aria-label="Latest vitals"><span className="font-semibold text-slate-400">Vitals:</span> {vitalsSummary(latest)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {patient.allergies?.length ? patient.allergies.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Allergy: {a.substance}{a.reaction ? ` (${a.reaction})` : ''}
            </span>
          )) : <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">No known allergies recorded</span>}
          {patient.diagnoses?.map((d) => <span key={d.id} className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-950">{d.code ? `${d.code} ` : ''}{d.description}</span>)}
        </div>
      </header>

      {open && !inConsult && canConsult && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-semibold text-sky-950">This patient has not been taken into consultation yet.</p>
          <Button size="sm" disabled={busy} onClick={() => act(() => encounterService.startConsultation(apiClient, encounter.id), 'Consultation started.')}><Stethoscope className="h-4 w-4" /> Start consultation</Button>
        </div>
      )}

      {paused && open && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-yellow-900">
            <PauseCircle className="h-4 w-4" aria-hidden="true" />
            {encounter.queueState === 'REVIEW_READY'
              ? `All ${encounter.tests.total} test${encounter.tests.total === 1 ? ' is' : 's are'} back. Review the results, then complete the visit.`
              : `Paused for results · ${encounter.tests.ready} of ${encounter.tests.total} back. You can carry on without waiting.`}
          </p>
          {canConsult && <Button size="sm" disabled={busy} onClick={resume}>Resume consultation</Button>}
        </div>
      )}

      {!open && (
        <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          This visit is {STATUS[encounter.status].toLowerCase()}{encounter.outcome ? ` (${encounter.outcome.toLowerCase().replace(/_/g, ' ')})` : ''}{encounter.cancelReason ? `: ${encounter.cancelReason}` : ''}. It is read-only.
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          {finishOpen ? (
            <section aria-labelledby="finish-visit-heading" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-clinical-700">Final step</p>
                  <h3 id="finish-visit-heading" className="text-lg font-bold text-slate-900">Finish visit</h3>
                </div>
                <Button variant="secondary" onClick={() => setFinishOpen(false)}>Back to visit</Button>
              </div>
              <DispositionTab
                {...commonTabProps}
                canAdmit={canAdmit}
                canBookSurgery={canBookSurgery}
                canRequestBlood={canRequestBlood}
                onAdmit={openAdmit}
                onSurgery={() => setSurgeryOpen(true)}
                onBlood={() => setBloodOpen(true)}
                readyMedicines={readyMedicines}
              />
            </section>
          ) : (
            <>
              <div role="tablist" aria-label="Visit workspace" className="flex flex-wrap gap-1 border-b border-slate-200">
                {TABS.map((item) => {
                  const selected = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      id={`workspace-tab-${item.id}`}
                      aria-selected={selected}
                      aria-controls="workspace-panel"
                      onClick={() => setTab(item.id)}
                      className={`flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${selected ? 'border-clinical-500 text-clinical-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                      {item.label}
                      {item.id === 'investigations' && stagedCount > 0 && <span className="rounded-full bg-clinical-600 px-2 py-0.5 text-xs font-bold text-white" aria-label={`${stagedCount} waiting to be sent`}>{stagedCount}</span>}
                    </button>
                  );
                })}
              </div>

              <div id="workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${tab}`}>
                {tab === 'consultation' && <ConsultationTab {...commonTabProps} saveNote={saveNote} latestVitals={latest} />}
                {tab === 'investigations' && <InvestigationsTab {...commonTabProps} sendOrdersNow={sendOrdersNow} />}
                {tab === 'prescriptions' && <PrescriptionsTab {...commonTabProps} issuePrescription={issuePrescription} />}
              </div>
            </>
          )}
        </div>

        {peek && <QuickPeek patientId={patient.id} currentEncounterId={encounter.id} onClose={() => setPeek(false)} />}
      </div>

      {/* The routing bar: where the patient goes next. */}
      {open && canConsult && (
        <div className="sticky bottom-[calc(var(--mobile-bottom-nav-space,6.75rem)+0.5rem)] z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm lg:bottom-2">
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className="text-xs text-slate-600" aria-live="polite">
              {draftSaveState === 'saving' ? 'Saving draft…' : draftSaveState === 'error' ? 'Draft not saved' : savedAt ? `Draft saved ${formatDateTime(savedAt)}` : 'Draft auto-saves as you type'}
            </span>
            {draftSaveState === 'error' && <Button size="sm" variant="ghost" disabled={busy || flow} onClick={() => saveDraftNow({ quiet: false })}>Retry save</Button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {inConsult && !paused && (
              <Button variant="secondary" disabled={busy || flow} onClick={() => setSuspendOpen(true)}><FlaskConical className="h-4 w-4" /> Send to Diagnostics &amp; Suspend</Button>
            )}
            {inConsult && !finishOpen && (
              <Button variant="success" disabled={busy || flow} onClick={() => setFinishOpen(true)}>Finish visit</Button>
            )}
            {inConsult && finishOpen && disposition === 'ADMITTED' && (
              <Button variant="success" disabled={busy || flow || !canAdmit} onClick={openAdmit}><BedDouble className="h-4 w-4" /> Admit to Ward</Button>
            )}
            {inConsult && finishOpen && disposition !== 'ADMITTED' && can(auth, P.COMPLETE) && (
              <Button variant="success" disabled={busy || flow} onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 className="h-4 w-4" /> {disposition === 'REFERRED' ? 'Complete & Refer' : disposition === 'DECEASED' ? 'Complete visit' : 'Complete & Discharge'}
              </Button>
            )}
          </div>
        </div>
      )}

      <Modal
        open={suspendOpen}
        title="Send to Diagnostics & Suspend"
        description="The laboratory and imaging requests go to their queues and this visit is parked under Pending Diagnosis. It comes back to you as Review Ready when the results are in."
        onClose={() => setSuspendOpen(false)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button disabled={flow || (stagedCount === 0 && outstanding === 0)} onClick={sendToLab}><FlaskConical className="h-4 w-4" /> Send and suspend</Button>
          </>
        )}
      >
        <ul className="space-y-1 text-sm text-slate-800">
          <li>{stagedCount > 0 ? `${stagedCount} test${stagedCount === 1 ? '' : 's'} will be sent now.` : 'No new tests are waiting to be sent.'}</li>
          {outstanding > 0 && <li>{outstanding} already sent {outstanding === 1 ? 'is' : 'are'} still outstanding.</li>}
          {hasNoteText && <li>Your notes will be saved to the record.</li>}
        </ul>
        {stagedCount === 0 && outstanding === 0 && <p role="alert" className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Choose at least one laboratory test or imaging scan in Diagnostic Tests first.</p>}
      </Modal>

      <CompleteConfirmModal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        busy={busy || flow}
        disposition={disposition}
        summary={buildSummary(draft)}
        readyMedicines={readyMedicines}
        hasDiagnosis={encounter.diagnoses?.length > 0}
        blocker={completeBlocker}
        onConfirm={async () => {
          setFlow(true);
          try {
            // In the order a clinician would do it by hand: the note, the medicines, then close.
            if (!(await saveNote())) return;
            if (!(await issuePrescription())) return;
            const ok = await act(
              () => encounterService.complete(apiClient, encounter.id, { outcome: disposition, summary: buildSummary(draftRef.current) || undefined }),
              'Visit completed.'
            );
            if (ok) {
              setCompleteOpen(false);
              onClose();
            }
          } finally {
            setFlow(false);
          }
        }}
      />
      <AllergyOverrideModal prompt={overridePrompt} onResolve={resolveOverride} />

      <RequestBloodModal
        open={bloodOpen}
        encounter={encounter}
        onClose={() => setBloodOpen(false)}
        onDone={(request) => {
          setBloodOpen(false);
          toast('success', `Blood requested (${request.requestCode}). Send a grouping and crossmatch sample to the lab.`);
        }}
      />
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
    </div>
  );
}
