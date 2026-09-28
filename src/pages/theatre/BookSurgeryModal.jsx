import { useEffect, useState } from 'react';
import { Scissors } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { encounterService } from '../../services/encounterService';
import { ANAESTHESIA, isProcedureItem, theatreService } from '../../services/theatreService';

const EMPTY = { theatreId: '', procedureItemId: '', procedureName: '', urgency: 'ELECTIVE', anaesthesia: '', start: '', durationMinutes: '60', anaesthetistName: '', assistants: '', preopDiagnosis: '' };

/** Books an operation on this visit or stay; the booking doctor is the surgeon. */
export function BookSurgeryModal({ open, encounter, onClose, onBooked }) {
  const [theatres, setTheatres] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, preopDiagnosis: encounter.diagnoses?.[0]?.description || '' });
    setError('');
    theatreService.theatres(apiClient).then((data) => setTheatres(listItems(data).filter((t) => t.isActive))).catch(() => setTheatres([]));
    encounterService.catalog(apiClient).then((data) => setProcedures(listItems(data).filter((i) => isProcedureItem(i) && i.isActive !== false))).catch(() => setProcedures([]));
  }, [open, encounter]);

  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const ready = form.theatreId && form.start && form.procedureName.trim().length >= 3 && Number(form.durationMinutes) >= 10;

  async function book() {
    setSaving(true);
    setError('');
    try {
      onBooked(await theatreService.schedule(apiClient, {
        encounterId: encounter.id,
        theatreId: form.theatreId,
        procedureItemId: form.procedureItemId || undefined,
        procedureName: form.procedureName.trim() || undefined,
        urgency: form.urgency,
        anaesthesia: form.anaesthesia || undefined,
        scheduledStart: new Date(form.start).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        anaesthetistName: form.anaesthetistName.trim() || undefined,
        assistants: form.assistants.trim() || undefined,
        preopDiagnosis: form.preopDiagnosis.trim() || undefined
      }));
    } catch (e) {
      setError(e?.message || 'The operation could not be booked.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Book operation" description="The operation note and the procedure charge are added to this visit when the case is signed out." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready || saving} onClick={book}><Scissors className="h-4 w-4" /> {saving ? 'Booking…' : 'Book'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Procedure">
          <select className={inputClass} value={form.procedureItemId} onChange={(e) => { const item = procedures.find((p) => p.id === e.target.value); setForm((c) => ({ ...c, procedureItemId: e.target.value, procedureName: item?.name || '' })); }}>
            <option value="">Other (type below)…</option>
            {procedures.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>
        <FormField label="Procedure name" required help={form.procedureItemId ? 'Edit to add detail, e.g. laparoscopic.' : 'Not in the list: not charged automatically.'}>
          <input className={inputClass} value={form.procedureName} onChange={set('procedureName')} maxLength={200} />
        </FormField>
        <FormField label="Theatre" required>
          <select className={inputClass} value={form.theatreId} onChange={set('theatreId')}>
            <option value="">Choose a theatre…</option>
            {theatres.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormField>
        <FormField label="Urgency">
          <select className={inputClass} value={form.urgency} onChange={set('urgency')}>
            <option value="ELECTIVE">Elective</option>
            <option value="URGENT">Urgent</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </FormField>
        <FormField label="Start" required><input type="datetime-local" className={inputClass} value={form.start} onChange={set('start')} /></FormField>
        <FormField label="Expected duration (minutes)" required><input type="number" min="10" step="5" className={inputClass} value={form.durationMinutes} onChange={set('durationMinutes')} /></FormField>
        <FormField label="Planned anaesthesia">
          <select className={inputClass} value={form.anaesthesia} onChange={set('anaesthesia')}>
            <option value="">Decide at sign in</option>
            {Object.entries(ANAESTHESIA).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Anaesthetist"><input className={inputClass} value={form.anaesthetistName} onChange={set('anaesthetistName')} maxLength={120} /></FormField>
        <FormField label="Assistants"><input className={inputClass} value={form.assistants} onChange={set('assistants')} maxLength={300} /></FormField>
        <FormField label="Pre-operative diagnosis"><input className={inputClass} value={form.preopDiagnosis} onChange={set('preopDiagnosis')} maxLength={500} /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}
