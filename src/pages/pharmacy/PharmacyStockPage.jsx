import { useCallback, useEffect, useState } from 'react';
import { History, PackagePlus, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { pharmacyService } from '../../services/pharmacyService';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';

const MOVEMENT_LABEL = { RECEIPT: 'Received', DISPENSE: 'Dispensed', ADJUSTMENT: 'Adjusted', EXPIRY_WRITE_OFF: 'Expired, written off' };
const EMPTY_DRUG = { drugCode: '', genericName: '', brandName: '', strength: '', dosageForm: '', unit: 'tablet', unitPrice: '', reorderLevel: '' };

function dateOnly(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function drugTitle(drug) {
  return [drug.genericName, drug.strength, drug.dosageForm].filter(Boolean).join(' ');
}

export function PharmacyStockPage() {
  const { dispatch } = useAppStore();
  const [drugs, setDrugs] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { kind: 'new' | 'receive' | 'adjust' | 'history', drug }

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDrugs(listItems(await pharmacyService.drugs(apiClient, { q: query.trim() || undefined, includeInactive: 'true' })));
    } catch (error) {
      toast('error', error?.message || 'Drugs could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lowCount = drugs.filter((d) => d.isActive && d.lowStock).length;
  const expiringCount = drugs.filter((d) => d.isActive && d.expiringSoon).length;
  const expiredCount = drugs.filter((d) => d.expiredOnHand > 0).length;

  const done = async (message) => {
    setModal(null);
    toast('success', message);
    await load();
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Pharmacy" title="Drugs & stock" description="The drug list, stock by batch and expiry, and every stock movement." />

      <div className="grid gap-3 sm:grid-cols-3">
        {[['At or below reorder level', lowCount, 'text-amber-700'], ['Expiring within 90 days', expiringCount, 'text-amber-700'], ['Holding expired stock', expiredCount, 'text-red-700']].map(([label, value, tone]) => (
          <Card key={label} compact>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${value ? tone : 'text-slate-900'}`}>{value}</p>
          </Card>
        ))}
      </div>

      <Card
        title="Drug list"
        actions={(
          <>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button onClick={() => setModal({ kind: 'new' })}><Plus className="h-4 w-4" /> Add drug</Button>
          </>
        )}
      >
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-4 flex gap-2">
          <label className="sr-only" htmlFor="drug-search">Search drugs</label>
          <input id="drug-search" className={inputClass} placeholder="Generic name, brand or code" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button type="submit" variant="secondary"><Search className="h-4 w-4" /> Search</Button>
        </form>
        <DataTable
          caption="Drugs"
          emptyMessage={loading ? 'Loading…' : 'No drugs yet. Add the first one.'}
          rows={drugs}
          columns={[
            { key: 'genericName', label: 'Drug', mobilePrimary: true, render: (row) => (
              <span>
                <span className={`font-semibold ${row.isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{drugTitle(row)}</span>
                <span className="block text-xs text-slate-500">{row.drugCode}{row.brandName ? ` · ${row.brandName}` : ''}</span>
              </span>
            ) },
            { key: 'onHand', label: 'In stock', render: (row) => (
              <span className={row.lowStock ? 'font-bold text-amber-700' : 'font-semibold text-slate-900'}>
                {row.onHand} {row.unit}(s){row.lowStock ? ' · reorder' : ''}
              </span>
            ) },
            { key: 'nextExpiry', label: 'Next expiry', render: (row) => <span className={row.expiringSoon ? 'font-semibold text-amber-700' : ''}>{dateOnly(row.nextExpiry)}</span> },
            { key: 'expiredOnHand', label: 'Expired held', render: (row) => (row.expiredOnHand ? <span className="font-semibold text-red-700">{row.expiredOnHand}</span> : '—') },
            { key: 'unitPrice', label: 'Price', render: (row) => Number(row.unitPrice).toFixed(2) },
            { key: 'actions', label: 'Actions', render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setModal({ kind: 'receive', drug: row })}><PackagePlus className="h-3.5 w-3.5" /> Receive</Button>
                <Button size="sm" variant="secondary" disabled={!row.batches?.length} onClick={() => setModal({ kind: 'adjust', drug: row })}><SlidersHorizontal className="h-3.5 w-3.5" /> Adjust</Button>
                <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'history', drug: row })}><History className="h-3.5 w-3.5" /> History</Button>
              </div>
            ) }
          ]}
        />
      </Card>

      <NewDrugModal open={modal?.kind === 'new'} onClose={() => setModal(null)} onSaved={(drug) => done(`${drugTitle(drug)} added. Receive stock to make it available.`)} />
      <ReceiveModal drug={modal?.kind === 'receive' ? modal.drug : null} onClose={() => setModal(null)} onSaved={(drug) => done(`Stock received. ${drug.onHand} ${drug.unit}(s) now in stock.`)} />
      <AdjustModal drug={modal?.kind === 'adjust' ? modal.drug : null} onClose={() => setModal(null)} onSaved={() => done('Stock adjusted.')} />
      <HistoryModal drug={modal?.kind === 'history' ? modal.drug : null} onClose={() => setModal(null)} />
    </div>
  );
}

