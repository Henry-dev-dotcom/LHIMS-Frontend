import { useEffect, useState } from 'react';
import { AlertTriangle, BedDouble, Droplets, Home, Scissors, Send, Skull } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FormField, inputClass } from '../../components/ui/FormField';
import { ChargesCard } from '../opd/EncounterWorkspace';
import { MembershipCard } from '../claims/MembershipCard';

/*
  Tab 4: disposition - where the patient goes when this visit ends.

  Choosing here does not end anything; the routing bar does. This tab gathers the
  decision, the follow-up words the patient will be given, and shows what completing the
  visit will do, so nothing is a surprise when the button is pressed.
*/

export const DISPOSITIONS = [
  { id: 'DISCHARGED', label: 'Discharge home', hint: 'The patient goes home with the instructions below.', icon: Home },
  { id: 'ADMITTED', label: 'Admit to ward', hint: 'Opens a bed. Your diagnoses carry over to the stay.', icon: BedDouble },
  { id: 'REFERRED', label: 'Refer', hint: 'The patient is sent on to another facility or specialist.', icon: Send },
  { id: 'DECEASED', label: 'Patient died', hint: 'Records the death and closes the visit.', icon: Skull }
];

/** The discharge summary the record keeps: the referral, then the follow-up instructions. */
export function buildSummary(draft) {
  const referral = draft.disposition === 'REFERRED' && draft.referralTo?.trim()
    ? `Referred to ${draft.referralTo.trim()}${draft.referralReason?.trim() ? `: ${draft.referralReason.trim()}` : ''}.`
    : '';
  const followUp = draft.followUp?.trim() ? `Follow-up: ${draft.followUp.trim()}` : '';
  return [referral, followUp].filter(Boolean).join('\n\n');
}

