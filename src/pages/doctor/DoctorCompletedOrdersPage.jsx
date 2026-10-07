import { useMemo, useState } from 'react';
import { Download, Eye, Search } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { formatDateTime } from '../../utils/formatters';
import { openReportPrintWindow } from '../../utils/reporting';
import { getDoctorContextFromState, getReportForOrder, orderItemsText } from './doctorUtils';
import { ClippedList } from '../../components/ui/ClippedList';

function hasDepartment(order, department) {
  return (order.items || []).some((item) => item.department === department);
}

function hasAbnormal(order) {
  return (order.results || []).some((result) => (result.parameters || []).some((row) => ['High', 'Low', 'Critical'].includes(row.flag)) || result.abnormal);
}

function DetailedResultModal({ order, data, dispatch, onClose }) {
  if (!order) return null;
  return (
    <Modal
      open={Boolean(order)}
      title={`${order.id} · Completed Order`}
      description="Finalized results with reference ranges, abnormal flags, and report download."
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={() => { const report = getReportForOrder(data, order.id); if (report) dispatch({ type: 'MARK_REPORT_DOWNLOADED', reportId: report.id }); openReportPrintWindow({ ...order, resultReport: report }); }}><Download className="h-4 w-4" /> Download Report PDF</Button></>}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="mt-2 font-bold text-slate-900">{order.patient?.fullName}</p><p className="text-sm text-slate-500">{order.patient?.id}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Released</p><p className="mt-2 font-bold text-slate-900">{formatDateTime(order.updatedAt)}</p><p className="text-sm text-slate-500">{orderItemsText(order)}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status</p><div className="mt-2"><StatusBadge status={order.status} /></div><p className="mt-2 text-sm text-slate-500">Prices hidden from clinicians.</p></div>
        </div>
        {order.results.map((result) => (
          <Card key={result.id} title={`${result.department} · ${result.status}`} subtitle={result.reportText}>
            {result.parameters?.length ? (
              <DataTable
                columns={[
                  { key: 'name', label: 'Parameter' },
                  { key: 'value', label: 'Value', render: (row) => <span className="font-bold text-slate-900">{row.value} {row.unit}</span> },
                  { key: 'referenceRange', label: 'Reference Range' },
                  { key: 'flag', label: 'Flag', render: (row) => <StatusBadge status={row.flag} /> }
                ]}
                rows={result.parameters.map((row, index) => ({ ...row, id: `${result.id}-${index}` }))}
              />
            ) : <div className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{result.reportText}</div>}
          </Card>
        ))}
      </div>
    </Modal>
  );
}

export function DoctorCompletedOrdersPage() {
  const { state, dispatch } = useAppStore();
  const { data, completedOrders } = getDoctorContextFromState(state);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const summary = useMemo(() => ({
    all: completedOrders.length,
    lab: completedOrders.filter((order) => hasDepartment(order, 'Laboratory')).length,
    scan: completedOrders.filter((order) => hasDepartment(order, 'Imaging')).length,
    abnormal: completedOrders.filter(hasAbnormal).length
  }), [completedOrders]);

  const rows = useMemo(() => {
    const term = search.toLowerCase();
    return completedOrders.filter((order) => {
      if (resultFilter === 'Laboratory' && !hasDepartment(order, 'Laboratory')) return false;
      if (resultFilter === 'Imaging' && !hasDepartment(order, 'Imaging')) return false;
      if (resultFilter === 'Abnormal' && !hasAbnormal(order)) return false;
      if (!term) return true;
      return [order.id, order.patient?.fullName, order.patient?.id, orderItemsText(order)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [completedOrders, search, resultFilter]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Clinician Portal"
        title="Completed Orders"
        description="A clean archive of finalized orders with direct result viewing and PDF/report download actions."
      />

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['Completed', summary.all], ['Lab Results', summary.lab], ['Scan Reports', summary.scan], ['Abnormal Flags', summary.abnormal]
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xl font-bold text-slate-900">{value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <Card
        title="My Completed Orders"
        subtitle="Filter released orders by lab results, scan reports, or abnormal flags."
        actions={(
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-80 sm:flex-none"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search completed order, patient, test..." aria-label="Search completed order, patient, test" /></div>
            <select className={inputClass} value={resultFilter} onChange={(event) => setResultFilter(event.target.value)} aria-label="Filter by result type"><option value="">All result types</option><option value="Laboratory">Lab results</option><option value="Imaging">Scan reports</option><option value="Abnormal">Abnormal only</option></select>
          </div>
        )}
      >
        <DataTable
          columns={[
            { key: 'id', label: 'Order ID', render: (order) => <span className="font-bold text-slate-900">{order.id}</span> },
            { key: 'patient', label: 'Patient', render: (order) => <div><p className="font-bold">{order.patient?.fullName}</p><p className="text-xs text-slate-500">{order.patient?.id}</p></div> },
            { key: 'items', label: 'Tests / Scans', render: (order) => <ClippedList items={order.items} /> },
            { key: 'released', label: 'Released', render: (order) => formatDateTime(order.updatedAt) },
            { key: 'status', label: 'Status', render: (order) => <StatusBadge status={hasAbnormal(order) ? 'Abnormal' : order.status} /> },
            { key: 'actions', label: 'Actions', render: (order) => <div className="flex gap-2"><Button variant="secondary" onClick={() => setSelectedOrder(order)}><Eye className="h-4 w-4" /> View</Button><Button onClick={() => { const report = getReportForOrder(data, order.id); if (report) dispatch({ type: 'MARK_REPORT_DOWNLOADED', reportId: report.id }); openReportPrintWindow({ ...order, resultReport: report }); }}><Download className="h-4 w-4" /> PDF</Button></div> }
          ]}
          rows={rows}
          emptyMessage="No completed orders match your filters."
        />
      </Card>
      <DetailedResultModal order={selectedOrder} data={data} dispatch={dispatch} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}