function useSaver(onSaved) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    setSaving(true);
    setError('');
    try {
      onSaved(await fn());
    } catch (e) {
      setError(e?.message || 'That did not work.');
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, setError, run };
}

function NewDrugModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_DRUG);
  const { saving, error, setError, run } = useSaver(onSaved);
  useEffect(() => {
    if (open) {
      setForm(EMPTY_DRUG);
      setError('');
    }
  }, [open, setError]);
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const valid = form.drugCode.trim().length >= 2 && form.genericName.trim().length >= 2;
  const save = () => run(() => pharmacyService.createDrug(apiClient, {
    drugCode: form.drugCode.trim(),
    genericName: form.genericName.trim(),
    brandName: form.brandName.trim() || undefined,
    strength: form.strength.trim() || undefined,
    dosageForm: form.dosageForm.trim() || undefined,
    unit: form.unit.trim() || 'unit',
    unitPrice: form.unitPrice === '' ? 0 : Number(form.unitPrice),
    reorderLevel: form.reorderLevel === '' ? 0 : Number(form.reorderLevel)
  }));

  return (
    <Modal open={open} title="Add drug" description="Add it to the drug list, then receive stock." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!valid || saving} onClick={save}>{saving ? 'Saving…' : 'Add drug'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code" required><input className={`${inputClass} uppercase`} value={form.drugCode} onChange={set('drugCode')} maxLength={40} placeholder="AMOX500" /></FormField>
        <FormField label="Generic name" required><input className={inputClass} value={form.genericName} onChange={set('genericName')} /></FormField>
        <FormField label="Brand name"><input className={inputClass} value={form.brandName} onChange={set('brandName')} /></FormField>
        <FormField label="Strength"><input className={inputClass} value={form.strength} onChange={set('strength')} placeholder="500 mg" /></FormField>
        <FormField label="Form"><input className={inputClass} value={form.dosageForm} onChange={set('dosageForm')} placeholder="Capsule" /></FormField>
        <FormField label="Counted in" help="The unit stock is counted and sold in."><input className={inputClass} value={form.unit} onChange={set('unit')} /></FormField>
        <FormField label="Price per unit"><input type="number" min="0" step="0.01" className={inputClass} value={form.unitPrice} onChange={set('unitPrice')} /></FormField>
        <FormField label="Reorder level"><input type="number" min="0" className={inputClass} value={form.reorderLevel} onChange={set('reorderLevel')} /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}

