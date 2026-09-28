import { useCallback, useEffect, useState } from 'react';
import { Syringe } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../store/commands';
import { DOSE_STATUS, childHealthService, isUnderFive } from '../../services/childHealthService';
import { can } from '../opd/opdUtils';

const formatDay = (value) => (value ? new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const todayInput = () => new Date().toISOString().slice(0, 10);

/** The child's immunization schedule on a visit, with doses to give or copy from the health card. */
export function ImmunizationCard({ encounter, auth, open }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [giving, setGiving] = useState(null);
  const [message, setMessage] = useState('');
  const patient = encounter.patient;
  const enabled = (!Array.isArray(auth?.modules) || auth.modules.includes('child_health')) && can(auth, 'immunization:read');
  const relevant = enabled && (encounter.clinic === 'CHILD_WELFARE' || isUnderFive(patient.dateOfBirth));

  const load = useCallback(async () => {
    try {
      setData(await childHealthService.immunizations(apiClient, patient.id));
      setError('');
    } catch (e) {
      setError(e?.message || 'Immunizations could not be loaded.');
    }
  }, [patient.id]);

  useEffect(() => {
    if (relevant) load();
  }, [relevant, load]);

  if (!relevant) return null;
  const canRecord = open && can(auth, 'immunization:record');
  const pending = data?.schedule.filter((d) => d.status === 'DUE' || d.status === 'OVERDUE') || [];

  return (
    <Card title="Immunizations" subtitle={data ? (pending.length ? `${pending.length} due today` : 'Up to date') : 'Loading…'}>
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      {message && <p role="status" className="mb-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{message}</p>}
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Immunization schedule</caption>
            <thead><tr className="text-left text-xs uppercase tracking-[0.06em] text-slate-500"><th className="py-1 pr-2">Vaccine</th><th className="px-2">Status</th><th className="px-2">Date</th><th className="px-2" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.schedule.map((d) => {
                const record = data.records.find((r) => r.vaccine === d.code && !r.voidedAt);
                return (
                  <tr key={d.code}>
                    <th scope="row" className="py-1.5 pr-2 text-left font-semibold text-slate-800">{d.name}</th>
                    <td className="px-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${DOSE_STATUS[d.status].className}`}>{DOSE_STATUS[d.status].label}</span></td>
                    <td className="px-2 text-slate-600">{d.status === 'GIVEN' ? `${formatDay(d.givenAt)}${record?.givenElsewhere ? ' (card)' : ''}` : formatDay(d.dueDate)}</td>
                    <td className="px-2 text-right">
                      {canRecord && ['DUE', 'OVERDUE', 'UPCOMING'].includes(d.status) && (
                        <Button size="sm" variant={d.status === 'UPCOMING' ? 'ghost' : 'secondary'} onClick={() => setGiving(d)}><Syringe className="h-3.5 w-3.5" /> Record</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">Schedule based on the Ghana EPI; confirm against current GHS guidance.</p>
        </div>
      )}
      <GiveModal
        dose={giving}
        patientId={patient.id}
        encounterId={encounter.id}
        onClose={() => setGiving(null)}
        onSaved={(updated, name) => { setGiving(null); setData(updated); setMessage(`${name} recorded.`); }}
      />
    </Card>
  );
}

function GiveModal({ dose, patientId, encounterId, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (dose) {
      setForm({ givenElsewhere: false, givenAt: todayInput(), batchNumber: '', expiryDate: '', site: dose.route, notes: '' });
      setError('');
    }
  }, [dose]);
  if (!dose || !form) return null;
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  async function save() {
    setSaving(true);
    setError('');
    try {
      const updated = await childHealthService.record(apiClient, patientId, {
        vaccine: dose.code,
        // Today means now; an earlier date (from a card) is stored at midday so it cannot slip a day.
        givenAt: (form.givenAt === todayInput() ? new Date() : new Date(`${form.givenAt}T12:00:00`)).toISOString(),
        givenElsewhere: form.givenElsewhere,
        batchNumber: form.batchNumber.trim() || undefined,
        expiryDate: form.expiryDate || undefined,
        site: form.site.trim() || undefined,
        notes: form.notes.trim() || undefined,
        encounterId: form.givenElsewhere ? undefined : encounterId
      });
      onSaved(updated, dose.name);
    } catch (e) {
      setError(e?.message || 'The dose could not be recorded.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open title={`Record ${dose.name}`} description={dose.route} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving || (!form.givenElsewhere && !form.batchNumber.trim())} onClick={save}><Syringe className="h-4 w-4" /> {saving ? 'Saving…' : 'Record'}</Button></>}>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input type="checkbox" className="h-4 w-4" checked={form.givenElsewhere} onChange={(e) => setForm((c) => ({ ...c, givenElsewhere: e.target.checked }))} /> Copied from the child health card (given elsewhere)
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Date given" required><input type="date" className={inputClass} value={form.givenAt} max={todayInput()} onChange={set('givenAt')} /></FormField>
          <FormField label="Batch number" required={!form.givenElsewhere}><input className={inputClass} value={form.batchNumber} onChange={set('batchNumber')} maxLength={60} /></FormField>
          <FormField label="Batch expiry"><input type="date" className={inputClass} value={form.expiryDate} onChange={set('expiryDate')} /></FormField>
          <FormField label="Site"><input className={inputClass} value={form.site} onChange={set('site')} maxLength={120} /></FormField>
        </div>
        <FormField label="Notes"><input className={inputClass} value={form.notes} onChange={set('notes')} maxLength={500} /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
