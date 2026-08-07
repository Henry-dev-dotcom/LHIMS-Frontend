import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Search, ScanLine } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { describeOrderItems, getScanCatalogItems, getScanOrders } from '../../utils/orderViews';
import { formatDateTime } from '../../utils/formatters';

export function ScanAcceptPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const scanOrders = useMemo(() => getScanOrders(data).filter((order) => order.status !== 'Submitted' && order.status !== 'Cancelled'), [data]);
  const activeOrder = scanOrders.find((order) => order.id === state.ui.activeScanAcceptOrderId)
    || scanOrders.find((order) => [order.id, order.patient?.fullName, describeOrderItems(order.items)].join(' ').toLowerCase().includes(query.toLowerCase()))
    || scanOrders[0];
  const scanItems = activeOrder ? getScanCatalogItems(activeOrder, data.catalog || []) : [];
  const firstItem = scanItems[0];
  const matchingEquipment = (data.scanEquipment || []).find((item) => !firstItem?.modality || item.modality === firstItem.modality) || (data.scanEquipment || [])[0] || { room: 'Pending room assignment', machine: 'Pending machine assignment' };
  const [acceptance, setAcceptance] = useState({ room: matchingEquipment.room || '', machine: matchingEquipment.machine || '', bookedAt: '', technicianNotes: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [rejectAction, setRejectAction] = useState('Retake Requested');
  const accepted = (data.scanBookings || []).find((booking) => booking.orderId === activeOrder?.id && booking.status === 'Accepted');

  const selectOrder = (order) => {
    dispatch({ type: 'OPEN_SCAN_ACCEPT', orderId: order.id });
    const selectedItems = getScanCatalogItems(order, data.catalog || []);
    const equipment = (data.scanEquipment || []).find((item) => !selectedItems[0]?.modality || item.modality === selectedItems[0].modality) || (data.scanEquipment || [])[0] || { room: '', machine: '' };
    setAcceptance({ room: equipment.room || '', machine: equipment.machine || '', bookedAt: '', technicianNotes: '' });
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Imaging · Accept Scan" title="Accept Scan Request" description="Review the patient, doctor, scan list and clinical notes before accepting imaging work. Accepting does not move you automatically; continue accepting other requests when needed." />
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card title="Find scan request" subtitle="Search by patient, order ID or scan name.">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient name or order ID..." aria-label="Search patient name or order ID" />
          </div>
          <div className="space-y-2">
            {scanOrders.filter((order) => !query || [order.id, order.patient?.fullName, describeOrderItems(order.items)].join(' ').toLowerCase().includes(query.toLowerCase())).slice(0, 10).map((order) => (
              <button key={order.id} onClick={() => selectOrder(order)} className={`w-full rounded-2xl border p-3 text-left ${activeOrder?.id === order.id ? 'border-clinical-300 bg-clinical-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <p className="font-bold text-slate-900">{order.patient?.fullName}</p>
                <p className="text-xs text-slate-500">{order.id} · {describeOrderItems(order.items)}</p>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Scan acceptance panel" subtitle="Accept the imaging request, then process it later from Accepted Scans.">
          {!activeOrder ? <p className="text-sm text-slate-500">No imaging order selected.</p> : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="font-bold text-slate-900">{activeOrder.patient?.fullName}</p><p className="text-sm text-slate-500">{activeOrder.patient?.id} · {activeOrder.patient?.phone}</p></div>
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Doctor / Hospital</p><p className="font-bold text-slate-900">{activeOrder.doctor?.name}</p><p className="text-sm text-slate-500">{activeOrder.hospital?.name}</p></div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinical notes</p><p className="mt-2 text-sm leading-6 text-slate-700">{activeOrder.clinicalNotes || 'No clinical notes provided.'}</p></div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Requested scans</p>
                {scanItems.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No scan items found for this order.</p> : scanItems.map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span className="font-bold text-slate-900"><ScanLine className="mr-2 inline h-4 w-4 text-purple-600" />{item.name}</span><StatusBadge status={item.modality || 'Imaging'} /></div>)}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Room"><input className={inputClass} value={acceptance.room} onChange={(event) => setAcceptance((prev) => ({ ...prev, room: event.target.value }))} /></FormField>
                <FormField label="Machine"><input className={inputClass} value={acceptance.machine} onChange={(event) => setAcceptance((prev) => ({ ...prev, machine: event.target.value }))} /></FormField>
                <FormField label="Proposed scan time"><input type="datetime-local" className={inputClass} value={acceptance.bookedAt} onChange={(event) => setAcceptance((prev) => ({ ...prev, bookedAt: event.target.value }))} /></FormField>
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Requested</p><p className="font-bold text-slate-900">{formatDateTime(activeOrder.createdAt)}</p></div>
              </div>
              <FormField label="Technician notes"><textarea rows="3" className={inputClass} value={acceptance.technicianNotes} onChange={(event) => setAcceptance((prev) => ({ ...prev, technicianNotes: event.target.value }))} /></FormField>
              {accepted ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-bold text-emerald-800">Scan accepted: {accepted.id}</p><p className="text-sm text-emerald-700">Accepted by {accepted.acceptedBy} at {formatDateTime(accepted.acceptedAt || accepted.bookedAt)}</p></div> : <Button onClick={() => dispatch({ type: 'ACCEPT_SCAN_ORDER', orderId: activeOrder.id, payload: { ...acceptance, modality: firstItem?.modality || 'Imaging' } })}><CheckCircle2 className="h-4 w-4" /> Accept Scan</Button>}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">Reject / Retake request</p>
                <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                  <select className={inputClass} value={rejectAction} onChange={(event) => setRejectAction(event.target.value)} aria-label="Reject or retake action"><option>Retake Requested</option><option>Rejected</option></select>
                  <input className={inputClass} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reason, e.g. wrong protocol, patient movement, preparation incomplete..." aria-label="Rejection or retake reason" />
                  <Button variant="secondary" onClick={() => dispatch({ type: 'REJECT_SCAN_ORDER', payload: { orderId: activeOrder.id, reason: rejectReason, actionNeeded: rejectAction } })}><AlertTriangle className="h-4 w-4" /> Save</Button>
                </div>
              </div>
              <Button variant="secondary" onClick={() => dispatch({ type: 'OPEN_ACCEPTED_SCAN', orderId: activeOrder.id })}><CalendarDays className="h-4 w-4" /> Go to Accepted Scans</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
