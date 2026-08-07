import { useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { describeOrderItems, getScanOrders } from '../../utils/orderViews';
import { formatDateTime } from '../../utils/formatters';

export function ScanRejectedPage() {
  const { state } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const scanOrders = useMemo(() => getScanOrders(data), [data]);
  const rows = (data.scanRejections || []).map((item) => {
    const order = scanOrders.find((order) => order.id === item.orderId);
    return { ...item, order, patient: order?.patient, doctor: order?.doctor };
  }).filter((row) => row.order).filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.id, row.orderId, row.patient?.fullName, row.reason, row.actionNeeded, describeOrderItems(row.order?.items)].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
  });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Imaging · Rejected / Retake" title="Rejected / Retake Scans" description="Track imaging cases rejected for incomplete preparation, poor images, patient movement, wrong protocol, or retake requests." />
      <div className="grid gap-4 md:grid-cols-3"><Card className="clinical-stat-card p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Issues</p><p className="mt-1 text-xl font-bold text-slate-900">{rows.length}</p></Card><Card className="clinical-stat-card p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Retake Requested</p><p className="mt-1 text-xl font-bold text-slate-900">{rows.filter((r) => r.actionNeeded === 'Retake Requested').length}</p></Card><Card className="clinical-stat-card p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Rejected</p><p className="mt-1 text-xl font-bold text-slate-900">{rows.filter((r) => r.actionNeeded === 'Rejected').length}</p></Card></div>
      <Card title="Rejected / retake register" subtitle="Search patient, order, scan name, action or reason.">
        <div className="relative mb-4"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rejected or retake scans..." aria-label="Search rejected or retake scans" /></div>
        <DataTable columns={[{ key: 'id', label: 'Issue ID', render: (row) => <span className="font-bold text-slate-900">{row.id}</span> }, { key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName}</p><p className="text-xs text-slate-500">{row.patient?.id}</p></div> }, { key: 'orderId', label: 'Order' }, { key: 'scans', label: 'Scan(s)', render: (row) => describeOrderItems(row.order?.items) }, { key: 'actionNeeded', label: 'Action', render: (row) => <StatusBadge status={row.actionNeeded} /> }, { key: 'reason', label: 'Reason', render: (row) => <span className="text-sm font-semibold text-slate-700"><AlertTriangle className="mr-1 inline h-4 w-4 text-amber-500" />{row.reason}</span> }, { key: 'createdAt', label: 'Logged', render: (row) => formatDateTime(row.createdAt) }]} rows={rows} emptyMessage="No rejected or retake imaging cases yet." />
      </Card>
    </div>
  );
}