export function DispositionTab({ encounter, auth, open, busy, draft, updateDraft, canAdmit, canBookSurgery, canRequestBlood, onAdmit, onSurgery, onBlood, readyMedicines }) {
  const disposition = draft.disposition || 'DISCHARGED';
  const issued = (encounter.prescriptions || []).reduce((sum, rx) => sum + rx.items.length, 0);
  const outstanding = encounter.tests?.outstanding?.length || 0;
  const stagedTests = (draft.stagedTestIds || []).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-4">
        <Card title="What happens to this patient" subtitle="Choose the route, then finish from the bar below.">
          <div role="radiogroup" aria-label="Disposition" className="grid gap-2 sm:grid-cols-2">
            {DISPOSITIONS.map(({ id, label, hint, icon: Icon }) => {
              const selected = disposition === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!open}
                  onClick={() => updateDraft({ disposition: id })}
                  className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-50 ${selected ? (id === 'DECEASED' ? 'border-slate-700 bg-slate-100' : 'border-clinical-500 bg-clinical-25 ring-2 ring-clinical-200') : 'border-slate-200 bg-white hover:border-clinical-300'}`}
                >
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-clinical-700' : 'text-slate-400'}`} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-600">{hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {disposition === 'ADMITTED' && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-3">
              <p className="text-sm text-slate-700">Choose the ward and bed. Admitting closes this visit.</p>
              <Button className="mt-2" variant="secondary" disabled={busy || !canAdmit} onClick={onAdmit}><BedDouble className="h-4 w-4" /> Choose ward and bed</Button>
              {!canAdmit && <p className="mt-2 text-xs font-semibold text-amber-800">Admission is not available here: the ward module is off, the consultation has not started, or your role cannot admit.</p>}
            </div>
          )}

          {disposition === 'REFERRED' && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FormField label="Referred to" help="Facility or specialist">
                <input className={inputClass} value={draft.referralTo || ''} maxLength={200} onChange={(e) => updateDraft({ referralTo: e.target.value })} />
              </FormField>
              <FormField label="Reason for referral">
                <input className={inputClass} value={draft.referralReason || ''} maxLength={400} onChange={(e) => updateDraft({ referralReason: e.target.value })} />
              </FormField>
            </div>
          )}

          <div className="mt-4">
            <FormField label="Follow-up instructions" help="Given to the patient and kept with the discharge summary.">
              <textarea rows={5} className={inputClass} value={draft.followUp || ''} maxLength={4000} disabled={!open} onChange={(e) => updateDraft({ followUp: e.target.value })} placeholder="When to return, warning signs, tests to bring, medicines to finish…" />
            </FormField>
          </div>
        </Card>

        <Card title="Other requests" subtitle="These do not end the visit.">
          <div className="flex flex-wrap gap-2">
            {canBookSurgery && <Button variant="secondary" disabled={busy} onClick={onSurgery}><Scissors className="h-4 w-4" /> Book operation</Button>}
            {canRequestBlood && <Button variant="secondary" disabled={busy} onClick={onBlood}><Droplets className="h-4 w-4" /> Request blood</Button>}
            {!canBookSurgery && !canRequestBlood && <p className="text-sm text-slate-500">Nothing else is available for this visit.</p>}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="When you finish" subtitle="What the button below will do.">
          <ul className="space-y-2 text-sm text-slate-800">
            <li>{disposition === 'ADMITTED' ? 'Opens an admission and closes this visit.' : `Closes this visit as ${DISPOSITIONS.find((d) => d.id === disposition).label.toLowerCase()}.`}</li>
            <li>{readyMedicines > 0 ? `${readyMedicines} medicine${readyMedicines === 1 ? '' : 's'} will be sent to the pharmacy.` : issued > 0 ? `${issued} medicine${issued === 1 ? ' has' : 's have'} already gone to the pharmacy.` : 'No medicines are prescribed.'}</li>
            <li>The visit charges below go to billing.</li>
            {(encounter.diagnoses?.length || 0) === 0 && <li className="flex items-start gap-1.5 font-semibold text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Record at least one diagnosis first.</li>}
            {stagedTests > 0 && <li className="flex items-start gap-1.5 font-semibold text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {stagedTests} test{stagedTests === 1 ? ' is' : 's are'} waiting to be sent. Send or remove {stagedTests === 1 ? 'it' : 'them'} first.</li>}
            {outstanding > 0 && <li className="flex items-start gap-1.5 font-semibold text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {outstanding} test{outstanding === 1 ? ' is' : 's are'} still out. The results will reach the record when they are ready.</li>}
          </ul>
        </Card>
        <MembershipCard patient={encounter.patient} auth={auth} />
        <ChargesCard encounter={encounter} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ dialogs */

/** Asks why a medicine is being prescribed despite a recorded allergy. Resolves with the reason, or null. */
export function AllergyOverrideModal({ prompt, onResolve }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (prompt) setReason('');
  }, [prompt]);
  const valid = reason.trim().length >= 5;
  return (
    <Modal
      open={Boolean(prompt)}
      title="Allergy warning"
      description="The patient has a recorded allergy that matches a medicine on this prescription."
      onClose={() => onResolve(null)}
      footer={(
        <>
          <Button variant="secondary" onClick={() => onResolve(null)}>Do not prescribe</Button>
          <Button variant="danger" disabled={!valid} onClick={() => onResolve(reason.trim())}>Prescribe anyway</Button>
        </>
      )}
    >
      <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{prompt?.message}</p>
      <div className="mt-4">
        <FormField label="Reason for prescribing anyway" required help="At least 5 characters. This is recorded against the prescription.">
          <textarea rows={3} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </FormField>
      </div>
    </Modal>
  );
}

/** The last look before a visit is closed. */
export function CompleteConfirmModal({ open, onClose, onConfirm, busy, disposition, summary, readyMedicines, hasDiagnosis, blocker }) {
  const label = DISPOSITIONS.find((d) => d.id === disposition)?.label || 'Discharge home';
  return (
    <Modal
      open={open}
      title="Complete this visit"
      description="The visit becomes read-only once completed."
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Not yet</Button>
          <Button variant="success" disabled={busy || !hasDiagnosis || Boolean(blocker)} onClick={onConfirm}>Complete visit</Button>
        </>
      )}
    >
      <div className="space-y-3 text-sm text-slate-800">
        {!hasDiagnosis && <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 font-semibold text-amber-900">Record at least one diagnosis first.</p>}
        {blocker && <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 font-semibold text-amber-900">{blocker}</p>}
        <p><span className="font-semibold">Outcome:</span> {label}</p>
        <p><span className="font-semibold">Pharmacy:</span> {readyMedicines > 0 ? `${readyMedicines} medicine${readyMedicines === 1 ? '' : 's'} will be sent now.` : 'Nothing further to send.'}</p>
        {summary && <p className="whitespace-pre-wrap rounded-2xl bg-slate-50 px-4 py-3"><span className="font-semibold">Discharge summary:</span>{'\n'}{summary}</p>}
      </div>
    </Modal>
  );
}
