import { Copy } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { formatDateTime } from '../../utils/formatters';
import { P, can } from '../opd/opdUtils';

/*
  Tab 2: the doctor's rounds.

  A progress note for the day, in the same four parts as every other note. Most days on a ward
  look like the day before, so "Copy yesterday's note" starts today's from the last one written
  on an earlier day. It only fills the boxes: the doctor reads and edits it, and nothing is
  saved until they save it, so a note is never signed off by accident.
*/

export const NOTE_PARTS = [['subjective', 'Subjective (history)'], ['objective', 'Objective (examination)'], ['assessment', 'Assessment'], ['plan', 'Plan']];
export const EMPTY_NOTE = { subjective: '', objective: '', assessment: '', plan: '' };

const startOfTodayUtc = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`).getTime();

/** The latest note written before today, if any (notes come newest first). */
export function previousDaysNote(notes) {
  const today = startOfTodayUtc();
  return (notes || []).find((n) => new Date(n.createdAt).getTime() < today && NOTE_PARTS.some(([key]) => n[key])) || null;
}

export function RoundsTab({ encounter, auth, open, busy, note, setNote, onSave }) {
  const canWrite = open && (can(auth, P.CONSULT) || can(auth, P.TRIAGE));
  const previous = previousDaysNote(encounter.notes);
  const empty = !Object.values(note).some((v) => v.trim());
  const dirty = !empty;

  function copyPrevious() {
    if (!previous) return;
    const filled = Object.fromEntries(NOTE_PARTS.map(([key]) => [key, previous[key] || '']));
    if (dirty && !window.confirm('Replace what you have typed with yesterday’s note?')) return;
    setNote(filled);
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <Card title="Today's round" subtitle="Notes cannot be edited once saved; add a new note to correct one."
          actions={<Button size="sm" variant="secondary" disabled={!previous} onClick={copyPrevious} title={previous ? `From ${formatDateTime(previous.createdAt)}` : 'No note from an earlier day yet'}><Copy className="h-4 w-4" /> Copy yesterday&rsquo;s note</Button>}>
          <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="grid gap-3 sm:grid-cols-2">
            {NOTE_PARTS.map(([key, label]) => (
              <FormField key={key} label={label}>
                <textarea rows={4} className={inputClass} value={note[key]} onChange={(e) => setNote((c) => ({ ...c, [key]: e.target.value }))} maxLength={5000} />
              </FormField>
            ))}
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy || empty}>Save note</Button>
              {dirty && <span className="text-xs font-semibold text-amber-700">Not saved yet</span>}
            </div>
          </form>
        </Card>
      )}
      <Card title="Notes on this stay">
        <ul className="space-y-3">
          {encounter.notes?.length ? encounter.notes.map((n) => (
            <li key={n.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{n.type.toLowerCase()} · {n.author?.name || 'Unknown'} · {formatDateTime(n.createdAt)}{n.amendsId ? ' · correction' : ''}</p>
              {NOTE_PARTS.filter(([key]) => n[key]).map(([key]) => (
                <p key={key} className="mt-1 whitespace-pre-wrap text-slate-800"><span className="font-bold">{key[0].toUpperCase()}:</span> {n[key]}</p>
              ))}
            </li>
          )) : <li className="text-sm text-slate-500">No notes yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
