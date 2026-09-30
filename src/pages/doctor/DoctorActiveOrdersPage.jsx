import { useMemo, useState } from 'react';
import { Eye, RotateCcw, Search } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { WorkflowTimeline } from '../../components/ui/WorkflowTimeline';
import { FormField, inputClass } from '../../components/ui/FormField';
import { formatDateTime } from '../../utils/formatters';
import { getDoctorContextFromState, orderItemsText } from './doctorUtils';

const statusOptions = ['Submitted', 'Confirmed', 'In Progress', 'Pending Review'];

function ActiveOrderDetailModal({ order, onClose, onReverse, reversing }) {
  const [reversePrompt, setReversePrompt] = useState(false);
  const [reason, setReason] = useState('');
  if (!order) return null;
  // Withdrawing your own order (before reception or the department has acted on
  // it) is only offered while it is still exactly as you sent it.
  const canReverse = order.status === 'Submitted';

  return (
    <Modal
      open={Boolean(order)}
      title={`${order.id} · Active Order`}
      description="Focused order view for tracking processing status, expected completion, and department routing."
      onClose={onClose}
      footer={(
        <>
          {canReverse && !reversePrompt && (
            <Button variant="danger" onClick={() => setReversePrompt(true)}><RotateCcw className="h-4 w-4" /> Reverse this order</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      )}
    >
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="mt-1 font-bold text-slate-900">{order.patient?.fullName}</p><p className="text-sm text-slate-500">{order.patient?.id}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status</p><div className="mt-2"><StatusBadge status={order.status} /></div><p className="mt-2 text-sm text-slate-500">Billing: {order.billingStatus}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Expected</p><p className="mt-1 font-bold text-slate-900">{formatDateTime(order.expectedCompletionAt)}</p><p className="text-sm text-slate-500">Urgency: {order.urgency}</p></div>
        </div>
        <WorkflowTimeline status={order.status} timeline={order.timeline || []} />
        <Card title="Tests / Scans" compact>
          <div className="flex flex-wrap gap-2">
            {order.items.map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{item.id} · {item.name}</span>)}
          </div>
        </Card>
        <Card title="Clinical Notes" compact>
          <p className="text-sm leading-6 text-slate-600">{order.clinicalNotes || 'No clinical notes entered.'}</p>
        </Card>
        {reversePrompt && (
          <Card title="Reverse this order" compact>
            <p className="text-sm text-slate-600">This withdraws the order before it has been confirmed or started — nobody has acted on it yet.</p>
            <FormField label="Reason" required className="mt-3">
              <textarea className={inputClass} rows="2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Ordered the wrong test for this patient" autoFocus />
            </FormField>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="danger"
                disabled={reason.trim().length < 3 || reversing}
                onClick={() => { onReverse(order.id, reason.trim()); setReversePrompt(false); setReason(''); }}
              >
                {reversing ? 'Reversing…' : 'Confirm reversal'}
              </Button>
              <Button variant="subtle" onClick={() => { setReversePrompt(false); setReason(''); }}>Cancel</Button>
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
}

export function DoctorActiveOrdersPage() {
  const { state, dispatch } = useAppStore();
  const { activeOrders } = getDoctorContextFromState(state);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reversing, setReversing] = useState(false);

  const summary = useMemo(() => ({
    all: activeOrders.length,
    submitted: activeOrders.filter((order) => order.status === 'Submitted').length,
    inProgress: activeOrders.filter((order) => order.status === 'In Progress').length,
    review: activeOrders.filter((order) => order.status === 'Pending Review').length,
    urgent: activeOrders.filter((order) => order.urgency === 'Urgent').length
  }), [activeOrders]);

  const rows = useMemo(() => {
    const term = search.toLowerCase();
    return activeOrders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (urgencyFilter && order.urgency !== urgencyFilter) return false;
      if (!term) return true;
      return [order.id, order.patient?.fullName, order.patient?.id, order.status, order.urgency, orderItemsText(order)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [activeOrders, search, statusFilter, urgencyFilter]);

  function reverseOrder(orderId, reason) {
    if (reversing) return;
    setReversing(true);
    dispatch({ type: 'TRANSITION_ORDER', payload: { orderId, nextStatus: 'Cancelled', reason } });
    setSelectedOrder(null);
    window.setTimeout(() => setReversing(false), 1500);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Clinician Portal"
        title="Active Orders"
        description="Track submitted, confirmed, in-progress, and pending-review orders in a focused clinician workspace."
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['All Active', summary.all], ['Submitted', summary.submitted], ['In Progress', summary.inProgress], ['Pending Review', summary.review], ['Urgent', summary.urgent]
        ].map(([label, value]) => (
          <div key={label} className="flex min-h-[3rem] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-lg font-bold leading-none text-slate-900">{value}</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <Card
        title="My Active Orders"
        subtitle="Use filters to follow current work by status, urgency, patient, or test."
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input className={`${inputClass} h-10 !w-full py-2 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, patient, test..." aria-label="Search order, patient, test" /></div>
            <select className={`${inputClass} h-10 !w-full py-2 sm:!w-40`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>
            <select className={`${inputClass} h-10 !w-full py-2 sm:!w-40`} value={urgencyFilter} onChange={(event) => setUrgencyFilter(event.target.value)} aria-label="Filter by urgency"><option value="">All urgency</option><option>Routine</option><option>Urgent</option></select>
          </div>
        )}
      >
        <DataTable
          columns={[
            { key: 'id', label: 'Order ID', render: (order) => <span className="font-bold text-slate-900">{order.id}</span> },
            { key: 'patient', label: 'Patient', render: (order) => <div><p className="font-bold">{order.patient?.fullName}</p><p className="text-xs text-slate-500">{order.patient?.id}</p></div> },
            { key: 'items', label: 'Tests / Scans', render: orderItemsText },
            { key: 'urgency', label: 'Urgency', render: (order) => <StatusBadge status={order.urgency} /> },
            { key: 'status', label: 'Processing Status', render: (order) => <StatusBadge status={order.status} /> },
            { key: 'billing', label: 'Billing Status', render: (order) => <StatusBadge status={order.billingStatus} /> },
            { key: 'expectedCompletionAt', label: 'Expected Completion', render: (order) => formatDateTime(order.expectedCompletionAt) },
            { key: 'actions', label: 'Actions', render: (order) => <Button variant="secondary" onClick={() => setSelectedOrder(order)}><Eye className="h-4 w-4" /> View</Button> }
          ]}
          rows={rows}
          emptyMessage="No matching active orders."
        />
      </Card>
      <ActiveOrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onReverse={reverseOrder} reversing={reversing} />
    </div>
  );
}
