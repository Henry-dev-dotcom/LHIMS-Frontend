import { useState } from 'react';
import { RefreshCcw, Search } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { getLabOrders } from '../../utils/orderViews';
import { formatDateTime } from '../../utils/formatters';

export function LabRejectedSamplesPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const labOrders = getLabOrders(data);
  const rows = (data.sampleLogs || [])
    .filter((sample) => ['Rejected', 'Recollection Requested'].includes(sample.status))
    .map((sample) => {
      const order = labOrders.find((item) => item.id === sample.orderId);
      return { ...sample, order, patient: order?.patient, doctor: order?.doctor };
    })
    .filter((row) => row.order)
    .filter((row) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [row.id, row.orderId, row.patient?.fullName, row.patient?.id, row.rejectionReason, row.recollectionReason].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Laboratory · Retest / Recollection" title="Rejected & Retest Samples" description="Track rejected samples, recollection requests and retest reasons from the lab workflow." />
      <Card title="Rejected / recollection tracker" subtitle="Use this page to follow samples that need recollection or retesting.">
        <div className="relative mb-4"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input aria-label="Search sample, patient, order or reason" className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sample, patient, order or reason..." /></div>
        <DataTable
          columns={[
            { key: 'id', label: 'Sample ID', render: (row) => <span className="font-bold text-slate-900">{row.id}</span> },
            { key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName}</p><p className="text-xs text-slate-500">{row.patient?.id}</p></div> },
            { key: 'orderId', label: 'Order' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'reason', label: 'Reason', render: (row) => row.recollectionReason || row.rejectionReason || '—' },
            { key: 'date', label: 'Updated', render: (row) => formatDateTime(row.recollectionRequestedAt || row.rejectedAt || row.acceptedAt || row.collectedAt) },
            { key: 'actions', label: 'Action', render: (row) => <Button variant="secondary" onClick={() => { const reason = window.prompt('Recollection / retest note?', row.recollectionReason || row.rejectionReason || ''); if (reason) dispatch({ type: 'REQUEST_SAMPLE_RECOLLECTION', sampleId: row.id, reason }); }}><RefreshCcw className="h-4 w-4" /> Request Recollection</Button> }
          ]}
          rows={rows}
          emptyMessage="No rejected or retest samples yet."
        />
      </Card>
    </div>
  );
}
