import { useMemo, useState } from 'react';
import { Bell, CheckCircle2, Download, FileCheck2, FileText, Mail, MessageSquare, Printer, RefreshCcw, Send, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { getOrderViewModel } from '../../workflow/workflowEngine';
import { openReportPrintWindow } from '../../utils/reporting';

const DELIVERY_CHANNELS = ['All Channels', 'In-platform', 'Email', 'SMS'];
const DELIVERY_STATUSES = ['All Statuses', 'Queued', 'Delivered', 'Failed', 'Read', 'Printed'];
const RESULT_TABS = [
  { id: 'reports', label: 'Released Reports' },
  { id: 'delivery-log', label: 'Delivery Log' },
  { id: 'patient-notices', label: 'Patient Notices' },
  { id: 'templates', label: 'Safe Templates' },
  { id: 'manifest', label: 'Delivery Manifest' }
];

function orderMatches(order, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    order.id,
    order.patient?.fullName,
    order.patient?.phone,
    order.doctor?.name,
    order.hospital?.name,
    order.status,
    order.items.map((item) => `${item.id || ''} ${item.name || ''}`).join(' ')
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function getReportForOrder(data, orderId) {
  return (data.resultReports || []).find((report) => report.orderId === orderId && report.status !== 'Voided');
}

function deliveryEventsForOrder(data, orderId) {
  return (data.notifications || []).filter((note) => note.entityId === orderId && note.deliveryType === 'Result Release');
}

function patientNotices(data) {
  return (data.notifications || []).filter((note) => note.deliveryType === 'Patient Result Notice');
}

function isSmsPrivacySafe(event) {
  if (event.channel !== 'SMS') return true;
  return Boolean(event.privacyChecked) && !/patient|diagnosis|haemoglobin|cbc|x-ray|ultrasound|ct|mri|glucose|bilirubin|positive|negative|critical|abnormal/i.test(event.body || '');
}

function getDeliveryReadiness(data, order) {
  const report = getReportForOrder(data, order.id);
  const events = deliveryEventsForOrder(data, order.id);
  const missingChannels = ['In-platform', 'Email', 'SMS'].filter((channel) => !events.some((event) => event.channel === channel));
  return {
    report,
    events,
    missingChannels,
    ready: Boolean(report) && missingChannels.length === 0,
    hasFailed: events.some((event) => event.status === 'Failed')
  };
}

function filterEvents(events, filters) {
  const q = filters.query.trim().toLowerCase();
  return events.filter((event) => {
    const channelOk = filters.channel === 'All Channels' || event.channel === filters.channel;
    const statusOk = filters.status === 'All Statuses' || event.status === filters.status;
    const queryOk = !q || [event.id, event.entityId, event.title, event.target, event.channel, event.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    return channelOk && statusOk && queryOk;
  });
}

function printManifest(releasedOrders, data) {
  const rows = releasedOrders.map((order) => {
    const readiness = getDeliveryReadiness(data, order);
    return `<tr><td>${order.id}</td><td>${order.patient?.fullName || '—'}</td><td>${order.doctor?.name || '—'}</td><td>${order.hospital?.name || '—'}</td><td>${readiness.report?.id || 'Missing'}</td><td>${readiness.events.length}</td><td>${readiness.missingChannels.join(', ') || 'Complete'}</td></tr>`;
  }).join('');
  const html = `<!doctype html><html><head><title>Result Delivery Manifest</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#0f172a}h1{color:#0369a1}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px}th{background:#f8fafc;text-transform:uppercase;font-size:11px;color:#64748b}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="float:right;padding:10px 16px;border:0;border-radius:10px;background:#0284c7;color:#fff;font-weight:800">Print Manifest</button><h1>Result Delivery Manifest</h1><p>Released reports, generated PDF records and delivery channel readiness.</p><table><thead><tr><th>Order</th><th>Patient</th><th>Doctor</th><th>Hospital</th><th>Report</th><th>Events</th><th>Missing Channels</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No released orders.</td></tr>'}</tbody></table></body></html>`;
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function Select({ children, ...props }) {
  return <select className={inputClass} {...props}>{children}</select>;
}

export function ResultsDeliveryPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [activeTab, setActiveTab] = useState('reports');
  const [query, setQuery] = useState('');
  const [deliveryFilters, setDeliveryFilters] = useState({ query: '', channel: 'All Channels', status: 'All Statuses' });

  const releasedOrders = useMemo(() => {
    return (data.orders || [])
      .filter((order) => order.status === 'Final / Released')
      .map((order) => getOrderViewModel(order, data))
      .filter((order) => orderMatches(order, query))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [data, query]);

  const deliveryEvents = useMemo(() => {
    return (data.notifications || [])
      .filter((note) => note.deliveryType === 'Result Release')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [data.notifications]);

  const filteredDeliveryEvents = useMemo(() => filterEvents(deliveryEvents, deliveryFilters), [deliveryEvents, deliveryFilters]);
  const notices = useMemo(() => patientNotices(data).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [data]);
  const reports = data.resultReports || [];
  const failed = deliveryEvents.filter((event) => event.status === 'Failed').length;
  const queued = deliveryEvents.filter((event) => event.status === 'Queued').length;
  const readyOrders = releasedOrders.filter((order) => getDeliveryReadiness(data, order).ready).length;
  const missingReports = releasedOrders.filter((order) => !getReportForOrder(data, order.id)).length;
  const smsEvents = deliveryEvents.filter((event) => event.channel === 'SMS');
  const privacySafeSms = smsEvents.every(isSmsPrivacySafe);

  const prepareDelivery = (order, force = false) => {
    dispatch({ type: 'PREPARE_RESULT_DELIVERY', orderId: order.id, force });
  };

  const prepareMissingDelivery = () => {
    releasedOrders.forEach((order) => {
      const readiness = getDeliveryReadiness(data, order);
      if (!readiness.ready || readiness.hasFailed) dispatch({ type: 'PREPARE_RESULT_DELIVERY', orderId: order.id, force: readiness.hasFailed });
    });
  };

  const printReport = (order) => {
    const report = getReportForOrder(data, order.id);
    if (report) dispatch({ type: 'MARK_REPORT_DOWNLOADED', reportId: report.id });
    openReportPrintWindow({ ...order, resultReport: report });
  };

  const sendPatientNotice = (order, channel) => {
    dispatch({ type: 'SEND_RESULT_TO_PATIENT', payload: { orderId: order.id, channel } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Results Delivery"
        title="Results delivery control center"
        description="Released results can be converted into PDF-ready reports, delivered to doctors, printed by reception and shared with patients using privacy-safe notices."
        actions={<Button onClick={prepareMissingDelivery}><Send className="h-4 w-4" /> Prepare Missing Delivery</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Released Orders" value={releasedOrders.length} icon={ShieldCheck} tone="green" />
        <MetricCard label="Ready Bundles" value={readyOrders} icon={CheckCircle2} tone="green" />
        <MetricCard label="PDF Reports" value={reports.length} icon={FileText} tone="blue" />
        <MetricCard label="Missing Reports" value={missingReports} icon={FileCheck2} tone="yellow" />
        <MetricCard label="Queued" value={queued} icon={RefreshCcw} tone="yellow" />
        <MetricCard label="Failed" value={failed} icon={Bell} tone="red" />
      </div>

      <Card title="Privacy and release safety" subtitle="Patient-facing SMS and WhatsApp notices must not include clinical values, diagnoses, abnormal flags or patient-identifying clinical detail.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-bold text-slate-900">SMS clinical-data safety check</p>
            <p className="mt-1 text-sm text-slate-500">Checks release SMS messages for unsafe clinical words or test values.</p>
            <div className="mt-3"><StatusBadge status={privacySafeSms ? 'Privacy Safe' : 'Review Required'} /></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Default patient notice</p>
            <p className="mt-1 text-sm text-slate-600">Your diagnosis center result is ready. Please contact the center or your referring doctor for secure review.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Doctor notice</p>
            <p className="mt-1 text-sm text-slate-600">A finalized report is ready. Please log in to the doctor portal to review and download it.</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-soft">
        {RESULT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${activeTab === tab.id ? 'bg-clinical-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'reports' && (
        <Card
          title="Released reports"
          subtitle="Every Final / Released order should have a PDF-ready report record and delivery events for doctor-facing channels."
          actions={<input className={`${inputClass} min-w-[260px]`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, patient, doctor, hospital..." aria-label="Search released reports" />}
        >
          <DataTable
            columns={[
              { key: 'id', label: 'Order ID', render: (order) => <span className="font-bold text-slate-900">{order.id}</span> },
              { key: 'patient', label: 'Patient', render: (order) => <div><p className="font-bold">{order.patient?.fullName}</p><p className="text-xs text-slate-500">{order.patient?.id} · {order.patient?.phone}</p></div> },
              { key: 'doctor', label: 'Doctor / Hospital', render: (order) => <div><p className="font-bold">{order.doctor?.name}</p><p className="text-xs text-slate-500">{order.hospital?.name}</p></div> },
              { key: 'items', label: 'Investigations', render: (order) => order.items.map((item) => item.name).join(', ') || '—' },
              { key: 'report', label: 'PDF Report', render: (order) => {
                const readiness = getDeliveryReadiness(data, order);
                return readiness.report ? <div><StatusBadge status={readiness.report.status} /><p className="mt-1 text-xs text-slate-500">{readiness.report.id}</p></div> : <StatusBadge status="Missing" />;
              }},
              { key: 'delivery', label: 'Readiness', render: (order) => {
                const readiness = getDeliveryReadiness(data, order);
                return <div className="space-y-1"><StatusBadge status={readiness.ready ? 'Ready' : 'Needs Preparation'} /><p className="text-xs text-slate-500">Missing: {readiness.missingChannels.join(', ') || 'None'}</p></div>;
              }},
              { key: 'actions', label: 'Actions', render: (order) => <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => prepareDelivery(order)}>Prepare</Button><Button variant="secondary" onClick={() => prepareDelivery(order, true)}>Re-send</Button><Button onClick={() => printReport(order)}><Download className="h-4 w-4" /> PDF / Print</Button><Button variant="secondary" onClick={() => sendPatientNotice(order, 'Email')}>Email Patient</Button><Button variant="secondary" onClick={() => sendPatientNotice(order, 'WhatsApp')}>WhatsApp</Button></div> }
            ]}
            rows={releasedOrders}
            emptyMessage="No released orders found."
          />
        </Card>
      )}

      {activeTab === 'delivery-log' && (
        <Card title="Delivery log" subtitle="Filter and retry doctor-facing in-platform, email and SMS result-release delivery events.">
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <FormField label="Search delivery">
              <input className={inputClass} value={deliveryFilters.query} onChange={(event) => setDeliveryFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Search event, order, title, target..." />
            </FormField>
            <FormField label="Channel">
              <Select value={deliveryFilters.channel} onChange={(event) => setDeliveryFilters((current) => ({ ...current, channel: event.target.value }))}>
                {DELIVERY_CHANNELS.map((channel) => <option key={channel}>{channel}</option>)}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select value={deliveryFilters.status} onChange={(event) => setDeliveryFilters((current) => ({ ...current, status: event.target.value }))}>
                {DELIVERY_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </Select>
            </FormField>
          </div>
          <DataTable
            columns={[
              { key: 'id', label: 'ID', render: (event) => <span className="font-bold text-slate-900">{event.id}</span> },
              { key: 'entityId', label: 'Order' },
              { key: 'title', label: 'Title' },
              { key: 'target', label: 'Target', render: (event) => event.target || 'Doctor dashboard' },
              { key: 'channel', label: 'Channel', render: (event) => event.channel === 'Email' ? <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" /> Email</span> : event.channel === 'SMS' ? <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" /> SMS</span> : <span className="inline-flex items-center gap-1"><Bell className="h-4 w-4" /> In-platform</span> },
              { key: 'status', label: 'Status', render: (event) => <StatusBadge status={event.status} /> },
              { key: 'privacy', label: 'SMS Safety', render: (event) => event.channel === 'SMS' ? <StatusBadge status={isSmsPrivacySafe(event) ? 'Privacy Safe' : 'Review Required'} /> : '—' },
              { key: 'retry', label: 'Retry', render: (event) => `${event.retryCount || 0}/${event.maxRetries ?? data.notificationSettings?.retryAttempts ?? 3}` },
              { key: 'createdAt', label: 'Created', render: (event) => formatDateTime(event.createdAt) },
              { key: 'actions', label: 'Actions', render: (event) => <div className="flex gap-2"><Button variant="secondary" onClick={() => dispatch({ type: 'RETRY_DELIVERY_NOTIFICATION', notificationId: event.id })}><RefreshCcw className="h-4 w-4" /> Retry</Button><Button variant="secondary" onClick={() => dispatch({ type: 'MARK_NOTIFICATION_DELIVERED', notificationId: event.id })}>Mark Delivered</Button></div> }
            ]}
            rows={filteredDeliveryEvents}
            emptyMessage="No matching delivery events."
          />
        </Card>
      )}

      {activeTab === 'patient-notices' && (
        <Card title="Patient-safe notices" subtitle="Reception-facing patient notices created from result actions. These messages avoid clinical details by default.">
          <DataTable
            columns={[
              { key: 'id', label: 'Notice ID' },
              { key: 'entityId', label: 'Order' },
              { key: 'channel', label: 'Channel', render: (notice) => <StatusBadge status={notice.channel} /> },
              { key: 'body', label: 'Safe Message', render: (notice) => <span className="text-slate-600">{notice.body}</span> },
              { key: 'status', label: 'Status', render: (notice) => <StatusBadge status={notice.status} /> },
              { key: 'createdAt', label: 'Created', render: (notice) => formatDateTime(notice.createdAt) },
              { key: 'actions', label: 'Actions', render: (notice) => <Button variant="secondary" onClick={() => dispatch({ type: 'MARK_NOTIFICATION_DELIVERED', notificationId: notice.id })}>Mark Delivered</Button> }
            ]}
            rows={notices}
            emptyMessage="No patient-facing result notices yet."
          />
        </Card>
      )}

      {activeTab === 'templates' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Doctor release template" subtitle="Used for doctor dashboard/email/SMS release prompts.">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              A finalized diagnosis center report is ready for review. Please log in to the secure doctor portal to view and download the report.
            </div>
          </Card>
          <Card title="Patient email / WhatsApp notice" subtitle="Patient-facing message avoids result values and clinical interpretation.">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Your diagnosis center result is ready. Please contact the center or your referring doctor for secure review.
            </div>
          </Card>
          <Card title="SMS privacy rule" subtitle="Safe SMS must never contain clinical details.">
            <ul className="space-y-2 text-sm font-semibold text-slate-600">
              <li>Do not include patient name.</li>
              <li>Do not include test name or diagnosis.</li>
              <li>Do not include abnormal/critical values.</li>
              <li>Only mention that a result is ready and the user should log in or contact the center.</li>
            </ul>
          </Card>
          <Card title="Report print package" subtitle="PDF-ready report contains clinical detail, so it should only be accessed from secure user roles.">
            <ul className="space-y-2 text-sm font-semibold text-slate-600">
              <li>Patient demographics and order ID.</li>
              <li>Doctor/hospital details.</li>
              <li>Result parameters, units, reference ranges and flags.</li>
              <li>Generated report token and download tracking.</li>
            </ul>
          </Card>
        </div>
      )}

      {activeTab === 'manifest' && (
        <Card
          title="Delivery manifest"
          subtitle="Printable release-readiness manifest for handover and results office tracking."
          actions={<Button onClick={() => printManifest(releasedOrders, data)}><Printer className="h-4 w-4" /> Print Manifest</Button>}
        >
          <DataTable
            columns={[
              { key: 'id', label: 'Order' },
              { key: 'patient', label: 'Patient', render: (order) => order.patient?.fullName || '—' },
              { key: 'doctor', label: 'Doctor', render: (order) => order.doctor?.name || '—' },
              { key: 'report', label: 'Report', render: (order) => getReportForOrder(data, order.id)?.id || <StatusBadge status="Missing" /> },
              { key: 'events', label: 'Delivery Events', render: (order) => deliveryEventsForOrder(data, order.id).length },
              { key: 'missing', label: 'Missing Channels', render: (order) => getDeliveryReadiness(data, order).missingChannels.join(', ') || 'None' },
              { key: 'ready', label: 'Ready', render: (order) => <StatusBadge status={getDeliveryReadiness(data, order).ready ? 'Ready' : 'Needs Preparation'} /> }
            ]}
            rows={releasedOrders}
            emptyMessage="No released orders available for manifest."
          />
        </Card>
      )}
    </div>
  );
}
