import { useMemo, useState } from 'react';
import { ClipboardList, DollarSign, FlaskConical, Info, ScanLine } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricCard } from '../../components/ui/MetricCard';
import { useAppStore } from '../../store/AppStore';
import { money } from '../../utils/formatters';

export function PriceCatalogPage() {
  const { state, dispatch } = useAppStore();
  const canEdit = ['billing', 'admin'].includes(state.auth?.role);
  const [itemId, setItemId] = useState(state.data.catalog[0]?.id || '');
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const item = state.data.catalog.find((entry) => entry.id === itemId);
  const [form, setForm] = useState({ price: item?.price || 0, expectedHours: item?.expectedHours || 4 });

  function selectItem(id, openModal = false) {
    const selected = state.data.catalog.find((entry) => entry.id === id);
    setItemId(id);
    setForm({ price: selected?.price || 0, expectedHours: selected?.expectedHours || 4 });
    if (openModal) setCatalogModalOpen(true);
  }

  function submit(event) {
    event.preventDefault();
    if (!canEdit) return;
    dispatch({ type: 'UPDATE_CATALOG_PRICE', payload: { itemId, price: form.price, expectedHours: form.expectedHours } });
  }

  const labCount = state.data.catalog.filter((entry) => entry.type === 'Lab').length;
  const scanCount = state.data.catalog.filter((entry) => entry.type === 'Scan').length;
  const catalogValue = state.data.catalog.reduce((sum, entry) => sum + Number(entry.price || 0), 0);
  const parameterRows = useMemo(() => item?.parameters || [], [item]);

  return (
    <div className="min-w-0">
      <PageHeader eyebrow="Billing / Finance" title="Test / Scan Price Catalog" description="Finance and reception can view prices. Only Billing/Admin can edit catalog pricing and expected completion settings." />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Lab items" value={labCount} icon={FlaskConical} tone="green" />
        <MetricCard label="Scan items" value={scanCount} icon={ScanLine} tone="purple" />
        <MetricCard label="Catalog price sum" value={money(catalogValue)} icon={DollarSign} tone="blue" />
      </div>

      <Card
        className="mt-6"
        title="Billable item list"
        subtitle="Grouped by department and used by doctor orders, invoices, lab queues and scan queues. Select View to open item details without taking space on the page."
      >
        <DataTable
          columns={[
            { key: 'id', label: 'Code' },
            { key: 'name', label: 'Item' },
            { key: 'type', label: 'Type', render: (row) => <StatusBadge status={row.type} /> },
            { key: 'department', label: 'Department' },
            { key: 'modality', label: 'Modality', render: (row) => row.modality || '—' },
            { key: 'price', label: 'Price', render: (row) => money(row.price) },
            { key: 'expectedHours', label: 'Expected Hours' },
            { key: 'parameters', label: 'Parameters', render: (row) => row.parameters?.length || 0 },
            {
              key: 'actions',
              label: 'Action',
              mobileActions: true,
              render: (row) => (
                <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => selectItem(row.id, true)}>
                  {canEdit ? 'View / Edit' : 'View'}
                </Button>
              )
            }
          ]}
          rows={state.data.catalog}
        />
      </Card>

      <Modal
        open={catalogModalOpen}
        title={canEdit ? 'Catalog item details / edit' : 'Catalog item details'}
        description={canEdit ? 'Review the selected billable item and update price or expected completion time.' : 'Reception has view-only access to prices for front-desk billing conversations.'}
        onClose={() => setCatalogModalOpen(false)}
        footer={canEdit ? (
          <>
            <Button variant="secondary" onClick={() => setCatalogModalOpen(false)}>Close</Button>
            <Button type="submit" form="catalog-price-form"><ClipboardList className="h-4 w-4" /> Save Catalog Item</Button>
          </>
        ) : <Button variant="secondary" onClick={() => setCatalogModalOpen(false)}>Close</Button>}
      >
        {item ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Code</p>
                <p className="mt-1 font-bold text-slate-900">{item.id}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Type</p>
                <div className="mt-1"><StatusBadge status={item.type} /></div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Price</p>
                <p className="mt-1 font-bold text-slate-900">{money(item.price)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Expected hours</p>
                <p className="mt-1 font-bold text-slate-900">{item.expectedHours}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Selected catalog item</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{item.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{item.department} {item.modality ? `• ${item.modality}` : ''}</p>
                </div>
                <div className="rounded-2xl border border-clinical-100 bg-clinical-50 px-3 py-2 text-sm font-bold text-clinical-800">
                  {parameterRows.length} parameter{parameterRows.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {canEdit && (
              <form id="catalog-price-form" onSubmit={submit} className="grid gap-4 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 sm:grid-cols-3">
                <FormField label="Catalog item">
                  <select className={inputClass} value={itemId} onChange={(event) => selectItem(event.target.value)}>
                    {state.data.catalog.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Current price">
                  <input type="number" step="0.01" className={inputClass} value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
                </FormField>
                <FormField label="Expected hours">
                  <input type="number" className={inputClass} value={form.expectedHours} onChange={(event) => setForm({ ...form, expectedHours: event.target.value })} />
                </FormField>
              </form>
            )}

            {!canEdit && (
              <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Reception can view pricing and expected completion details, but cannot edit catalog values.</p>
              </div>
            )}

            <div className="rounded-3xl border border-slate-200/80 bg-white p-4">
              <h4 className="font-bold text-slate-900">Parameters / components</h4>
              {parameterRows.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">No structured lab parameters are configured for this scan/imaging item.</p>
              ) : (
                <div className="mt-3">
                  <DataTable
                    columns={[
                      { key: 'name', label: 'Parameter', mobilePrimary: true },
                      { key: 'unit', label: 'Unit', render: (row) => row.unit || '—' },
                      { key: 'referenceRange', label: 'Reference Range', render: (row) => row.referenceRange || '—' }
                    ]}
                    rows={parameterRows.map((parameter) => ({ ...parameter, id: parameter.name }))}
                    emptyMessage="No parameters configured."
                    dense
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-slate-500">Select a catalog item to view details.</p>
        )}
      </Modal>
    </div>
  );
}
