import { ChevronDown, ClipboardList, CreditCard, FlaskConical, ScanLine, UsersRound } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { WorkflowTimeline } from '../../components/ui/WorkflowTimeline';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, getById, money } from '../../utils/formatters';
import { canViewPrices } from '../../utils/priceVisibility';

export function OverviewPage() {
  const { state } = useAppStore();
  const { patients, orders, catalog, invoices } = state.data;
  const canSeeFinance = canViewPrices(state.auth?.role);
  const labOrders = orders.filter((order) => order.itemIds.some((id) => getById(catalog, id)?.type === 'Lab')).length;
  const scanOrders = orders.filter((order) => order.itemIds.some((id) => getById(catalog, id)?.type === 'Scan')).length;
  const outstanding = invoices.filter((invoice) => invoice.status !== 'Paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  const latestOrder = orders[0];

  return (
    <div>
      <PageHeader
        eyebrow="Clinical Operations"
        title="Diagnosis Center command workspace"
        description="A polished healthcare operations interface for role-based ordering, reception routing, laboratory and imaging work, billing, reporting, delivery, security and audit monitoring."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Patients" value={patients.length} icon={UsersRound} tone="blue" />
        <MetricCard label="Orders" value={orders.length} icon={ClipboardList} tone="purple" />
        <MetricCard label="Lab routed" value={labOrders} icon={FlaskConical} tone="green" />
        <MetricCard label="Scan routed" value={scanOrders} icon={ScanLine} tone="yellow" />
        {canSeeFinance ? <MetricCard label="Outstanding" value={money(outstanding)} icon={CreditCard} tone="red" /> : <MetricCard label="Open invoices" value={invoices.filter((invoice) => invoice.status !== 'Paid').length} icon={CreditCard} tone="red" />}
      </div>

      <div className="mt-4">
        <Card title="Recent order registry" subtitle="Recent orders across routing, billing and results workflows.">
          <DataTable
            columns={[
              { key: 'id', label: 'Order ID' },
              { key: 'patient', label: 'Patient', render: (row) => getById(patients, row.patientId)?.fullName || '—' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'billingStatus', label: 'Billing', render: (row) => <StatusBadge status={row.billingStatus} /> },
              { key: 'createdAt', label: 'Submitted', render: (row) => formatDateTime(row.createdAt) }
            ]}
            rows={orders}
          />
        </Card>
      </div>

      <details className="group mt-4">
        <summary className="clinical-panel flex cursor-pointer list-none items-center justify-between gap-3 rounded-[1.2rem] px-4 py-3 text-sm font-semibold text-slate-600 transition hover:text-clinical-700 sm:rounded-[1.75rem]">
          More details — latest order workflow
          <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
        </summary>
        <div className="mt-3">
          {latestOrder ? (
            <WorkflowTimeline status={latestOrder.status} timeline={latestOrder.timeline} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[1.2rem] bg-slate-50 px-4 py-10 text-center sm:rounded-[1.75rem]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-500"><ClipboardList className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-slate-500">No orders yet.</span>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
