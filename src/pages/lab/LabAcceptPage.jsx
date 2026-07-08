import { useMemo, useState } from 'react';
import { CheckCircle2, FlaskConical, Search, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { describeOrderItems, getLabOrders } from '../../utils/orderViews';
import { formatDateTime } from '../../utils/formatters';

export function LabAcceptPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const labOrders = useMemo(() => getLabOrders(data), [data]);
  const activeOrder = labOrders.find((order) => order.id === state.ui.activeLabAcceptOrderId) || labOrders.find((order) => [order.id, order.patient?.fullName].join(' ').toLowerCase().includes(query.toLowerCase())) || labOrders[0];
  const acceptedSample = (data.sampleLogs || []).find((sample) => sample.orderId === activeOrder?.id && sample.status === 'Accepted');
  const rejectedSamples = (data.sampleLogs || []).filter((sample) => sample.orderId === activeOrder?.id && sample.status === 'Rejected');

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Laboratory · Sample Acceptance" title="Accept Lab Sample" description="Review patient/order details. Once the sample is accepted, the case opens directly in the diagnostic result-entry workspace." />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Card title="Find lab request" subtitle="Search a patient or order if you came directly to this page.">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient name or order ID..." />
          </div>
          <div className="space-y-2">
            {labOrders.filter((order) => !query || [order.id, order.patient?.fullName, describeOrderItems(order.items)].join(' ').toLowerCase().includes(query.toLowerCase())).slice(0, 8).map((order) => (
              <button key={order.id} onClick={() => dispatch({ type: 'OPEN_LAB_ACCEPT', orderId: order.id })} className={`w-full rounded-2xl border p-3 text-left ${activeOrder?.id === order.id ? 'border-clinical-300 bg-clinical-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <p className="font-bold text-slate-900">{order.patient?.fullName}</p>
                <p className="text-xs text-slate-500">{order.id} · {describeOrderItems(order.items)}</p>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Diagnostic routing panel" subtitle="Accept the received specimen and send it straight to diagnostics, or reject it with a reason for recollection.">
          {!activeOrder ? <p className="text-sm text-slate-500">No lab order selected.</p> : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="font-bold text-slate-900">{activeOrder.patient?.fullName}</p><p className="text-sm text-slate-500">{activeOrder.patient?.id} · {activeOrder.patient?.phone}</p></div>
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Doctor / Hospital</p><p className="font-bold text-slate-900">{activeOrder.doctor?.name}</p><p className="text-sm text-slate-500">{activeOrder.hospital?.name}</p></div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinical notes</p><p className="mt-2 text-sm leading-6 text-slate-700">{activeOrder.clinicalNotes || 'No clinical notes provided.'}</p></div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Requested lab tests</p>
                {activeOrder.items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span className="font-bold text-slate-900"><FlaskConical className="mr-2 inline h-4 w-4 text-clinical-600" />{item.name}</span><StatusBadge status={item.id} /></div>)}
              </div>
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Requested</p><p className="font-bold text-slate-900">{formatDateTime(activeOrder.createdAt)}</p></div>
              {acceptedSample ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-bold text-emerald-800">Sample accepted: {acceptedSample.id}</p><p className="text-sm text-emerald-700">Accepted by {acceptedSample.acceptedBy || acceptedSample.collectedBy} at {formatDateTime(acceptedSample.acceptedAt || acceptedSample.collectedAt)}</p></div> : <Button onClick={() => dispatch({ type: 'ACCEPT_LAB_SAMPLE', orderId: activeOrder.id, payload: {} })}><CheckCircle2 className="h-4 w-4" /> Send to Diagnostics</Button>}
              <Button variant="danger" onClick={() => { const reason = window.prompt('Reason for rejection / recollection?'); if (reason) dispatch({ type: 'REJECT_SAMPLE', sampleId: acceptedSample?.id || '', reason }); }} disabled={!acceptedSample}><XCircle className="h-4 w-4" /> Reject Accepted Sample</Button>
              {rejectedSamples.length > 0 && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Rejected history: {rejectedSamples.map((sample) => `${sample.id}: ${sample.rejectionReason}`).join(' · ')}</div>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
