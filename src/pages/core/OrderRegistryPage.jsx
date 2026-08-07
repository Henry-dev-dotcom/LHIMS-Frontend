import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  FileCheck2,
  GitBranch,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  XCircle
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { getNextStatuses, STATUS_MEANING } from '../../workflow/statuses';
import { getOrderViewModel } from '../../workflow/workflowEngine';
import { canViewPrices } from '../../utils/priceVisibility';

const REGISTRY_SECTIONS = [
  {
    id: 'overview',
    label: 'Registry Overview',
    helper: 'Quick board view of every order stage.',
    statuses: [],
    icon: Layers3
  },
  {
    id: 'new',
    label: 'New / Submitted',
    helper: 'Orders waiting for confirmation or early review.',
    statuses: ['Submitted', 'Confirmed'],
    icon: ClipboardList
  },
  {
    id: 'active',
    label: 'Active Processing',
    helper: 'Orders currently being worked on by departments.',
    statuses: ['In Progress'],
    icon: RefreshCw
  },
  {
    id: 'review',
    label: 'Pending Review',
    helper: 'Results entered but waiting for sign-off.',
    statuses: ['Pending Review'],
    icon: FileCheck2
  },
  {
    id: 'released',
    label: 'Released Results',
    helper: 'Final orders with results available.',
    statuses: ['Final / Released'],
    icon: CheckCircle2
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    helper: 'Orders cancelled with reason tracking.',
    statuses: ['Cancelled'],
    icon: XCircle
  }
];

const BOARD_COLUMNS = [
  { id: 'Submitted', title: 'Submitted', description: 'Waiting for reception review' },
  { id: 'Confirmed', title: 'Confirmed', description: 'Verified and routed' },
  { id: 'In Progress', title: 'In Progress', description: 'Being processed' },
  { id: 'Pending Review', title: 'Pending Review', description: 'Awaiting sign-off' },
  { id: 'Final / Released', title: 'Released', description: 'Ready for doctor/reception' }
];

function OrderItems({ items, compact = false }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {compact ? item.id : item.name}
        </span>
      ))}
    </div>
  );
}

function TransitionButtons({ order }) {
  const { dispatch, state } = useAppStore();
  const role = state.auth?.role || 'admin';
  const canMoveLifecycle = ['admin', 'receptionist', 'lab', 'scan'].includes(role);
  const nextStatuses = getNextStatuses(order.status);

  if (!canMoveLifecycle) {
    return <span className="text-xs font-semibold text-slate-500">View-only for this role</span>;
  }
  if (nextStatuses.length === 0) return <span className="text-xs font-semibold text-slate-500">No next transition</span>;

  function transition(nextStatus) {
    let reason = '';
    if (nextStatus === 'Cancelled') {
      reason = window.prompt('Enter required cancellation reason:') || '';
      if (!reason.trim()) return;
    }
    dispatch({ type: 'TRANSITION_ORDER', payload: { orderId: order.id, nextStatus, reason } });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((nextStatus) => (
        <Button key={nextStatus} variant={nextStatus === 'Cancelled' ? 'danger' : 'secondary'} size="sm" onClick={() => transition(nextStatus)}>
          {nextStatus === 'Cancelled' ? 'Cancel' : `Move to ${nextStatus}`} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  );
}

function BillingActions({ order }) {
  const { dispatch } = useAppStore();
  if (order.billingStatus === 'Paid') return <StatusBadge status="Paid" />;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'UPDATE_BILLING_STATUS', payload: { orderId: order.id, billingStatus: 'Paid', method: 'Transfer' } })}>
        Mark Paid
      </Button>
      <Button variant="subtle" size="sm" onClick={() => dispatch({ type: 'UPDATE_BILLING_STATUS', payload: { orderId: order.id, billingStatus: 'Insurance Pending', method: 'Insurance' } })}>
        Insurance Pending
      </Button>
    </div>
  );
}

