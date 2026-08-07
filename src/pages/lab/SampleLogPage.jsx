import { useMemo, useState } from 'react';
import { Database, TestTube2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, getById } from '../../utils/formatters';
import { getLabOrders, describeOrderItems } from '../../utils/orderViews';

export function SampleLogPage() {
  const { state, dispatch } = useAppStore();
  const labOrders = useMemo(() => getLabOrders(state.data).filter((order) => ['Confirmed', 'In Progress', 'Pending Review'].includes(order.status)), [state.data]);
  const [form, setForm] = useState({ orderId: labOrders[0]?.id || '', sampleType: 'Blood', collectedBy: state.auth?.userName || '', collectedAt: '' });
  const [query, setQuery] = useState('');
  const rows = useMemo(() => (state.data.sampleLogs || []).map((sample) => {
    const order = getById(state.data.orders || [], sample.orderId);
    const labOrder = order ? getLabOrders(state.data).find((item) => item.id === order.id) : null;
    return { ...sample, order: labOrder || order };
  }).filter((sample) => {
    const search = `${sample.id} ${sample.orderId} ${sample.sampleType} ${sample.collectedBy} ${sample.order?.patient?.fullName || ''}`.toLowerCase();
    return !query || search.includes(query.toLowerCase());
  }), [state.data, query]);

  const columns = [
    { key: 'id', label: 'Sample ID' },
    { key: 'orderId', label: 'Order' },
    { key: 'patient', label: 'Patient', render: (row) => row.order?.patient?.fullName || getById(state.data.patients || [], row.order?.patientId)?.fullName || '—' },
    { key: 'sampleType', label: 'Sample Type' },
    { key: 'collectedBy', label: 'Collected By' },
    { key: 'collectedAt', label: 'Collection Time', render: (row) => formatDateTime(row.collectedAt) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'reason', label: 'Reason', render: (row) => <span className="max-w-xs whitespace-normal text-xs font-semibold text-slate-500">{row.rejectionReason || '—'}</span> }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Laboratory Unit"
        title="Sample collection log"
        description="Track sample ID, collection time, collector, sample type, acceptance status, rejection reasons and recollection requirements."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Samples Logged" value={(state.data.sampleLogs || []).length} icon={Database} tone="blue" />
        <MetricCard label="Accepted" value={(state.data.sampleLogs || []).filter((sample) => sample.status === 'Accepted').length} icon={CheckCircle2} tone="green" />
        <MetricCard label="Rejected" value={(state.data.sampleLogs || []).filter((sample) => sample.status === 'Rejected').length} icon={AlertTriangle} tone="red" />
        <MetricCard label="Open Lab Orders" value={labOrders.length} icon={TestTube2} tone="yellow" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card title="Log new sample" subtitle="Create a collection record and move confirmed orders into lab processing.">
          <div className="space-y-4">
            <FormField label="Lab order"><select className={inputClass} value={form.orderId} onChange={(event) => setForm((prev) => ({ ...prev, orderId: event.target.value }))}>
              <option value="">Select order</option>
              {labOrders.map((order) => <option key={order.id} value={order.id}>{order.id} — {order.patient?.fullName} — {describeOrderItems(order.items)}</option>)}
            </select></FormField>
            <FormField label="Sample type"><select className={inputClass} value={form.sampleType} onChange={(event) => setForm((prev) => ({ ...prev, sampleType: event.target.value }))}>
              {['Blood', 'Urine', 'Serum', 'Plasma', 'Swab', 'Stool'].map((type) => <option key={type}>{type}</option>)}
            </select></FormField>
            <FormField label="Collected by"><input className={inputClass} value={form.collectedBy} onChange={(event) => setForm((prev) => ({ ...prev, collectedBy: event.target.value }))} /></FormField>
            <FormField label="Collection time"><input type="datetime-local" className={inputClass} value={form.collectedAt} onChange={(event) => setForm((prev) => ({ ...prev, collectedAt: event.target.value }))} /></FormField>
            <Button className="w-full" onClick={() => dispatch({ type: 'ADD_SAMPLE_LOG', payload: form })}>Save sample log</Button>
          </div>
        </Card>

        <Card title="All sample records" subtitle="Search samples by sample ID, order, patient, type or collector.">
          <input aria-label="Search sample records" className={`${inputClass} mb-4`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sample records" />
          <DataTable columns={columns} rows={rows} emptyMessage="No sample records yet." />
        </Card>
      </div>
    </div>
  );
}
