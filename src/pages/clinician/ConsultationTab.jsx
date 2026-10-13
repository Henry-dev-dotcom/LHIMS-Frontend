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
import { formatSoapStructureText, noteEditorTextFromSections, noteSectionsFromEditorText } from './noteEditor';
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

function overLimitField(sections) {
  return FIELDS.find(([key]) => String(sections[key] || '').length > 5000);
}

export function ConsultationTab({ encounter, auth, open, busy, act, draft, updateDraft, saveNote, latestVitals }) {
  const canWrite = open && can(auth, P.CONSULT);
  const [acknowledged, setAcknowledged] = useState(dictationAcknowledged);
  const [activeField, setActiveField] = useState('');
  const [editorMode, setEditorMode] = useState('single');
  const [noteLimitError, setNoteLimitError] = useState('');
  const activeRef = useRef('');
  const editorRef = useRef(null);

  const dictation = useDictation({
    onText: (spoken) => {
      const key = activeRef.current;
      if (key === 'single') {
        const currentText = editorRef.current?.value ?? noteEditorTextFromSections(draft);
        const nextSections = noteSectionsFromEditorText(appendSpoken(currentText, spoken));
        const over = overLimitField(nextSections);
        if (over) {
          setNoteLimitError(`${over[1]} has a 5,000-character limit. The dictated words were not saved.`);
          return;
        }
        setNoteLimitError('');
        updateDraft(nextSections);
      } else if (key) updateDraft((prev) => ({ [key]: appendSpoken(prev[key], spoken) }));
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

  function changeEditorMode(nextMode) {
    if (dictation.listening) dictation.stop();
    activeRef.current = '';
    setActiveField('');
    setNoteLimitError('');
    setEditorMode(nextMode);
  }

  function updateSingleEditor(text) {
    const nextSections = noteSectionsFromEditorText(text);
    const over = overLimitField(nextSections);
    if (over) {
      setNoteLimitError(`${over[1]} has a 5,000-character limit. The excess text was not saved.`);
      return;
    }
    setNoteLimitError('');
    updateDraft(nextSections);
  }

  function insertTemplate(id) {
    const template = NOTE_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    // Into empty fields directly; below whatever is already written otherwise, so nothing is lost.
    updateDraft((prev) => Object.fromEntries(FIELDS.map(([key]) => [key, prev[key]?.trim() ? `${prev[key].trimEnd()}\n\n${template.note[key]}` : template.note[key]])));
  }

  const empty = FIELDS.every(([key]) => !draft[key]?.trim());
  const editorText = noteEditorTextFromSections(draft);
  const savedNotes = [...(encounter.notes || [])].reverse();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-4">
        <Card title="Clinical notes" subtitle="Saved as you type. They join the record when you save them, send the patient for tests, or complete the visit.">
          {canWrite ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Note editor mode">
                  <button type="button" aria-pressed={editorMode === 'single'} onClick={() => changeEditorMode('single')} className={`rounded-full px-3 py-2 text-xs font-semibold ${editorMode === 'single' ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Single editor</button>
                  <button type="button" aria-pressed={editorMode === 'structured'} onClick={() => changeEditorMode('structured')} className={`rounded-full px-3 py-2 text-xs font-semibold ${editorMode === 'structured' ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>SOAP fields</button>
                </div>
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

              {editorMode === 'single' ? (
                <div>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="clinical-note" className="text-sm font-semibold text-slate-700">Clinical note</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => updateDraft(noteSectionsFromEditorText(formatSoapStructureText(draft)))} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Format: Insert SOAP Structure</button>
                      {dictationSupported() && (
                        <button
                          type="button"
                          disabled={!acknowledged}
                          onClick={() => toggleMic('single')}
                          aria-pressed={dictation.listening && activeField === 'single'}
                          aria-label={`${dictation.listening && activeField === 'single' ? 'Stop dictating' : 'Dictate'} clinical note`}
                          title={acknowledged ? 'Dictation appends to the note' : 'Acknowledge the notice above to use dictation'}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${dictation.listening && activeField === 'single' ? 'bg-red-600 text-white motion-safe:animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                          {dictation.listening && activeField === 'single' ? <MicOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}
                          {dictation.listening && activeField === 'single' ? 'Stop' : 'Dictate'}
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    ref={editorRef}
                    id="clinical-note"
                    rows={10}
                    className={`${inputClass} min-h-48 resize-y`}
                    value={editorText}
                    placeholder="Write the history, examination, assessment and plan in your own words. Use the format button to insert editable SOAP headings."
                    maxLength={22000}
                    onChange={(e) => updateSingleEditor(e.target.value)}
                  />
                  {noteLimitError && <p role="alert" className="mt-1 text-sm font-semibold text-red-700">{noteLimitError}</p>}
                </div>
              ) : FIELDS.map(([key, label, hint]) => (
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

        <DiagnosesCard encounter={encounter} auth={auth} open={open} busy={busy} act={act} />

        {savedNotes.length > 0 && (
          <details className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer list-none rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-600">
              <span className="block text-sm font-bold text-slate-900">Saved notes ({savedNotes.length})</span>
              <span className="mt-1 block text-xs text-slate-600">Latest: {formatDateTime(savedNotes[0].createdAt)} · expand to review or correct with a new note</span>
            </summary>
            <ul className="mt-3 space-y-3">
              {savedNotes.map((n) => (
                <li key={n.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{n.type.toLowerCase()} · {n.author?.name || 'Unknown'} · {formatDateTime(n.createdAt)}{n.amendsId ? ' · correction' : ''}</p>
                  {[['S', n.subjective], ['O', n.objective], ['A', n.assessment], ['P', n.plan]].filter(([, v]) => v).map(([k, v]) => (
                    <p key={k} className="mt-1 whitespace-pre-wrap text-slate-800"><span className="font-bold">{k}:</span> {v}</p>
                  ))}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="space-y-4">
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