function Timeline({ timeline = [] }) {
  if (!timeline.length) {
    return <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No timeline events yet.</p>;
  }
  return (
    <div className="space-y-3">
      {timeline.map((event, index) => (
        <div key={`${event.status}-${event.timestamp}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-clinical-500" />
          <div>
            <p className="text-sm font-bold text-slate-800">{event.status}</p>
            <p className="text-xs text-slate-500">{event.actor} • {event.role} • {formatDateTime(event.timestamp)}</p>
            {event.reason && <p className="mt-1 text-xs font-semibold text-red-600">Reason: {event.reason}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderCard({ order, selected, onSelect, canSeeFinance }) {
  const isReleased = order.status === 'Final / Released';
  const isCancelled = order.status === 'Cancelled';
  return (
    <button
      type="button"
      onClick={() => onSelect(order.id)}
      className={`w-full rounded-[1.45rem] border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-clinical-200 hover:shadow-lift ${selected ? 'border-clinical-400 ring-4 ring-clinical-100' : 'border-slate-200'} ${isCancelled ? 'opacity-80' : ''}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">{order.id}</span>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.urgency} />
            {isReleased && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Result ready</span>}
          </div>
          <p className="mt-3 text-base font-bold text-slate-900">{order.patient?.fullName || 'Unknown patient'}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {order.doctor?.name || '—'} • {order.hospital?.name || '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <StatusBadge status={order.billingStatus} />
          {canSeeFinance && order.invoice && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{money(order.invoice.amount)}</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.25fr_0.75fr]">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Requested items</p>
          <OrderItems items={order.items} />
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Expected completion</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{formatDateTime(order.expectedCompletionAt)}</p>
        </div>
      </div>

      {order.clinicalNotes && (
        <p className="mt-3 line-clamp-2 rounded-2xl bg-clinical-50 px-3 py-2 text-xs font-semibold leading-5 text-clinical-900">
          {order.clinicalNotes}
        </p>
      )}
    </button>
  );
}

function BoardColumn({ column, orders, onSelect, selectedOrderId }) {
  const columnOrders = orders.filter((order) => order.status === column.id).slice(0, 4);
  return (
    <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50/80 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{column.title}</p>
          <p className="text-xs font-semibold text-slate-500">{column.description}</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">{orders.filter((order) => order.status === column.id).length}</span>
      </div>
      <div className="space-y-2">
        {columnOrders.length === 0 ? (
          <p className="rounded-2xl bg-white p-3 text-xs font-semibold text-slate-500">No orders in this section.</p>
        ) : columnOrders.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => onSelect(order.id)}
            className={`w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:border-clinical-200 ${selectedOrderId === order.id ? 'border-clinical-400 ring-2 ring-clinical-100' : 'border-slate-100'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">{order.id}</span>
              <StatusBadge status={order.urgency} />
            </div>
            <p className="mt-2 truncate text-sm font-bold text-slate-800">{order.patient?.fullName || 'Unknown patient'}</p>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">{order.items.map((item) => item.name).join(', ')}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionTabs({ activeSection, counts, onChange }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {REGISTRY_SECTIONS.map((section) => {
        const Icon = section.icon;
        const active = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            className={`rounded-[1.25rem] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift ${active ? 'border-clinical-400 bg-clinical-50 ring-4 ring-clinical-100' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-2xl ${active ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-5 w-5" /></span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{counts[section.id] || 0}</span>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900">{section.label}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{section.helper}</p>
          </button>
        );
      })}
    </div>
  );
}

function OrderDetailsPanel({ order, canSeeFinance }) {
  if (!order) {
    return (
      <Card title="Order detail" subtitle="Select an order from any section to view focused details, timeline, billing and delivery information.">
        <div className="grid place-items-center rounded-[1.5rem] bg-slate-50 p-10 text-center text-slate-500">
          <UserRound className="mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-bold">No order selected yet.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={`Order detail — ${order.id}`}
      subtitle={`${order.patient?.fullName || 'Unknown patient'} • ${order.doctor?.name || 'Doctor not recorded'}`}
      actions={<StatusBadge status={order.status} />}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{order.patient?.fullName || '—'}</p>
          <p className="text-xs font-semibold text-slate-500">{order.patient?.phone || 'No phone'} • {order.patient?.gender || '—'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Billing</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={order.billingStatus} />
            {canSeeFinance && order.invoice && <span className="text-sm font-bold text-slate-900">{money(order.invoice.amount)}</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Requested tests / scans</p>
        <OrderItems items={order.items} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-bold text-slate-900">Lifecycle action</p>
          <TransitionButtons order={order} />
        </div>
        {canSeeFinance && (
          <div>
            <p className="mb-2 text-sm font-bold text-slate-900">Billing action</p>
            <BillingActions order={order} />
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-3 text-sm font-bold text-slate-900">Timeline</p>
        <Timeline timeline={order.timeline || []} />
      </div>
    </Card>
  );
}

function orderSearchText(order) {
  return [
    order.id,
    order.patient?.fullName,
    order.patient?.phone,
    order.doctor?.name,
    order.hospital?.name,
    order.status,
    order.billingStatus,
    order.urgency,
    ...(order.items || []).flatMap((item) => [item.id, item.name, item.department, item.type, item.modality])
  ].filter(Boolean).join(' ').toLowerCase();
}

export function OrderRegistryPage() {
  const { state, dispatch } = useAppStore();
  const { data } = state;
  const role = state.auth?.role || 'admin';
  const canSeeFinance = canViewPrices(role);
  const [activeSection, setActiveSection] = useState('overview');
  const [query, setQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const allOrders = useMemo(() => {
    let mapped = data.orders.map((order) => getOrderViewModel(order, data));
    if (role === 'doctor' && state.auth?.linkedDoctorId) {
      mapped = mapped.filter((order) => order.doctorId === state.auth.linkedDoctorId);
    }
    if (role === 'lab') {
      mapped = mapped.filter((order) => order.routedDepartments?.includes('Laboratory'));
    }
    if (role === 'scan') {
      mapped = mapped.filter((order) => order.routedDepartments?.includes('Imaging'));
    }
    return mapped;
  }, [data, role, state.auth?.linkedDoctorId]);

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const byQuery = needle ? allOrders.filter((order) => orderSearchText(order).includes(needle)) : allOrders;
    const section = REGISTRY_SECTIONS.find((item) => item.id === activeSection);
    if (!section || section.id === 'overview') return byQuery;
    return byQuery.filter((order) => section.statuses.includes(order.status));
  }, [activeSection, allOrders, query]);

  const selectedOrder = useMemo(() => {
    return allOrders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || allOrders[0];
  }, [allOrders, filteredOrders, selectedOrderId]);

  const counts = useMemo(() => {
    const countFor = (statuses) => statuses.length ? allOrders.filter((order) => statuses.includes(order.status)).length : allOrders.length;
    return Object.fromEntries(REGISTRY_SECTIONS.map((section) => [section.id, countFor(section.statuses)]));
  }, [allOrders]);

  const submitted = allOrders.filter((order) => order.status === 'Submitted').length;
  const inProgress = allOrders.filter((order) => order.status === 'In Progress').length;
  const review = allOrders.filter((order) => order.status === 'Pending Review').length;
  const released = allOrders.filter((order) => order.status === 'Final / Released').length;
  const outstanding = data.invoices
    .filter((invoice) => allOrders.some((order) => order.id === invoice.orderId) && invoice.status !== 'Paid')
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  function createQuickOrder() {
    // Orders are created through the clinician order form (or reception
    // walk-ins); the registry is a tracking surface, so route to that flow.
    dispatch({ type: 'NAVIGATE', pageId: 'doctor-new-order' });
  }

  const title = role === 'doctor' ? 'My Order Registry' : 'Order Registry';
  const description = role === 'doctor'
    ? 'Doctor-side registry split into new, active, review, released and cancelled sections.'
    : 'A sectioned workflow registry for order tracking, lifecycle movement, billing state, generated results and delivery events.';

  return (
    <div>
      <PageHeader
        eyebrow="Core Records"
        title={title}
        description={description}
        actions={<Button onClick={createQuickOrder}><Plus className="h-4 w-4" /> Create order</Button>}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Submitted" value={submitted} icon={ClipboardList} tone="yellow" />
        <MetricCard label="In Progress" value={inProgress} icon={RefreshCw} tone="blue" />
        <MetricCard label="Pending Review" value={review} icon={FileCheck2} tone="purple" />
        <MetricCard label="Released" value={released} icon={FileCheck2} tone="green" />
        {canSeeFinance ? <MetricCard label="Outstanding" value={money(outstanding)} icon={CreditCard} tone="red" /> : <MetricCard label="Payment Follow-up" value={data.invoices.filter((invoice) => invoice.status !== 'Paid').length} icon={CreditCard} tone="red" />}
      </div>

      <div className="mt-6">
        <Card title="Order Registry Sections" subtitle="Select a section, search, then open one order for details.">
          <SectionTabs activeSection={activeSection} counts={counts} onChange={setActiveSection} />

          <div className="mt-5 flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-3 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by order ID, patient, doctor, hospital, test name, catalog ID, status..."
                aria-label="Search orders by ID, patient, doctor, hospital, test name, catalog ID, or status"
                className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-500"
              />
            </div>
            <div className="text-xs font-bold text-slate-500">
              Showing {filteredOrders.length} of {allOrders.length} order(s)
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          {activeSection === 'overview' ? (
            <Card title="Workflow board" subtitle="A quick, less congested board showing orders by stage.">
              <div className="grid gap-4 xl:grid-cols-5">
                {BOARD_COLUMNS.map((column) => (
                  <BoardColumn key={column.id} column={column} orders={filteredOrders} onSelect={setSelectedOrderId} selectedOrderId={selectedOrder?.id} />
                ))}
              </div>
            </Card>
          ) : (
            <Card
              title={REGISTRY_SECTIONS.find((section) => section.id === activeSection)?.label}
              subtitle={REGISTRY_SECTIONS.find((section) => section.id === activeSection)?.helper}
            >
              <div className="grid gap-4">
                {filteredOrders.length === 0 ? (
                  <div className="rounded-[1.5rem] bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">No orders found in this section.</div>
                ) : filteredOrders.map((order) => (
                  <OrderCard key={order.id} order={order} selected={selectedOrder?.id === order.id} onSelect={setSelectedOrderId} canSeeFinance={canSeeFinance} />
                ))}
              </div>
            </Card>
          )}

          <Card title="Generated results" subtitle="Result records are kept in their own compact section instead of crowding the order list.">
            <DataTable
              dense
              columns={[
                { key: 'id', label: 'Result ID' },
                { key: 'orderId', label: 'Order' },
                { key: 'department', label: 'Department' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'approvedBy', label: 'Approved By', render: (row) => row.approvedBy || '—' }
              ]}
              rows={(data.results || []).filter((result) => allOrders.some((order) => order.id === result.orderId))}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <OrderDetailsPanel order={selectedOrder} canSeeFinance={canSeeFinance} />

          <Card title="Status guide" subtitle="Lifecycle meanings are separated from the order list for readability.">
            <div className="grid gap-3">
              {Object.entries(STATUS_MEANING).map(([status, meaning]) => (
                <div key={status} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2"><StatusBadge status={status} /></div>
                  <p className="text-xs leading-5 text-slate-600">{meaning}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Delivery notifications" subtitle="Result delivery messages are separated from the main registry to reduce congestion.">
            <DataTable
              dense
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'channel', label: 'Channel' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> }
              ]}
              rows={(data.notifications || []).filter((note) => allOrders.some((order) => order.id === note.entityId)).slice(0, 8)}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
