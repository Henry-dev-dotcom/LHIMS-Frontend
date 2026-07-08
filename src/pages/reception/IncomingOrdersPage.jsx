import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, FileSearch, ListChecks, Search, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricCard } from '../../components/ui/MetricCard';
import { WorkflowTimeline } from '../../components/ui/WorkflowTimeline';
import { useAppStore } from '../../store/AppStore';
import { ReceptionPageTabs } from './ReceptionPageTabs';
import { formatDateTime, money } from '../../utils/formatters';
import { getOrderViewModel } from '../../workflow/workflowEngine';

function ItemTags({ items = [] }) {
  return <div className="flex max-w-[320px] flex-wrap gap-1.5">{items.map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{item.name}</span>)}</div>;
}

const statusCards = [
  { key: 'Submitted', label: 'New / Submitted', description: 'Waiting for reception confirmation.' },
  { key: 'Confirmed', label: 'Confirmed', description: 'Verified and routed to departments.' },
  { key: 'Cancelled', label: 'Cancelled', description: 'Stopped with a reason.' },
  { key: '', label: 'All Orders', description: 'All reception-visible orders.' }
];

const sectionStatus = {
  new: 'Submitted',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  all: ''
};

export function IncomingOrdersPage() {
  const { state, dispatch } = useAppStore();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Submitted');
  const [section, setSection] = useState('new');
  const [notes, setNotes] = useState('Patient details verified and routed to department queue(s).');
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const activeStatus = sectionStatus[section] ?? status;
  const allReceptionOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state.data.orders || [])
      .map((order) => getOrderViewModel(order, state.data))
      .filter((order) => !activeStatus || order.status === activeStatus)
      .filter((order) => !q || [order.id, order.patient?.fullName, order.patient?.phone, order.doctor?.name, order.hospital?.name, order.items?.map((item) => item.name).join(' '), order.urgency, order.status].filter(Boolean).join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.urgency === 'Urgent' ? -1 : 1) - (b.urgency === 'Urgent' ? -1 : 1) || new Date(b.createdAt) - new Date(a.createdAt));
  }, [state.data, query, activeStatus]);

  const selectedOrder = allReceptionOrders.find((order) => order.id === selectedOrderId) || allReceptionOrders[0];
  const submitted = state.data.orders.filter((order) => order.status === 'Submitted').length;
  const urgent = state.data.orders.filter((order) => order.status === 'Submitted' && order.urgency === 'Urgent').length;
  const confirmed = state.data.orders.filter((order) => order.status === 'Confirmed').length;
  const cancelled = state.data.orders.filter((order) => order.status === 'Cancelled').length;

  const pageSections = [
    { id: 'overview', label: 'Summary', helper: 'Counts and status', icon: ListChecks, tone: 'blue', count: state.data.orders.length },
    { id: 'new', label: 'New Orders', helper: 'Waiting confirmation', icon: Search, tone: 'amber', count: submitted },
    { id: 'confirmed', label: 'Confirmed', helper: 'Already routed', icon: CheckCircle2, tone: 'emerald', count: confirmed },
    { id: 'cancelled', label: 'Cancelled', helper: 'Stopped requests', icon: XCircle, tone: 'rose', count: cancelled },
    { id: 'all', label: 'All Orders', helper: 'Full register', icon: ClipboardList, tone: 'slate', count: state.data.orders.length },
    { id: 'confirm', label: 'Confirm Panel', helper: 'Notes and preview', icon: FileSearch, tone: 'purple', count: allReceptionOrders.length }
  ];

  function confirm(orderId) {
    dispatch({ type: 'CONFIRM_RECEPTION_ORDER', orderId, payload: { receptionNotes: notes } });
  }

  function cancel(orderId) {
    const reason = window.prompt('Enter cancellation reason visible to doctor and admin:') || '';
    if (!reason.trim()) return;
    dispatch({ type: 'TRANSITION_ORDER', payload: { orderId, nextStatus: 'Cancelled', reason } });
  }

  function goSection(id) {
    setSection(id);
    if (id in sectionStatus) setStatus(sectionStatus[id]);
  }

  const ordersTable = (
    <Card title={section === 'all' ? 'All reception-visible orders' : `${activeStatus || 'All'} orders`} subtitle="Click any order ID to open it in the confirmation panel.">
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
        <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, patient, phone, doctor, test" />
        <select className={inputClass} value={activeStatus} onChange={(event) => { setStatus(event.target.value); setSection('custom'); }}>
          <option value="">All statuses</option><option>Submitted</option><option>Confirmed</option><option>Cancelled</option><option>In Progress</option><option>Pending Review</option><option>Final / Released</option>
        </select>
      </div>
      <DataTable
        columns={[
          { key: 'id', label: 'Order', render: (row) => <button type="button" onClick={() => { setSelectedOrderId(row.id); setSection('confirm'); }} className="font-bold text-blue-700 hover:text-blue-900">{row.id}</button> },
          { key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName}</p><p className="text-xs text-slate-500">{row.patient?.phone}</p></div> },
          { key: 'doctor', label: 'Doctor / Hospital', render: (row) => <div><p className="font-bold text-slate-900">{row.doctor?.name}</p><p className="text-xs text-slate-500">{row.hospital?.name}</p></div> },
          { key: 'items', label: 'Tests / Scans', render: (row) => <ItemTags items={row.items} /> },
          { key: 'urgency', label: 'Urgency', render: (row) => <StatusBadge status={row.urgency} /> },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'expected', label: 'Expected', render: (row) => formatDateTime(row.expectedCompletionAt) },
          { key: 'actions', label: 'Actions', render: (row) => <div className="flex flex-wrap gap-2">{row.status === 'Submitted' && <Button className="px-3 py-1.5 text-xs" onClick={() => confirm(row.id)}>Confirm</Button>} {row.status !== 'Cancelled' && row.status !== 'Final / Released' && <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => cancel(row.id)}>Cancel</Button>}</div> }
        ]}
        rows={allReceptionOrders}
        emptyMessage="No incoming orders match this filter."
      />
    </Card>
  );

  const confirmPanel = (
    <div className="grid gap-5 xl:grid-cols-[0.74fr_1.26fr]">
      <Card title="Order confirmation panel" subtitle="Keep notes here, then confirm selected orders from the queue." compact>
        <div className="space-y-4">
          <FormField label="Search orders"><input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order, patient, phone, doctor, test" /></FormField>
          <FormField label="Reception verification notes"><textarea className={inputClass} rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} /></FormField>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-800">Confirmation verifies the linked invoice, updates the order timeline, and makes each Lab/Scan item visible to its routed department.</div>
        </div>
      </Card>

      <Card title="Focused order preview" subtitle="Select any order from the list to review routing and invoice context." compact>
        {selectedOrder ? <div className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Order</p><p className="text-xl font-bold text-slate-900">{selectedOrder.id}</p><p className="text-sm text-slate-500">Created {formatDateTime(selectedOrder.createdAt)}</p></div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div><span className="font-bold text-slate-700">Patient:</span> {selectedOrder.patient?.fullName} · {selectedOrder.patient?.phone}</div>
            <div><span className="font-bold text-slate-700">Doctor:</span> {selectedOrder.doctor?.name} · {selectedOrder.hospital?.name}</div>
            <div><span className="font-bold text-slate-700">Invoice:</span> {selectedOrder.invoice?.id || 'Not generated'} {selectedOrder.invoice ? `· ${money(selectedOrder.invoice.amount)}` : ''}</div>
            <div><span className="font-bold text-slate-700">Routed:</span> {(selectedOrder.routedDepartments || []).join(', ') || '—'}</div>
          </div>
          <WorkflowTimeline status={selectedOrder.status} />
          <ItemTags items={selectedOrder.items} />
          <div className="flex flex-wrap gap-2">{selectedOrder.status === 'Submitted' && <Button onClick={() => confirm(selectedOrder.id)}>Confirm Order</Button>} {selectedOrder.status !== 'Cancelled' && selectedOrder.status !== 'Final / Released' && <Button variant="danger" onClick={() => cancel(selectedOrder.id)}>Cancel with Reason</Button>}</div>
        </div> : <p className="text-sm text-slate-500">No order selected.</p>}
      </Card>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reception"
        title="Incoming Orders Queue"
        description="Review doctor-submitted requests, confirm patient details, and route work to Lab or Scan."
      />
      <ReceptionPageTabs label="Incoming orders sections" sections={pageSections} active={section} onChange={goSection} />

      {section === 'overview' && <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Submitted" value={submitted} icon={Search} tone="yellow" />
          <MetricCard label="Urgent waiting" value={urgent} icon={XCircle} tone="red" />
          <MetricCard label="Confirmed" value={confirmed} icon={CheckCircle2} tone="green" />
          <MetricCard label="Cancelled" value={cancelled} icon={ClipboardList} tone="purple" />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {statusCards.map((card) => {
            const count = card.key ? state.data.orders.filter((order) => order.status === card.key).length : state.data.orders.length;
            return (
              <button key={card.label} type="button" onClick={() => goSection(card.key === 'Submitted' ? 'new' : card.key === 'Confirmed' ? 'confirmed' : card.key === 'Cancelled' ? 'cancelled' : 'all')} className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50">
                <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-slate-900">{card.label}</p><span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">{count}</span></div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{card.description}</p>
              </button>
            );
          })}
        </div>
      </>}

      {['new', 'confirmed', 'cancelled', 'all', 'custom'].includes(section) && ordersTable}
      {section === 'confirm' && confirmPanel}
    </div>
  );
}
