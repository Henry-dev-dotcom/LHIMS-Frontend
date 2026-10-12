import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../store/commands';
import { inpatientService } from '../../services/inpatientService';
import { formatDateTime } from '../../utils/formatters';
import { BLOCK_LABEL, DOSE_STATUS_LABEL, IP, SLOT_STATE_LABEL, dayLabel, shiftDay, utcTime } from './wardUtils';
import { can } from '../opd/opdUtils';

/*
  The medication chart (MAR).

  One row per medicine, one column per part of the day. A box is ticked by a nurse, who is
  asked to confirm which patient, which medicine and what dose before it is recorded, because
  a tick is a statement that the dose was given. A dose that was held, refused or missed is
  recorded too, with the reason, so every gap on the chart is explained.
*/

const STATE_STYLE = {
  GIVEN: 'border-emerald-400 bg-emerald-50 text-emerald-900',
  DUE: 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100',
  OVERDUE: 'border-red-400 bg-red-50 text-red-800 hover:bg-red-100',
  UPCOMING: 'border-slate-200 bg-white text-slate-400',
  NOT_APPLICABLE: 'border-dashed border-slate-200 bg-slate-50 text-slate-300'
};

export function MedicationTab({ admission, auth, toast, onChanged }) {
  const [chart, setChart] = useState(null);
  const [day, setDay] = useState(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      setChart(await inpatientService.medicationChart(apiClient, admission.id, day || undefined));
      setError('');
    } catch (e) {
      setError(e?.message || 'The medication chart could not be loaded.');
    }
  }, [admission.id, day]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Card><p role="alert" className="text-sm font-semibold text-red-600">{error}</p></Card>;
  if (!chart) return <Card><p className="text-sm text-slate-500">Loading the chart…</p></Card>;

  const mayRecord = chart.open && can(auth, IP.ADMINISTER);
  const shown = chart.day;
  const isToday = shown === chart.today;

  return (
    <Card
      title="Medication chart"
      subtitle="Prescribe in the clinical record. Tick each dose here once it has been given."
      actions={(
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Previous day" onClick={() => setDay(shiftDay(shown, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[5.5rem] text-center text-sm font-semibold text-slate-800" aria-live="polite">{dayLabel(shown, chart.today)}</span>
          <Button size="sm" variant="ghost" aria-label="Next day" disabled={isToday} onClick={() => setDay(shiftDay(shown, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" aria-label="Refresh chart" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      )}
    >
      {chart.patient.allergies?.length > 0 && (
        <p className="mb-3 rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">Allergies: {chart.patient.allergies.map((a) => a.substance).join(', ')}</p>
      )}
      {chart.rows.length === 0 ? <p className="text-sm text-slate-500">Nothing is prescribed for {dayLabel(shown, chart.today).toLowerCase()}.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.06em] text-slate-500">
                <th scope="col" className="px-2">Medicine</th>
                {chart.blocks.map((b) => (
                  <th key={b.block} scope="col" className="px-2">{BLOCK_LABEL[b.block]} <span className="font-normal normal-case">{utcTime(b.opens)}–{utcTime(b.closes)}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row) => (
                <tr key={row.itemId} className="align-top">
                  <th scope="row" className="rounded-l-2xl bg-slate-50 px-3 py-2 text-left font-normal">
                    <span className="block font-semibold text-slate-900">{[row.drugName, row.strength, row.dosageForm].filter(Boolean).join(' ')}</span>
                    <span className="block text-xs text-slate-600">{row.dose} {row.route}, {row.frequency}{row.durationDays ? ` for ${row.durationDays} days` : ''}</span>
                    {row.instructions && <span className="block text-xs text-slate-500">{row.instructions}</span>}
                    {row.asNeeded && (
                      <span className="mt-1 block text-xs font-semibold text-slate-600">
                        As needed
                        {mayRecord && <button type="button" className="ml-2 font-bold text-clinical-700 hover:underline" onClick={() => setTarget({ row, slot: null })}><Plus className="inline h-3 w-3" aria-hidden="true" /> Record a dose</button>}
                      </span>
                    )}
                  </th>
                  {chart.blocks.map((b, index) => {
                    const slots = row.slots.filter((s) => s.block === b.block);
                    const last = index === chart.blocks.length - 1;
                    return (
                      <td key={b.block} className={`bg-slate-50 px-2 py-2 ${last ? 'rounded-r-2xl' : ''}`}>
                        <div className="flex flex-wrap gap-1.5">
                          {slots.length === 0 && <span className="text-slate-300" aria-hidden="true">–</span>}
                          {slots.map((slot) => (
                            <SlotBox key={`${slot.block}-${slot.slot}`} row={row} slot={slot} mayRecord={mayRecord} onOpen={() => setTarget({ row, slot })} />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {chart.rows.some((r) => r.extra.length > 0) && (
        <section className="mt-4" aria-label="Doses given outside the schedule">
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Given outside the schedule</h4>
          <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
            {chart.rows.flatMap((r) => r.extra.map((d) => (
              <li key={d.id}>{r.drugName}: {DOSE_STATUS_LABEL[d.status].toLowerCase()}{d.doseGiven ? ` ${d.doseGiven}` : ''} · {formatDateTime(d.administeredAt)} · {d.administeredBy?.name || ''}{d.notes ? ` · ${d.notes}` : ''}</li>
            )))}
          </ul>
        </section>
      )}
      <DoseModal target={target} chart={chart} onClose={() => setTarget(null)} toast={toast}
        onRecorded={() => { setTarget(null); load(); onChanged?.(); }} admissionId={admission.id} />
    </Card>
  );
}

function SlotBox({ row, slot, mayRecord, onOpen }) {
  const given = slot.administration;
  const clickable = mayRecord && !given && (slot.state === 'DUE' || slot.state === 'OVERDUE');
  const mark = given ? (given.status === 'GIVEN' ? '✓' : DOSE_STATUS_LABEL[given.status][0]) : slot.state === 'OVERDUE' ? '!' : '';
  const label = `${row.drugName}, ${BLOCK_LABEL[slot.block].toLowerCase()}${row.slots.filter((s) => s.block === slot.block).length > 1 ? ` dose ${slot.slot + 1}` : ''}: ${given ? `${DOSE_STATUS_LABEL[given.status].toLowerCase()} by ${given.administeredBy?.name || 'unknown'}` : SLOT_STATE_LABEL[slot.state].toLowerCase()}`;
  const title = given ? `${DOSE_STATUS_LABEL[given.status]} ${formatDateTime(given.administeredAt)} by ${given.administeredBy?.name || '—'}${given.notes ? `: ${given.notes}` : ''}` : SLOT_STATE_LABEL[slot.state];
  const style = given ? (given.status === 'GIVEN' ? STATE_STYLE.GIVEN : 'border-slate-400 bg-slate-100 text-slate-700') : STATE_STYLE[slot.state];
  return (
    <button type="button" aria-label={label} title={title} disabled={!clickable} onClick={onOpen}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-base font-bold transition disabled:cursor-default ${style}`}>
      {mark}
    </button>
  );
}

function DoseModal({ target, chart, admissionId, onClose, onRecorded, toast }) {
  const [status, setStatus] = useState('GIVEN');
  const [doseGiven, setDoseGiven] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (target) {
      setStatus('GIVEN');
      setDoseGiven(target.row.dose || '');
      setNotes('');
      setError('');
    }
  }, [target]);

  if (!target) return <Modal open={false} onClose={onClose} title="Record a dose"><span /></Modal>;
  const { row, slot } = target;
  const needsReason = status !== 'GIVEN';
  const when = slot ? `${BLOCK_LABEL[slot.block].toLowerCase()} dose, ${dayLabel(chart.day, chart.today).toLowerCase()}` : 'a dose outside the schedule';

  async function save() {
    setSaving(true);
    setError('');
    try {
      await inpatientService.administer(apiClient, admissionId, row.itemId, {
        status,
        doseGiven: status === 'GIVEN' ? doseGiven.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
        ...(slot ? { scheduleDate: chart.day, scheduleBlock: slot.block, scheduleSlot: slot.slot } : {})
      });
      toast('success', `${row.drugName}: ${DOSE_STATUS_LABEL[status].toLowerCase()} recorded.`);
      onRecorded();
    } catch (e) {
      setError(e?.message || 'The dose could not be recorded.');
      if (e?.code === 'DOSE_ALREADY_RECORDED') onRecorded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Record a dose" description={`Check this is the right patient and the right medicine before you confirm.`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={status === 'GIVEN' ? 'success' : 'primary'} disabled={saving || (needsReason && notes.trim().length < 3)} onClick={save}><CheckCircle2 className="h-4 w-4" /> {saving ? 'Saving…' : status === 'GIVEN' ? 'Confirm given' : `Record ${DOSE_STATUS_LABEL[status].toLowerCase()}`}</Button></>}>
      <div className="space-y-3">
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <p className="font-bold text-slate-900">{chart.patient.firstName} {chart.patient.lastName}</p>
          <p className="text-slate-800">{[row.drugName, row.strength, row.dosageForm].filter(Boolean).join(' ')} · {row.dose} {row.route}</p>
          <p className="text-xs text-slate-500">{when}</p>
        </div>
        {chart.patient.allergies?.length > 0 && <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">Allergies: {chart.patient.allergies.map((a) => a.substance).join(', ')}</p>}
        <FormField label="What happened">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(DOSE_STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FormField>
        {status === 'GIVEN' && <FormField label="Dose given"><input className={inputClass} value={doseGiven} onChange={(e) => setDoseGiven(e.target.value)} maxLength={120} /></FormField>}
        <FormField label={needsReason ? 'Reason' : 'Note'} required={needsReason}>
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder={needsReason ? 'e.g. Patient nil by mouth for a scan' : 'Optional'} />
        </FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
