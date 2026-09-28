import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Pill, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { pharmacyService, isAllergyConflict } from '../../services/pharmacyService';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { ageLabel, patientName } from '../opd/opdUtils';

const STATUS_LABEL = { ACTIVE: 'To dispense', PARTIALLY_DISPENSED: 'Partly dispensed', DISPENSED: 'Dispensed', CANCELLED: 'Cancelled' };

function drugLabel(drug) {
  return [drug.genericName, drug.strength, drug.dosageForm].filter(Boolean).join(' ') + (drug.brandName ? ` (${drug.brandName})` : '');
}

/** Pick a likely drug for a free-text line: same generic name, then same strength. */
function guessDrug(item, drugs) {
  const name = item.drugName.toLowerCase();
  const candidates = drugs.filter((d) => name.includes(d.genericName.toLowerCase()) || (d.brandName && name.includes(d.brandName.toLowerCase())));
  return candidates.find((d) => !item.strength || (d.strength || '').replace(/\s/g, '') === item.strength.replace(/\s/g, '')) || candidates[0] || null;
}

export function PharmacyDispensingPage() {
  const { dispatch } = useAppStore();
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState('');

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(listItems(await pharmacyService.queue(apiClient, status)));
    } catch (error) {
      toast('error', error?.message || 'Prescriptions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    if (!openId) load();
  }, [load, openId]);

  if (openId) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => setOpenId('')}><ArrowLeft className="h-4 w-4" /> Back to prescriptions</Button>
        <DispensePanel prescriptionId={openId} toast={toast} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Pharmacy" title="Dispensing" description="Prescriptions from the clinics, oldest first." />
      <Card
        title="Prescriptions"
        actions={<Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      >
        <div role="tablist" aria-label="Prescription status" className="mb-4 flex gap-2">
          {[['PENDING', 'To dispense'], ['DISPENSED', 'Dispensed']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={status === id} onClick={() => setStatus(id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${status === id ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
        <DataTable
          caption="Prescriptions"
          emptyMessage={loading ? 'Loading…' : status === 'PENDING' ? 'Nothing waiting to be dispensed.' : 'No dispensed prescriptions yet.'}
          rows={rows}
          columns={[
            { key: 'patient', label: 'Patient', mobilePrimary: true, render: (row) => (
              <span>
                <span className="font-semibold text-slate-900">{patientName(row.patient)}</span>
                <span className="block text-xs text-slate-500">{row.patient.patientCode}{row.patient.allergies?.length ? ' · has allergies' : ''}</span>
              </span>
            ) },
            { key: 'prescriptionCode', label: 'Prescription' },
            { key: 'items', label: 'Medicines', render: (row) => row.items.map((i) => i.drugName).join(', ') },
            { key: 'prescriber', label: 'Prescriber', render: (row) => row.prescriber?.name || '—' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={STATUS_LABEL[row.status] || row.status} /> },
            { key: 'createdAt', label: 'Written', render: (row) => formatDateTime(row.createdAt) },
            { key: 'actions', label: 'Actions', render: (row) => <Button size="sm" onClick={() => setOpenId(row.id)}><Pill className="h-3.5 w-3.5" /> {row.status === 'DISPENSED' ? 'View' : 'Dispense'}</Button> }
          ]}
        />
      </Card>
    </div>
  );
}

function DispensePanel({ prescriptionId, toast }) {
  const [rx, setRx] = useState(null);
  const [drugs, setDrugs] = useState([]);
  const [lines, setLines] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [prescription, drugList] = await Promise.all([pharmacyService.prescription(apiClient, prescriptionId), pharmacyService.drugs(apiClient)]);
    const activeDrugs = listItems(drugList);
    setRx(prescription);
    setDrugs(activeDrugs);
    const next = {};
    for (const item of prescription.items) {
      const remaining = item.quantity == null ? null : Math.max(0, item.quantity - item.quantityDispensed);
      const drug = activeDrugs.find((d) => d.id === item.drugId) || guessDrug(item, activeDrugs);
      next[item.id] = {
        include: remaining !== 0 && !(item.quantity == null && item.quantityDispensed > 0),
        drugId: drug?.id || '',
        quantity: remaining ?? 1
      };
    }
    setLines(next);
  }, [prescriptionId]);

  useEffect(() => {
    load().catch((e) => toast('error', e?.message || 'Prescription could not be loaded.'));
  }, [load, toast]);

  const drugById = useMemo(() => new Map(drugs.map((d) => [d.id, d])), [drugs]);

  if (!rx) return <Card><p className="text-sm text-slate-500">Loading prescription…</p></Card>;

  const pending = rx.status === 'ACTIVE' || rx.status === 'PARTIALLY_DISPENSED';
  const chosen = rx.items.filter((item) => lines[item.id]?.include);
  const ready = pending && chosen.length > 0 && chosen.every((item) => lines[item.id].drugId && Number(lines[item.id].quantity) > 0);
  const setLine = (id, patch) => setLines((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  async function dispense() {
    const payload = { items: chosen.map((item) => ({ prescriptionItemId: item.id, drugId: lines[item.id].drugId, quantity: Number(lines[item.id].quantity) })) };
    setBusy(true);
    try {
      let updated;
      try {
        updated = await pharmacyService.dispense(apiClient, rx.id, payload);
      } catch (error) {
        if (!isAllergyConflict(error)) throw error;
        const reason = window.prompt(`${error.message}\n\nReason for dispensing anyway (e.g. prescriber confirmed):`);
        if (!reason || reason.trim().length < 5) throw new Error('Not dispensed: an allergy override needs a reason (at least 5 characters).');
        updated = await pharmacyService.dispense(apiClient, rx.id, { ...payload, allergyOverrideReason: reason.trim() });
      }
      toast('success', updated.status === 'DISPENSED' ? 'Dispensed in full.' : 'Part dispensed; the rest stays in the queue.');
      await load();
    } catch (error) {
      toast('error', error?.message || 'Dispensing failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{rx.prescriptionCode}{rx.encounter ? ` · ${rx.encounter.encounterCode}` : ''} · {rx.prescriber?.name || ''}</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">{patientName(rx.patient)}</h2>
        <p className="text-sm text-slate-600">{[rx.patient.patientCode, ageLabel(rx.patient.dateOfBirth), rx.patient.gender].filter(Boolean).join(' · ')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {rx.patient.allergies?.length ? rx.patient.allergies.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Allergy: {a.substance}{a.reaction ? ` (${a.reaction})` : ''}
            </span>
          )) : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">No known allergies recorded</span>}
        </div>
        {rx.allergyOverride && <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-900"><span className="font-semibold">Prescriber override:</span> {rx.allergyOverride}</p>}
      </Card>

      <Card title="Medicines" subtitle={pending ? 'Choose the stock item for each line; stock is taken from the batch that expires first.' : STATUS_LABEL[rx.status]}>
        <ul className="space-y-3">
          {rx.items.map((item) => {
            const line = lines[item.id] || {};
            const drug = drugById.get(line.drugId);
            const remaining = item.quantity == null ? null : item.quantity - item.quantityDispensed;
            return (
              <li key={item.id} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{[item.drugName, item.strength, item.dosageForm].filter(Boolean).join(' ')}</p>
                    <p className="text-sm text-slate-600">{item.dose} {item.route}, {item.frequency}{item.durationDays ? ` for ${item.durationDays} days` : ''}{item.instructions ? ` · ${item.instructions}` : ''}</p>
                    <p className="text-xs text-slate-500">Prescribed {item.quantity ?? '—'} · dispensed {item.quantityDispensed}</p>
                  </div>
                  {pending && remaining !== 0 && (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" className="h-4 w-4 accent-clinical-600" checked={Boolean(line.include)} onChange={(e) => setLine(item.id, { include: e.target.checked })} /> Supply now
                    </label>
                  )}
                </div>
                {pending && line.include && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px]">
                    <select className={inputClass} aria-label={`Stock item for ${item.drugName}`} value={line.drugId} onChange={(e) => setLine(item.id, { drugId: e.target.value })}>
                      <option value="">Choose stock item…</option>
                      {drugs.map((d) => <option key={d.id} value={d.id}>{drugLabel(d)} — {d.onHand} {d.unit}(s)</option>)}
                    </select>
                    <input type="number" min="1" max={remaining ?? undefined} aria-label={`Quantity of ${item.drugName}`} className={inputClass} value={line.quantity} onChange={(e) => setLine(item.id, { quantity: e.target.value })} />
                    {drug && Number(line.quantity) > drug.onHand && <p className="text-xs font-semibold text-red-600 sm:col-span-2">Only {drug.onHand} in stock.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {pending && (
          <div className="mt-4">
            <Button disabled={!ready || busy} onClick={dispense}><Pill className="h-4 w-4" /> {busy ? 'Dispensing…' : 'Dispense'}</Button>
          </div>
        )}
      </Card>

      {rx.dispensations?.length > 0 && (
        <Card title="Dispensing history">
          <ul className="divide-y divide-slate-100 text-sm">
            {rx.dispensations.map((d) => (
              <li key={d.id} className="py-2">
                <span className="font-semibold">{d.dispensationCode}</span> · {formatDateTime(d.dispensedAt)} · {d.dispensedBy?.name || ''}
                {d.allergyOverride && <span className="block text-xs text-amber-800">Allergy override: {d.allergyOverride}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
