import { useMemo, useState } from 'react';
import { Download, FileText, Search, Send, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { ReceptionPageTabs } from './ReceptionPageTabs';
import { formatDateTime } from '../../utils/formatters';
import { openReportPrintWindow } from '../../utils/reporting';
import { getOrderViewModel } from '../../workflow/workflowEngine';

function getReportForOrder(data, orderId) {
  return (data.resultReports || []).find((report) => report.orderId === orderId && report.status !== 'Voided');
}

function resultHasAbnormal(order) {
  return (order.results || []).some((result) => (result.parameters || []).some((parameter) => !['Normal', 'No Range', '', undefined].includes(parameter.flag)));
}

export function ReceptionResultsInboxPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [section, setSection] = useState('results');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');

  const releasedOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data.orders || [])
      .filter((order) => order.status === 'Final / Released')
      .map((order) => getOrderViewModel(order, data))
      .filter((order) => !filter || (filter === 'Abnormal' ? resultHasAbnormal(order) : order.routedDepartments?.includes(filter)))
      .filter((order) => !q || [order.id, order.patient?.fullName, order.patient?.phone, order.patient?.id, order.doctor?.name, order.hospital?.name, order.items?.map((item) => item.name).join(' ')].filter(Boolean).join(' ').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [data, query, filter]);

  const labResults = releasedOrders.filter((order) => order.routedDepartments?.includes('Laboratory')).length;
  const scanResults = releasedOrders.filter((order) => order.routedDepartments?.includes('Imaging')).length;
  const abnormal = releasedOrders.filter(resultHasAbnormal).length;
  const deliveryLogs = data.deliveryLogs || [];

  const pageSections = [
    { id: 'summary', label: 'Summary', helper: 'Result counts', icon: ShieldCheck, tone: 'blue', count: releasedOrders.length },
    { id: 'results', label: 'Released Results', helper: 'Print reports', icon: FileText, tone: 'emerald', count: releasedOrders.length },
    { id: 'notices', label: 'Notices', helper: 'Email/WhatsApp/SMS', icon: Send, tone: 'rose', count: deliveryLogs.length },
    { id: 'abnormal', label: 'Abnormal', helper: 'Needs attention', icon: Search, tone: 'amber', count: abnormal }
  ];

  function printReport(order) {
    const report = getReportForOrder(data, order.id);
    if (report) dispatch({ type: 'MARK_REPORT_DOWNLOADED', reportId: report.id });
    openReportPrintWindow({ ...order, resultReport: report });
  }


  const tableRows = section === 'abnormal' ? releasedOrders.filter(resultHasAbnormal) : releasedOrders;

  const resultsTable = (
    <Card
      title={section === 'abnormal' ? 'Abnormal released results' : 'Released results reference'}
      subtitle="Results are already delivered to the clinician. Reception can print a patient-safe copy when needed."
      compact
      actions={<div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px]"><input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, order, doctor, test..." /><select className={inputClass} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All results</option><option value="Laboratory">Laboratory</option><option value="Imaging">Imaging</option><option value="Abnormal">Abnormal only</option></select></div>}
    >
      <DataTable
        columns={[
          { key: 'id', label: 'Order', render: (order) => <span className="font-bold text-slate-900">{order.id}</span> },
          { key: 'patient', label: 'Patient', render: (order) => <div><p className="font-bold text-slate-900">{order.patient?.fullName}</p><p className="text-xs text-slate-500">{order.patient?.id} · {order.patient?.phone || 'No phone'}</p></div> },
          { key: 'doctor', label: 'Doctor / Hospital', render: (order) => <div><p className="font-bold">{order.doctor?.name}</p><p className="text-xs text-slate-500">{order.hospital?.name}</p></div> },
          { key: 'items', label: 'Investigations', render: (order) => <div className="flex max-w-[240px] flex-wrap gap-1">{(order.items || []).map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{item.name}</span>)}</div> },
          { key: 'report', label: 'Report', render: (order) => getReportForOrder(data, order.id)?.id || 'PDF-ready' },
          { key: 'updatedAt', label: 'Released', render: (order) => formatDateTime(order.updatedAt) },
          { key: 'actions', label: 'Actions', render: (order) => <div className="flex flex-wrap gap-1.5"><Button className="px-3 py-1.5 text-xs" onClick={() => printReport(order)}><Download className="h-3.5 w-3.5" /> Print Copy</Button><span className="rounded-full bg-clinical-50 px-3 py-1.5 text-xs font-bold text-clinical-700 ring-1 ring-clinical-100">Sent to clinician</span></div> }
        ]}
        rows={tableRows}
        emptyMessage="No released result reports match this filter."
      />
    </Card>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reception"
        title="Reception Results Inbox"
        description="View released results and print patient-safe copies. Final reports are delivered directly to the clinician automatically."
      />
      <ReceptionPageTabs label="Results inbox sections" sections={pageSections} active={section} onChange={setSection} />

      {section === 'summary' && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Released Results" value={releasedOrders.length} icon={ShieldCheck} tone="green" />
        <MetricCard label="Lab Reports" value={labResults} icon={FileText} tone="blue" />
        <MetricCard label="Scan Reports" value={scanResults} icon={FileText} tone="purple" />
        <MetricCard label="Abnormal Flags" value={abnormal} icon={Search} tone="yellow" />
      </div>}

      {['results', 'abnormal'].includes(section) && resultsTable}

      {section === 'notices' && <Card title="Delivery and notice activity" subtitle="Track privacy-safe delivery attempts and patient notification history." compact>
        <DataTable
          columns={[
            { key: 'id', label: 'Log' },
            { key: 'orderId', label: 'Order' },
            { key: 'channel', label: 'Channel', render: (row) => <StatusBadge status={row.channel || 'Notice'} /> },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status || 'Sent'} /> },
            { key: 'sentAt', label: 'Sent', render: (row) => formatDateTime(row.sentAt || row.createdAt) }
          ]}
          rows={deliveryLogs}
          emptyMessage="No delivery logs yet."
        />
      </Card>}
    </div>
  );
}
