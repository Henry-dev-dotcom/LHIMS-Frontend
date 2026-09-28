import { useCallback, useEffect, useState } from 'react';
import { Baby, ClipboardPlus, HeartPulse, Plus, XCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { encounterService } from '../../services/encounterService';
import { BIRTH_OUTCOMES, DELIVERY_MODES, END_REASONS, PERINEUM, RISK_FACTORS, SCREENING, gestationLabel, isFemale, maternityService } from '../../services/maternityService';
import { can } from '../opd/opdUtils';
import { FormModal } from '../clinics/ClinicalFormsCard';

const MATERNITY_CLINICS = ['ANTENATAL', 'POSTNATAL'];
export const formatDay = (value) => (value ? new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Shown on a woman's visit: her ongoing or recent pregnancy, with antenatal, delivery and postnatal actions. */
export function PregnancyCard({ encounter, auth, open, busy, act }) {
  const [pregnancy, setPregnancy] = useState(undefined);
  const [modal, setModal] = useState('');
  const modules = auth?.modules;
  const enabled = !Array.isArray(modules) || modules.includes('maternity');
  const patient = encounter.patient;

  const load = useCallback(async () => {
    try {
      const rows = listItems(await maternityService.pregnancies(apiClient, { patientId: patient.id, limit: 5 }));
      // The ongoing pregnancy, else the most recent delivery (for postnatal care).
      setPregnancy(rows.find((p) => p.status === 'ACTIVE') || rows.find((p) => p.status === 'DELIVERED') || null);
    } catch {
      setPregnancy(null);
    }
  }, [patient.id]);

  useEffect(() => {
    if (enabled && isFemale(patient) && can(auth, 'maternity:read')) load();
  }, [enabled, patient, auth, load, encounter.forms?.length]);

  if (!enabled || !isFemale(patient) || !can(auth, 'maternity:read') || pregnancy === undefined) return null;
  // Outside the maternity clinics, only show the card when there is a pregnancy to show.
  if (!pregnancy && !MATERNITY_CLINICS.includes(encounter.clinic)) return null;

  const active = pregnancy?.status === 'ACTIVE';
  const delivered = pregnancy?.status === 'DELIVERED';
  const saveForm = (type) => async (data) => {
    const ok = await act(() => encounterService.addForm(apiClient, encounter.id, { type, data, pregnancyId: pregnancy.id }), type === 'ANC_VISIT' ? 'Antenatal visit recorded.' : 'Postnatal check recorded.');
    if (ok) setModal('');
  };

  return (
    <Card
      title="Pregnancy"
      subtitle={!pregnancy ? 'No pregnancy booked.' : `${pregnancy.pregnancyCode} · ${active ? 'ongoing' : 'delivered'}`}
      actions={!pregnancy && open && can(auth, 'maternity:register') && <Button size="sm" onClick={() => setModal('register')}><Plus className="h-3.5 w-3.5" /> Book pregnancy</Button>}
    >
      {pregnancy && (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-xs font-semibold uppercase text-slate-500">{active ? 'Gestation today' : 'Delivered'}</dt><dd className="font-bold text-slate-900">{active ? gestationLabel(pregnancy.gestationToday) : formatDay(pregnancy.delivery?.deliveredAt)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Due date</dt><dd className="font-semibold text-slate-800">{formatDay(pregnancy.edd)}{pregnancy.eddByScan ? ' (scan)' : ''}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">G / P</dt><dd className="font-semibold text-slate-800">G{pregnancy.gravida} P{pregnancy.parity}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Blood group</dt><dd className="font-semibold text-slate-800">{pregnancy.bloodGroup || '—'}</dd></div>
          </dl>
          {pregnancy.riskFactors?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{pregnancy.riskFactors.map((r) => <span key={r} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">{RISK_FACTORS[r] || r}</span>)}</div>
          )}
          {Object.keys(pregnancy.screening || {}).length > 0 && (
            <p className="text-xs text-slate-600">Screening: {Object.entries(pregnancy.screening).map(([k, v]) => `${SCREENING[k] || k} ${String(v).toLowerCase().replace('_', ' ')}`).join(' · ')}</p>
          )}
          {open && (
            <div className="flex flex-wrap gap-2">
              {active && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setModal('anc')}><ClipboardPlus className="h-3.5 w-3.5" /> Antenatal visit</Button>}
              {active && can(auth, 'maternity:deliver') && <Button size="sm" disabled={busy} onClick={() => setModal('deliver')}><Baby className="h-3.5 w-3.5" /> Record delivery</Button>}
              {active && can(auth, 'maternity:register') && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setModal('end')}><XCircle className="h-3.5 w-3.5" /> Ended another way</Button>}
              {delivered && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setModal('pnc')}><HeartPulse className="h-3.5 w-3.5" /> Postnatal check</Button>}
            </div>
          )}
        </div>
      )}

      <FormModal editing={modal === 'anc' ? { type: 'ANC_VISIT', description: `Gestation today: ${gestationLabel(pregnancy?.gestationToday)}.` } : null} busy={busy} onClose={() => setModal('')} onSave={saveForm('ANC_VISIT')} />
      <FormModal editing={modal === 'pnc' ? { type: 'POSTNATAL_CHECK' } : null} busy={busy} onClose={() => setModal('')} onSave={saveForm('POSTNATAL_CHECK')} />
      <RegisterPregnancyModal open={modal === 'register'} patient={patient} onClose={() => setModal('')} onSaved={(p) => { setModal(''); setPregnancy(p); }} act={act} />
      <DeliveryModal open={modal === 'deliver'} pregnancy={pregnancy} encounter={encounter} busy={busy} act={act} onClose={() => setModal('')} onSaved={(p) => { setModal(''); setPregnancy(p); }} />
      <EndPregnancyModal open={modal === 'end'} pregnancy={pregnancy} busy={busy} act={act} onClose={() => setModal('')} onSaved={() => { setModal(''); load(); }} />
    </Card>
  );
}