function ReceiveModal({ drug, onClose, onSaved }) {
  const [form, setForm] = useState({ batchNumber: '', expiryDate: '', quantity: '', supplier: '', costPrice: '' });
  const { saving, error, setError, run } = useSaver(onSaved);
  useEffect(() => {
    if (drug) {
      setForm({ batchNumber: '', expiryDate: '', quantity: '', supplier: '', costPrice: '' });
      setError('');
    }
  }, [drug, setError]);
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const valid = form.batchNumber.trim() && form.expiryDate && Number(form.quantity) > 0;
  const save = () => run(() => pharmacyService.receiveBatch(apiClient, drug.id, {
    batchNumber: form.batchNumber.trim(),
    expiryDate: form.expiryDate,
    quantity: Number(form.quantity),
    supplier: form.supplier.trim() || undefined,
    costPrice: form.costPrice === '' ? undefined : Number(form.costPrice)
  }));

  return (
    <Modal open={Boolean(drug)} title={drug ? `Receive ${drugTitle(drug)}` : 'Receive stock'} description="Record a delivery exactly as labelled on the pack." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!valid || saving} onClick={save}>{saving ? 'Saving…' : 'Receive stock'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Batch number" required><input className={inputClass} value={form.batchNumber} onChange={set('batchNumber')} /></FormField>
        <FormField label="Expiry date" required><input type="date" className={inputClass} value={form.expiryDate} onChange={set('expiryDate')} /></FormField>
        <FormField label={`Quantity (${drug?.unit || 'units'})`} required><input type="number" min="1" className={inputClass} value={form.quantity} onChange={set('quantity')} /></FormField>
        <FormField label="Cost per unit"><input type="number" min="0" step="0.01" className={inputClass} value={form.costPrice} onChange={set('costPrice')} /></FormField>
        <FormField label="Supplier" className="sm:col-span-2"><input className={inputClass} value={form.supplier} onChange={set('supplier')} /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}

function AdjustModal({ drug, onClose, onSaved }) {
  const [form, setForm] = useState({ batchId: '', direction: 'remove', quantity: '', kind: 'ADJUSTMENT', reason: '' });
  const { saving, error, setError, run } = useSaver(onSaved);
  useEffect(() => {
    if (drug) {
      const expired = drug.batches?.find((b) => b.expired);
      setForm({ batchId: expired?.id || drug.batches?.[0]?.id || '', direction: 'remove', quantity: '', kind: expired ? 'EXPIRY_WRITE_OFF' : 'ADJUSTMENT', reason: expired ? 'Expired stock removed' : '' });
      setError('');
    }
  }, [drug, setError]);
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const signed = (form.direction === 'remove' || form.kind === 'EXPIRY_WRITE_OFF' ? -1 : 1) * Number(form.quantity || 0);
  const valid = form.batchId && Number(form.quantity) > 0 && form.reason.trim().length >= 3;
  const save = () => run(() => pharmacyService.adjust(apiClient, drug.id, { batchId: form.batchId, quantity: signed, kind: form.kind, reason: form.reason.trim() }));

  return (
    <Modal open={Boolean(drug)} title={drug ? `Adjust ${drugTitle(drug)}` : 'Adjust stock'} description="Every adjustment is recorded with your name and reason." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!valid || saving} onClick={save}>{saving ? 'Saving…' : 'Save adjustment'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Batch" className="sm:col-span-2">
          <select className={inputClass} value={form.batchId} onChange={set('batchId')}>
            {drug?.batches?.map((b) => <option key={b.id} value={b.id}>{b.batchNumber} · expires {dateOnly(b.expiryDate)}{b.expired ? ' (EXPIRED)' : ''} · {b.quantityOnHand} left</option>)}
          </select>
        </FormField>
        <FormField label="Type">
          <select className={inputClass} value={form.kind} onChange={set('kind')}>
            <option value="ADJUSTMENT">Stock count correction</option>
            <option value="EXPIRY_WRITE_OFF">Expired, write off</option>
          </select>
        </FormField>
        {form.kind === 'ADJUSTMENT' && (
          <FormField label="Direction">
            <select className={inputClass} value={form.direction} onChange={set('direction')}>
              <option value="remove">Remove stock</option>
              <option value="add">Add stock</option>
            </select>
          </FormField>
        )}
        <FormField label="Quantity" required><input type="number" min="1" className={inputClass} value={form.quantity} onChange={set('quantity')} /></FormField>
        <FormField label="Reason" required className="sm:col-span-2"><input className={inputClass} value={form.reason} onChange={set('reason')} maxLength={300} /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}

function HistoryModal({ drug, onClose }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!drug) return;
    setItems([]);
    pharmacyService.movements(apiClient, drug.id).then((data) => setItems(listItems(data))).catch(() => setItems([]));
  }, [drug]);
  return (
    <Modal open={Boolean(drug)} title={drug ? `${drugTitle(drug)} — stock history` : 'Stock history'} onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto text-sm">
        {items.length ? items.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-3 py-2">
            <span>
              <span className="font-semibold text-slate-900">{MOVEMENT_LABEL[m.type] || m.type}</span>
              <span className="block text-xs text-slate-500">{formatDateTime(m.createdAt)}{m.batch ? ` · batch ${m.batch.batchNumber}` : ''}{m.actor ? ` · ${m.actor.name}` : ''}{m.reason ? ` · ${m.reason}` : ''}</span>
            </span>
            <span className={`font-mono font-semibold ${m.quantity < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>
          </li>
        )) : <li className="py-2 text-slate-500">No movements yet.</li>}
      </ul>
    </Modal>
  );
}
