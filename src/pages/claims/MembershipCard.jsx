import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { claimsService } from '../../services/claimsService';
import { can } from '../opd/opdUtils';

const formatDay = (value) => (value ? new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : 'no expiry');

/** The patient's NHIS / scheme cards, recorded at the desk and used when the visit is claimed. */
export function MembershipCard({ patient, auth }) {
  const [items, setItems] = useState(null);
  const [adding, setAdding] = useState(false);
  const enabled = (!Array.isArray(auth?.modules) || auth.modules.includes('claims')) && can(auth, 'claims:memberships');

  const load = useCallback(async () => {
    try {
      setItems(listItems(await claimsService.memberships(apiClient, patient.id)));
    } catch {
      setItems([]);
    }
  }, [patient.id]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  if (!enabled || !items) return null;
  const today = new Date();
  const current = items.filter((m) => m.scheme && m.status === 'Active');

  return (
    <Card title="Insurance" subtitle={current.length ? current.map((m) => m.scheme.code).join(', ') : 'No scheme card recorded'}
      actions={<Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add card</Button>}>
      {current.length === 0 ? <p className="text-sm text-slate-500">Record the patient’s NHIS or scheme card so the visit can be claimed.</p> : (
        <ul className="space-y-2">
          {current.map((m) => {
            const expired = m.expiresAt && new Date(m.expiresAt) < today;
            return (
              <li key={m.id} className={`flex items-center justify-between rounded-2xl px-4 py-2 text-sm ${expired ? 'bg-red-50' : 'bg-slate-50'}`}>
                <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-slate-500" aria-hidden="true" /><span><span className="font-semibold">{m.scheme.name}</span> · {m.policyNumber}</span></span>
                <span className={`text-xs font-semibold ${expired ? 'text-red-700' : 'text-slate-600'}`}>{expired ? 'Expired ' : 'Valid to '}{formatDay(m.expiresAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <AddMembershipModal open={adding} patientId={patient.id} onClose={() => setAdding(false)} onSaved={(rows) => { setAdding(false); setItems(rows); }} />
    </Card>
  );
}

function AddMembershipModal({ open, patientId, onClose, onSaved }) {
  const [schemes, setSchemes] = useState([]);
  const [form, setForm] = useState({ schemeId: '', membershipNumber: '', expiresAt: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setError('');
    claimsService.schemes(apiClient).then((d) => {
      const active = listItems(d).filter((s) => s.isActive);
      setSchemes(active);
      setForm({ schemeId: active[0]?.id || '', membershipNumber: '', expiresAt: '' });
    }).catch(() => setSchemes([]));
  }, [open]);
  async function save() {
    setSaving(true);
    setError('');
    try {
      const data = await claimsService.addMembership(apiClient, patientId, { schemeId: form.schemeId, membershipNumber: form.membershipNumber.trim(), expiresAt: form.expiresAt || undefined });
      onSaved(listItems(data));
    } catch (e) {
      setError(e?.message || 'The card could not be recorded.');
    } finally {
      setSaving(false);
    }
  }
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  return (
    <Modal open={open} title="Add scheme card" description="A renewed card replaces the old one for the same scheme." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving || !form.schemeId || form.membershipNumber.trim().length < 3} onClick={save}>{saving ? 'Saving…' : 'Save card'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Scheme" required className="sm:col-span-2">
          <select className={inputClass} value={form.schemeId} onChange={set('schemeId')}>{schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </FormField>
        <FormField label="Membership number" required><input className={inputClass} value={form.membershipNumber} onChange={set('membershipNumber')} maxLength={40} /></FormField>
        <FormField label="Valid until"><input type="date" className={inputClass} value={form.expiresAt} onChange={set('expiresAt')} /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}