function Toggle({ checked, onChange, children }) {
  return <label className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" className="h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}</label>;
}

export function RegisterPregnancyModal({ open, patient, onClose, onSaved, act }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm({ lmp: '', eddByScan: '', gravida: '1', parity: '0', livingChildren: '', bloodGroup: '', riskFactors: [], screening: {} });
  }, [open]);
  if (!open || !form) return null;
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  async function save() {
    setSaving(true);
    let saved = null;
    await act(async () => {
      saved = await maternityService.register(apiClient, {
        patientId: patient.id,
        lmp: form.lmp || undefined,
        eddByScan: form.eddByScan || undefined,
        gravida: Number(form.gravida),
        parity: Number(form.parity),
        livingChildren: form.livingChildren === '' ? undefined : Number(form.livingChildren),
        bloodGroup: form.bloodGroup || undefined,
        riskFactors: form.riskFactors,
        screening: form.screening
      });
      return null;
    }, 'Pregnancy booked.');
    setSaving(false);
    if (saved) onSaved(saved);
  }
  return (
    <Modal open title="Book pregnancy" description="Gravida counts this pregnancy; parity counts births after 28 weeks." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving || (!form.lmp && !form.eddByScan)} onClick={save}>{saving ? 'Saving…' : 'Book'}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Last menstrual period"><input type="date" className={inputClass} value={form.lmp} onChange={set('lmp')} /></FormField>
          <FormField label="Due date by scan" help="An early scan date replaces the LMP date."><input type="date" className={inputClass} value={form.eddByScan} onChange={set('eddByScan')} /></FormField>
          <FormField label="Gravida" required><input type="number" min="1" className={inputClass} value={form.gravida} onChange={set('gravida')} /></FormField>
          <FormField label="Parity" required><input type="number" min="0" className={inputClass} value={form.parity} onChange={set('parity')} /></FormField>
          <FormField label="Living children"><input type="number" min="0" className={inputClass} value={form.livingChildren} onChange={set('livingChildren')} /></FormField>
          <FormField label="Blood group">
            <select className={inputClass} value={form.bloodGroup} onChange={set('bloodGroup')}>
              <option value="">Not known</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </FormField>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-slate-900">Risk factors</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {Object.entries(RISK_FACTORS).map(([key, label]) => (
              <Toggle key={key} checked={form.riskFactors.includes(key)} onChange={(on) => setForm((c) => ({ ...c, riskFactors: on ? [...c.riskFactors, key] : c.riskFactors.filter((r) => r !== key) }))}>{label}</Toggle>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-bold text-slate-900">Booking screening</legend>
          {Object.entries(SCREENING).map(([key, label]) => (
            <FormField key={key} label={label}>
              <select className={inputClass} value={form.screening[key] || ''} onChange={(e) => setForm((c) => ({ ...c, screening: { ...c.screening, [key]: e.target.value || undefined } }))}>
                <option value="">Not recorded</option><option value="NEGATIVE">Negative</option><option value="POSITIVE">Positive</option><option value="NOT_DONE">Not done</option>
              </select>
            </FormField>
          ))}
        </fieldset>
      </div>
    </Modal>
  );
}

