import { useMemo, useState } from 'react';
import { Download, Eye, Search } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { formatDateTime } from '../../utils/formatters';
import { getOrderViewModel } from '../../workflow/workflowEngine';
import { openReportPrintWindow } from '../../utils/reporting';

function getReportForOrder(data, orderId) {
  return (data.resultReports || []).find((report) => report.orderId === orderId && report.status !== 'Voided');
}

function DetailedResultModal({ order, data, dispatch, onClose }) {
  if (!order) return null;
  return (
    <Modal
      open={Boolean(order)}
      title={`${order.id} · Result Viewer`}
      description="Clinician-side result review with reference ranges, abnormal flags, report text, and PDF download."
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={() => { const report = getReportForOrder(data, order.id); if (report) dispatch({ type: 'MARK_REPORT_DOWNLOADED', reportId: report.id }); openReportPrintWindow({ ...order, resultReport: report }); }}><Download className="h-4 w-4" /> Download Report PDF</Button></>}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="mt-2 font-bold text-slate-900">{order.patient?.fullName}</p><p className="text-sm text-slate-500">{order.patient?.id}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician</p><p className="mt-2 font-bold text-slate-900">{order.doctor?.name}</p><p className="text-sm text-slate-500">{order.hospital?.name}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status</p><div className="mt-2"><StatusBadge status={order.status} /></div><p className="mt-2 text-sm text-slate-500">Released {formatDateTime(order.updatedAt)}</p></div>
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

export function DoctorResultsPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const doctorId = state.auth?.linkedDoctorId || data.doctors[0]?.id;
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const orders = useMemo(() => {
    return data.orders
      .filter((order) => order.doctorId === doctorId)
      .map((order) => getOrderViewModel(order, data))
      .filter((order) => order.status === 'Final / Released' || order.results.length > 0)
      .filter((order) => {
        const term = search.toLowerCase();
        if (!term) return true;
        return [order.id, order.patient?.fullName, order.items.map((item) => item.name).join(' ')]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [data, doctorId, search]);

  return (
    <div>
      <PageHeader
        eyebrow="Clinician Portal · Result Viewer"
        title="Results Viewer"
        description="Review released results on-screen with reference ranges and abnormal-value highlighting, then download a printable PDF report."
      />
      <Card
        title="Completed / Result-Available Orders"
        subtitle="Finalized orders appear here automatically when lab or imaging results are released."
        actions={<div className="relative w-full min-w-0 sm:w-80"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search result, patient, order..." /></div>}
      >
        <DataTable
          columns={[
            { key: 'id', label: 'Order ID', render: (order) => <span className="font-bold text-slate-900">{order.id}</span> },
            { key: 'patient', label: 'Patient', render: (order) => <div><p className="font-bold">{order.patient?.fullName}</p><p className="text-xs text-slate-500">{order.patient?.id}</p></div> },
            { key: 'items', label: 'Tests / Scans', render: (order) => order.items.map((item) => item.name).join(', ') || '—' },
            { key: 'status', label: 'Status', render: (order) => <StatusBadge status={order.status} /> },
            { key: 'released', label: 'Released', render: (order) => formatDateTime(order.updatedAt) },
            { key: 'actions', label: 'Actions', render: (order) => <div className="flex gap-2"><Button variant="secondary" onClick={() => setSelectedOrder(order)}><Eye className="h-4 w-4" /> View</Button><Button onClick={() => { const report = getReportForOrder(data, order.id); if (report) dispatch({ type: 'MARK_REPORT_DOWNLOADED', reportId: report.id }); openReportPrintWindow({ ...order, resultReport: report }); }}><Download className="h-4 w-4" /> PDF</Button></div> }
          ]}
          rows={orders}
          emptyMessage="No results are available yet."
        />
      </Card>
      <DetailedResultModal order={selectedOrder} data={data} dispatch={dispatch} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}
