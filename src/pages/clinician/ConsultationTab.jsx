import { useRef, useState } from 'react';
import { ClipboardList, Mic, MicOff } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { inputClass } from '../../components/ui/FormField';
import { formatDateTime } from '../../utils/formatters';
import { AllergiesCard, DiagnosesCard, VitalsCard } from '../opd/EncounterWorkspace';
import { PregnancyCard } from '../maternity/PregnancyCard';
import { ImmunizationCard } from '../childHealth/ImmunizationCard';
import { ClinicalFormsCard } from '../clinics/ClinicalFormsCard';
import { P, can } from '../opd/opdUtils';
import { NOTE_TEMPLATES } from './clinicalContent';
import { acknowledgeDictation, dictationAcknowledged, dictationSupported, useDictation } from './useDictation';

/*
  Tab 1: consultation and diagnosis.

  The history, examination, assessment and plan are written here as a draft that is
  saved as the clinician types. They become a permanent, signed note when the clinician
  saves it, sends the patient for tests, or completes the visit - notes cannot be edited
  once saved, so what is typed here stays freely changeable until then.
*/

const FIELDS = [
  ['subjective', 'Subjective (history)', 'What the patient reports'],
  ['objective', 'Objective (examination)', 'What you find'],
  ['assessment', 'Assessment', 'Your impression'],
  ['plan', 'Plan', 'What happens next']
];

/** Adds dictated words to a field: a new sentence starts with a capital, and words are separated by a space. */
function appendSpoken(existing, spoken) {
  const text = existing || '';
  const atStart = text === '' || /[\n]$/.test(text) || /[.!?]\s*$/.test(text);
  const piece = atStart ? spoken.charAt(0).toUpperCase() + spoken.slice(1) : spoken;
  if (text === '' || /\s$/.test(text)) return text + piece;
  return `${text} ${piece}`;
}

export function ConsultationTab({ encounter, auth, open, busy, act, draft, updateDraft, saveNote, latestVitals }) {
  const canWrite = open && can(auth, P.CONSULT);
  const [acknowledged, setAcknowledged] = useState(dictationAcknowledged);
  const [activeField, setActiveField] = useState('');
  const activeRef = useRef('');

  const dictation = useDictation({
    onText: (spoken) => {
      const key = activeRef.current;
      if (key) updateDraft((prev) => ({ [key]: appendSpoken(prev[key], spoken) }));
    }
  });

  function toggleMic(key) {
    if (dictation.listening && activeRef.current === key) {
      dictation.stop();
      activeRef.current = '';
      setActiveField('');
      return;
    }
    activeRef.current = key;
    setActiveField(key);
    dictation.start();
  }

  function insertTemplate(id) {
    const template = NOTE_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    // Into empty fields directly; below whatever is already written otherwise, so nothing is lost.
    updateDraft((prev) => Object.fromEntries(FIELDS.map(([key]) => [key, prev[key]?.trim() ? `${prev[key].trimEnd()}\n\n${template.note[key]}` : template.note[key]])));
  }

  const empty = FIELDS.every(([key]) => !draft[key]?.trim());

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-4">
        <Card title="Clinical notes" subtitle="Saved as you type. They join the record when you save them, send the patient for tests, or complete the visit.">
          {canWrite ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  <span className="sr-only">Insert a template</span>
                  <select
                    className={`${inputClass} w-64`}
                    value=""
                    onChange={(e) => insertTemplate(e.target.value)}
                    aria-label="Insert a template"
                  >
                    <option value="">Insert a template…</option>
                    {NOTE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
                {dictationSupported() && (
                  <span className={`text-xs font-semibold ${dictation.listening ? 'text-red-600' : 'text-slate-500'}`} aria-live="polite">
                    {dictation.listening ? `Listening… ${dictation.interim}` : 'Dictation ready'}
                  </span>
                )}
              </div>

              {dictationSupported() && !acknowledged && (
                <div role="note" className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                  <p className="font-semibold">Before you use voice dictation</p>
                  <p className="mt-1">It uses your browser&apos;s speech service. In Chrome and Edge the browser sends what you say to its maker to turn it into text, so patient details spoken aloud leave this building. Use it only where your facility allows that.</p>
                  <Button size="sm" className="mt-2" onClick={() => { acknowledgeDictation(); setAcknowledged(true); }}>I understand, turn dictation on</Button>
                </div>
              )}
              {dictation.error && <p role="alert" className="text-sm font-semibold text-red-600">{dictation.error}</p>}

              {FIELDS.map(([key, label, hint]) => (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor={`note-${key}`} className="text-sm font-semibold text-slate-700">{label}</label>
                    {dictationSupported() && (
                      <button
                        type="button"
                        disabled={!acknowledged}
                        onClick={() => toggleMic(key)}
                        aria-pressed={dictation.listening && activeField === key}
                        aria-label={`${dictation.listening && activeField === key ? 'Stop dictating' : 'Dictate'} ${label}`}
                        title={acknowledged ? 'Dictate' : 'Acknowledge the notice above to use dictation'}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${dictation.listening && activeField === key ? 'bg-red-600 text-white motion-safe:animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        {dictation.listening && activeField === key ? <MicOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}
                        {dictation.listening && activeField === key ? 'Stop' : 'Dictate'}
                      </button>
                    )}
                  </div>
                  <textarea
                    id={`note-${key}`}
                    rows={key === 'subjective' || key === 'objective' ? 6 : 4}
                    className={inputClass}
                    value={draft[key] || ''}
                    placeholder={hint}
                    maxLength={5000}
                    onChange={(e) => updateDraft({ [key]: e.target.value })}
                  />
                </div>
              ))}
              <Button variant="secondary" disabled={busy || empty} onClick={saveNote}><ClipboardList className="h-4 w-4" /> Save note to the record</Button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{open ? 'Only clinicians can write consultation notes.' : 'This visit is closed, so its notes are read-only.'}</p>
          )}
        </Card>

        <Card title="Notes on this visit" subtitle="Saved notes cannot be edited; add a new note to correct one.">
          <ul className="space-y-3">
            {encounter.notes?.length ? [...encounter.notes].reverse().map((n) => (
              <li key={n.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{n.type.toLowerCase()} · {n.author?.name || 'Unknown'} · {formatDateTime(n.createdAt)}{n.amendsId ? ' · correction' : ''}</p>
                {[['S', n.subjective], ['O', n.objective], ['A', n.assessment], ['P', n.plan]].filter(([, v]) => v).map(([k, v]) => (
                  <p key={k} className="mt-1 whitespace-pre-wrap text-slate-800"><span className="font-bold">{k}:</span> {v}</p>
                ))}
              </li>
            )) : <li className="text-sm text-slate-500">No notes saved yet.</li>}
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <DiagnosesCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} />
        <details className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">Record vitals</summary>
          <div className="mt-3"><VitalsCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} latest={latestVitals} /></div>
        </details>
        <details className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">Record an allergy</summary>
          <div className="mt-3"><AllergiesCard encounter={encounter} auth={auth} busy={busy} act={act} /></div>
        </details>
        <PregnancyCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} />
        <ImmunizationCard encounter={encounter} auth={auth} open={open} />
        <ClinicalFormsCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} />
      </div>
    </div>
  );
}