const NEW_BABY = { sex: 'FEMALE', outcome: 'LIVE_BIRTH', birthWeightG: '', apgar1: '', apgar5: '', resuscitated: false, notes: '' };
const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function DeliveryModal({ open, pregnancy, encounter, busy, act, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (open) setForm({ deliveredAt: toLocalInput(new Date()), mode: 'SVD', bloodLossMl: '', perineum: '', placentaComplete: true, oxytocinGiven: true, complications: '', notes: '', babies: [{ ...NEW_BABY }] });
  }, [open]);
  if (!open || !form || !pregnancy) return null;
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const setBaby = (i, key, value) => setForm((c) => ({ ...c, babies: c.babies.map((b, j) => (j === i ? { ...b, [key]: value } : b)) }));
  const n = (v) => (v === '' ? undefined : Number(v));
  const pph = form.bloodLossMl !== '' && Number(form.bloodLossMl) >= (form.mode === 'CAESAREAN' ? 1000 : 500);
  async function save() {
    let saved = null;
    await act(async () => {
      saved = await maternityService.deliver(apiClient, pregnancy.id, {
        encounterId: encounter.id,
        deliveredAt: new Date(form.deliveredAt).toISOString(),
        mode: form.mode,
        bloodLossMl: n(form.bloodLossMl),
        perineum: form.perineum || undefined,
        placentaComplete: form.placentaComplete,
        oxytocinGiven: form.oxytocinGiven,
        complications: form.complications.trim() || undefined,
        notes: form.notes.trim() || undefined,
        babies: form.babies.map((b) => ({ sex: b.sex, outcome: b.outcome, birthWeightG: n(b.birthWeightG), apgar1: n(b.apgar1), apgar5: n(b.apgar5), resuscitated: b.resuscitated, notes: b.notes.trim() || undefined }))
      });
      return null;
    }, 'Delivery recorded. Live-born babies are registered as patients.');
    if (saved) onSaved(saved);
  }
  return (
    <Modal open title="Record delivery" description={`${pregnancy.pregnancyCode} · ${gestationLabel(pregnancy.gestationToday)} today. Each live-born baby gets a patient record.`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}><Baby className="h-4 w-4" /> {busy ? 'Saving…' : 'Record delivery'}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Time of birth" required><input type="datetime-local" className={inputClass} value={form.deliveredAt} onChange={set('deliveredAt')} /></FormField>
          <FormField label="Mode" required><select className={inputClass} value={form.mode} onChange={set('mode')}>{Object.entries(DELIVERY_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
          <FormField label="Blood loss (ml)" help={pph ? 'Postpartum haemorrhage.' : undefined}><input type="number" min="0" className={`${inputClass} ${pph ? 'border-red-400' : ''}`} value={form.bloodLossMl} onChange={set('bloodLossMl')} /></FormField>
          <FormField label="Perineum"><select className={inputClass} value={form.perineum} onChange={set('perineum')}><option value="">—</option>{Object.entries(PERINEUM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
          <div className="flex flex-col justify-end gap-1.5 pb-2 sm:col-span-2">
            <Toggle checked={form.placentaComplete} onChange={(v) => setForm((c) => ({ ...c, placentaComplete: v }))}>Placenta and membranes complete</Toggle>
            <Toggle checked={form.oxytocinGiven} onChange={(v) => setForm((c) => ({ ...c, oxytocinGiven: v }))}>Oxytocin given (active management of third stage)</Toggle>
          </div>
        </div>
        {form.babies.map((b, i) => (
          <fieldset key={i} className="rounded-2xl border border-slate-200 p-3">
            <legend className="px-1 text-sm font-bold text-slate-900">{form.babies.length > 1 ? `Baby ${i + 1}` : 'Baby'}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Outcome"><select className={inputClass} value={b.outcome} onChange={(e) => setBaby(i, 'outcome', e.target.value)}>{Object.entries(BIRTH_OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
              <FormField label="Sex"><select className={inputClass} value={b.sex} onChange={(e) => setBaby(i, 'sex', e.target.value)}><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="UNDETERMINED">Undetermined</option></select></FormField>
              <FormField label="Birth weight (g)"><input type="number" min="300" className={inputClass} value={b.birthWeightG} onChange={(e) => setBaby(i, 'birthWeightG', e.target.value)} /></FormField>
              <FormField label="Apgar 1 min"><input type="number" min="0" max="10" className={inputClass} value={b.apgar1} onChange={(e) => setBaby(i, 'apgar1', e.target.value)} /></FormField>
              <FormField label="Apgar 5 min"><input type="number" min="0" max="10" className={inputClass} value={b.apgar5} onChange={(e) => setBaby(i, 'apgar5', e.target.value)} /></FormField>
              <div className="flex items-end pb-3"><Toggle checked={b.resuscitated} onChange={(v) => setBaby(i, 'resuscitated', v)}>Resuscitated</Toggle></div>
            </div>
            {form.babies.length > 1 && <button type="button" className="mt-1 text-xs font-semibold text-red-700 hover:underline" onClick={() => setForm((c) => ({ ...c, babies: c.babies.filter((_, j) => j !== i) }))}>Remove</button>}
          </fieldset>
        ))}
        {form.babies.length < 6 && <Button size="sm" variant="ghost" onClick={() => setForm((c) => ({ ...c, babies: [...c.babies, { ...NEW_BABY }] }))}><Plus className="h-3.5 w-3.5" /> Another baby</Button>}
        <FormField label="Complications"><input className={inputClass} value={form.complications} onChange={set('complications')} maxLength={2000} /></FormField>
        <FormField label="Notes / plan"><textarea rows={2} className={inputClass} value={form.notes} onChange={set('notes')} maxLength={2000} /></FormField>
      </div>
    </Modal>
  );
}

function EndPregnancyModal({ open, pregnancy, busy, act, onClose, onSaved }) {
  const [reason, setReason] = useState('MISCARRIAGE');
  const [note, setNote] = useState('');
  if (!open || !pregnancy) return null;
  async function save() {
    const ok = await act(async () => { await maternityService.end(apiClient, pregnancy.id, { reason, note: note.trim() || undefined }); return null; }, 'Pregnancy closed.');
    if (ok) onSaved();
  }
  return (
    <Modal open title="Pregnancy ended without a delivery here" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={busy} onClick={save}>Close pregnancy</Button></>}>
      <div className="space-y-3">
        <FormField label="Outcome"><select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>{Object.entries(END_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
        <FormField label="Note"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></FormField>
      </div>
    </Modal>
  );
}

