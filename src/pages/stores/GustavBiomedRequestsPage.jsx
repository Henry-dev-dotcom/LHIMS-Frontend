import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Plus, RefreshCw, Wrench } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { analyzerService } from '../../services/analyzerService';
import { gustavBiomedService } from '../../services/gustavBiomedService';
import { can } from '../opd/opdUtils';

const CATEGORY_LABELS = {
  MEDICAL_EQUIPMENT: 'Medical equipment',
  LABORATORY_EQUIPMENT: 'Laboratory equipment',
  REAGENTS: 'Reagents'
};
const STATUS_LABELS = {
  PENDING: ['Pending follow-up', 'bg-amber-100 text-amber-900'],
  ACKNOWLEDGED: ['Acknowledged', 'bg-sky-100 text-sky-900'],
  SCHEDULED: ['Scheduled', 'bg-violet-100 text-violet-900'],
  COMPLETED: ['Completed', 'bg-emerald-100 text-emerald-900'],
  DECLINED: ['Declined', 'bg-red-100 text-red-800'],
  CANCELLED: ['Cancelled', 'bg-slate-200 text-slate-600']
};
const NEXT_STATUSES = {
  PENDING: ['ACKNOWLEDGED', 'SCHEDULED', 'DECLINED', 'CANCELLED'],
  ACKNOWLEDGED: ['SCHEDULED', 'COMPLETED', 'DECLINED', 'CANCELLED'],
  SCHEDULED: ['COMPLETED', 'DECLINED', 'CANCELLED'],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: []
};
const pill = (status) => {
  const [label, classes] = STATUS_LABELS[status] || [status, 'bg-slate-100 text-slate-700'];
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${classes}`}>{label}</span>;
};
const freshForm = (kind) => ({
  requestingUnit: kind === 'supply' ? 'Stores' : 'Laboratory',
  supplyCategory: 'MEDICAL_EQUIPMENT',
  itemDescription: '',
  quantity: '1',
  quantityUnit: 'unit',
  analyzerDeviceId: '',
  analyzerName: '',
  serviceDescription: 'Routine preventive maintenance',
  preferredServiceDate: '',
  notes: '',
  confirmNoPatientData: false
});

/** Internal request tracking for the facility's Gustav Biomed partnership. */
export function GustavBiomedRequestsPage({ mode = 'supplies' }) {
  const { state, dispatch } = useAppStore();
  const maintenanceMode = mode === 'maintenance';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyzers, setAnalyzers] = useState([]);
  const [form, setForm] = useState(() => freshForm(maintenanceMode ? 'maintenance' : 'supply'));
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);
  const canCreate = maintenanceMode
    ? can(state.auth, 'lab:analyzers:maintenance-request')
    : can(state.auth, 'stores:order');
  const canManage = can(state.auth, 'stores:manage');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = maintenanceMode
        ? await gustavBiomedService.maintenanceRequests(apiClient)
        : await gustavBiomedService.storeRequests(apiClient);
      setRows(listItems(response));
    } catch (error) {
      toast('error', error?.message || 'Gustav Biomed requests could not be loaded.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [maintenanceMode, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!maintenanceMode) {
      setAnalyzers([]);
      return undefined;
    }
    let cancelled = false;
    analyzerService.devices(apiClient)
      .then((response) => { if (!cancelled) setAnalyzers(listItems(response)); })
      .catch(() => { if (!cancelled) setAnalyzers([]); });
    return () => { cancelled = true; };
  }, [maintenanceMode]);

  const openForm = () => {
    setForm(freshForm(maintenanceMode ? 'maintenance' : 'supply'));
    setModalOpen(true);
  };

  const updateStatus = async (request, status) => {
    if (!status || status === request.status) return;
    try {
      await gustavBiomedService.updateStatus(apiClient, request.id, { status });
      toast('success', `${request.requestCode} marked ${status.toLowerCase().replace(/_/g, ' ')}.`);
      load();
    } catch (error) {
      toast('error', error?.message || 'The request status could not be updated.');
      load();
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      if (maintenanceMode) {
        const selected = analyzers.find((device) => device.id === form.analyzerDeviceId);
        await gustavBiomedService.createMaintenanceRequest(apiClient, {
          requestingUnit: form.requestingUnit.trim(),
          confirmNoPatientData: form.confirmNoPatientData,
          analyzerDeviceId: selected?.id || undefined,
          analyzerName: selected?.name || form.analyzerName.trim() || undefined,
          serviceDescription: form.serviceDescription.trim(),
          preferredServiceDate: form.preferredServiceDate || undefined,
          notes: form.notes.trim() || undefined
        });
        toast('success', 'Analyzer maintenance request recorded for follow-up.');
      } else {
        await gustavBiomedService.createSupplyRequest(apiClient, {
          requestingUnit: form.requestingUnit.trim(),
          confirmNoPatientData: form.confirmNoPatientData,
          supplyCategory: form.supplyCategory,
          itemDescription: form.itemDescription.trim(),
          quantity: Number(form.quantity),
          quantityUnit: form.quantityUnit.trim(),
          notes: form.notes.trim() || undefined
        });
        toast('success', 'Supply request recorded for follow-up.');
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      toast('error', error?.message || 'The request could not be recorded.');
    } finally {
      setSaving(false);
    }
  };

  const ready = maintenanceMode
    ? form.confirmNoPatientData && form.requestingUnit.trim().length >= 2 && (form.analyzerDeviceId || form.analyzerName.trim().length >= 2) && form.serviceDescription.trim().length >= 3
    : form.confirmNoPatientData && form.requestingUnit.trim().length >= 2 && form.itemDescription.trim().length >= 2 && Number(form.quantity) >= 1 && Boolean(form.quantityUnit.trim());

  const columns = [
    {
      key: 'requestCode', label: 'Request', mobilePrimary: true,
      render: (request) => <div><p className="font-bold text-slate-900">{request.requestCode}</p><p className="text-xs text-slate-500">{request.supplierName}</p></div>
    },
    {
      key: 'details', label: 'Request details',
      render: (request) => request.type === 'SUPPLY'
        ? <div><p className="font-semibold text-slate-800">{request.itemDescription}</p><p className="text-xs text-slate-500">{CATEGORY_LABELS[request.supplyCategory] || 'Supply'} · {request.quantity} {request.quantityUnit}</p></div>
        : <div><p className="font-semibold text-slate-800">{request.analyzerName || request.analyzerDevice?.name || 'Analyzer'}</p><p className="text-xs text-slate-500">{request.serviceDescription}{request.preferredServiceDate ? ` · Preferred ${new Date(request.preferredServiceDate).toLocaleDateString()}` : ''}</p></div>
    },
    { key: 'unit', label: 'Unit', render: (request) => <span className="text-sm text-slate-700">{request.requestingUnit}</span> },
    {
      key: 'requestedBy', label: 'Requested by',
      render: (request) => <div><p className="text-sm font-semibold text-slate-800">{request.requestedBy?.name || 'Staff member'}</p><p className="text-xs text-slate-500">{formatDateTime(request.createdAt)}</p></div>
    },
    {
      key: 'status', label: 'Status',
      render: (request) => (
        <div className="space-y-2">
          {pill(request.status)}
          {request.statusNote && <p className="max-w-48 text-xs text-slate-500"><span className="font-semibold">Internal:</span> {request.statusNote}</p>}
          {request.vendorStatusNote && <p className="max-w-48 text-xs text-clinical-800"><span className="font-semibold">Gustav Biomed:</span> {request.vendorStatusNote}</p>}
          {canManage && (NEXT_STATUSES[request.status] || []).length > 0 && (
            <select aria-label={`Update ${request.requestCode} status`} className={`${inputClass} min-w-36 py-1.5 text-xs`} value="" onChange={(event) => updateStatus(request, event.target.value)}>
              <option value="">Update status…</option>
              {NEXT_STATUSES[request.status].map((status) => <option key={status} value={status}>{STATUS_LABELS[status]?.[0] || status}</option>)}
            </select>
          )}
        </div>
      )
    }
  ];

  const title = maintenanceMode ? 'Analyzer maintenance' : 'Gustav Biomed requests';
  const description = maintenanceMode
    ? 'Request routine service for laboratory analyzers and follow its progress.'
    : 'Request medical supplies, laboratory equipment and reagents from your supplier partner.';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={maintenanceMode ? 'Laboratory · Service requests' : 'Stores · Supplier requests'}
        title={title}
        description={description}
        actions={<><Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>{canCreate && <Button onClick={openForm}>{maintenanceMode ? <Wrench className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{maintenanceMode ? 'Request maintenance' : 'New supply request'}</Button>}</>}
      />
      <div className="rounded-2xl border border-clinical-200 bg-clinical-50 px-4 py-3 text-sm leading-6 text-clinical-900">
        Requests are saved in LHIMS for your team to coordinate. This form does not send or submit anything directly to Gustav Biomed Limited.
      </div>
      <Card title="Requests to Gustav Biomed Limited" subtitle={loading ? 'Loading…' : `${rows.length} request${rows.length === 1 ? '' : 's'}`}>
        <DataTable
          caption="Requests to Gustav Biomed Limited"
          rows={rows}
          columns={columns}
          rowBadge={(request) => request.requestCode}
          emptyMessage={loading ? 'Loading requests…' : canCreate ? 'No requests yet. Use the button above when your team needs supplies or routine analyzer service.' : 'No requests have been recorded yet.'}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={maintenanceMode ? 'Request routine analyzer maintenance' : 'Request medical supplies'}
        description={maintenanceMode ? 'Choose the instrument and describe the routine maintenance needed.' : 'Record the item and quantity your Stores team wants Gustav Biomed to supply.'}
        onClose={() => setModalOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!ready || saving}>{saving ? 'Saving…' : 'Record request'}</Button></>}
      >
        <div className="space-y-4">
          <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-950">Equipment, supply, and service details are shared with Gustav Biomed. Do not enter patient identifiers or clinical details. Your additional follow-up notes stay within your facility.</div>
          <FormField label={maintenanceMode ? 'Department or unit' : 'Requesting unit'} required>
            <input className={inputClass} maxLength={120} value={form.requestingUnit} onChange={(event) => setForm({ ...form, requestingUnit: event.target.value })} placeholder={maintenanceMode ? 'Laboratory' : 'Stores'} />
          </FormField>
          {maintenanceMode ? (
            <>
              {analyzers.length > 0 && <FormField label="Registered analyzer" help="Select a registered analyzer, or leave this blank and enter its name below."><select className={inputClass} value={form.analyzerDeviceId} onChange={(event) => setForm({ ...form, analyzerDeviceId: event.target.value })}><option value="">Not listed / enter name manually</option>{analyzers.map((device) => <option key={device.id} value={device.id}>{device.name}{device.make ? ` · ${device.make}` : ''}{device.model ? ` ${device.model}` : ''}</option>)}</select></FormField>}
              {!form.analyzerDeviceId && <FormField label="Analyzer name" required><input className={inputClass} maxLength={160} value={form.analyzerName} onChange={(event) => setForm({ ...form, analyzerName: event.target.value })} placeholder="Analyzer make and model" /></FormField>}
              <FormField label="Maintenance requested" required><textarea className={inputClass} rows={3} maxLength={1000} value={form.serviceDescription} onChange={(event) => setForm({ ...form, serviceDescription: event.target.value })} /></FormField>
              <FormField label="Preferred service date" help="A preference only; it is not a confirmed booking."><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input type="date" className={`${inputClass} pl-9`} value={form.preferredServiceDate} onChange={(event) => setForm({ ...form, preferredServiceDate: event.target.value })} /></div></FormField>
            </>
          ) : (
            <>
              <FormField label="Request category" required><select className={inputClass} value={form.supplyCategory} onChange={(event) => setForm({ ...form, supplyCategory: event.target.value })}><option value="MEDICAL_EQUIPMENT">Medical equipment and supplies</option><option value="LABORATORY_EQUIPMENT">Laboratory equipment</option><option value="REAGENTS">Reagents</option></select></FormField>
              <FormField label="Item / specification" required><textarea className={inputClass} rows={3} maxLength={500} value={form.itemDescription} onChange={(event) => setForm({ ...form, itemDescription: event.target.value })} placeholder="Item name, model or required specification" /></FormField>
              <div className="grid gap-4 sm:grid-cols-2"><FormField label="Quantity" required><input type="number" min="1" step="1" className={inputClass} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></FormField><FormField label="Unit" required><input className={inputClass} maxLength={30} value={form.quantityUnit} onChange={(event) => setForm({ ...form, quantityUnit: event.target.value })} placeholder="boxes, pieces, litres…" /></FormField></div>
            </>
          )}
          <FormField label="Additional notes" help="Visible only to your facility; not shared with Gustav Biomed."><textarea className={inputClass} rows={2} maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional details for internal follow-up" /></FormField>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-5 text-slate-700"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-teal-700" checked={form.confirmNoPatientData} onChange={(event) => setForm({ ...form, confirmNoPatientData: event.target.checked })} /><span>I confirm that the details shared with Gustav Biomed contain no patient identifiers or clinical information.</span></label>
        </div>
      </Modal>
    </div>
  );
}
