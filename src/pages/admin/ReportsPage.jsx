import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Download, FileBarChart2, RefreshCcw, TrendingUp, WalletCards } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { ResponsiveTabs } from '../../components/ui/ResponsiveTabs';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { ORDER_STATUSES } from '../../workflow/statuses';
import { buildReportingDataset, exportCsv, exportJson } from '../../utils/reportMetrics';
import { canViewPrices } from '../../utils/priceVisibility';

const REPORT_TABS = [
  { id: 'tat', label: 'Turnaround' },
  { id: 'volume', label: 'Volume' },
  { id: 'finance', label: 'Revenue' },
  { id: 'quality', label: 'Abnormal Results' },
  { id: 'delivery', label: 'Results Delivery' },
  { id: 'productivity', label: 'Productivity' }
];

const today = new Date().toISOString().slice(0, 10);
const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function Select({ children, ...props }) {
  return <select className={inputClass} {...props}>{children}</select>;
}

export function ReportsPage() {
  const { state } = useAppStore();
  const data = state.data;
  const canSeeFinance = canViewPrices(state.auth?.role);
  const [activeTab, setActiveTab] = useState('tat');
  const [filters, setFilters] = useState({
    startDate: ninetyDaysAgo,
    endDate: today,
    hospitalId: '',
    doctorId: '',
    department: '',
    status: ''
  });

  const report = useMemo(() => buildReportingDataset(data, filters), [data, filters]);
  const availableTabs = canSeeFinance ? REPORT_TABS : REPORT_TABS.filter((tab) => tab.id !== 'finance');
  const displayTab = canSeeFinance || activeTab !== 'finance' ? activeTab : 'tat';
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters({ startDate: ninetyDaysAgo, endDate: today, hospitalId: '', doctorId: '', department: '', status: '' });

  const exportAll = () => exportJson('diagnosis-center-section-12-reporting-export.json', report);
  const exportCurrentCsv = () => {
    const map = {
      tat: report.tatRows,
      volume: report.orderVolumeByHospital,
      finance: canSeeFinance ? report.invoices : [],
      quality: report.results,
      delivery: report.deliveryRows,
      productivity: report.staffProductivity
    };
    exportCsv(`diagnosis-center-${displayTab}-report.csv`, map[displayTab] || []);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Reporting System"
        title="Reporting & analytics center"
        description={canSeeFinance ? 'Turnaround time, order volume, revenue, outstanding balances, abnormal result rates, and productivity reporting across the platform.' : 'Turnaround time, order volume, abnormal result rates, and productivity reporting. Financial values are hidden from this role.'}
        actions={(
          <>
            <Button variant="secondary" onClick={exportCurrentCsv}><Download className="h-4 w-4" /> Export Current CSV</Button>
            <Button onClick={exportAll}><Download className="h-4 w-4" /> Export Full JSON</Button>
          </>
        )}
      />

      <Card className="mb-6" title="Report filters" subtitle="Filter reports by date range, hospital, doctor, department, and order status.">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <FormField label="Start date">
            <input type="date" className={inputClass} value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} />
          </FormField>
          <FormField label="End date">
            <input type="date" className={inputClass} value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} />
          </FormField>
          <FormField label="Hospital">
            <Select value={filters.hospitalId} onChange={(event) => updateFilter('hospitalId', event.target.value)}>
              <option value="">All hospitals</option>
              {(data.hospitals || []).map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Doctor">
            <Select value={filters.doctorId} onChange={(event) => updateFilter('doctorId', event.target.value)}>
              <option value="">All doctors</option>
              {(data.doctors || []).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Department">
            <Select value={filters.department} onChange={(event) => updateFilter('department', event.target.value)}>
              <option value="">All departments</option>
              <option value="Laboratory">Laboratory</option>
              <option value="Imaging">Imaging</option>
            </Select>
          </FormField>
          <FormField label="Order status">
            <Select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
          </FormField>
        </div>
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button variant="secondary" onClick={resetFilters}><RefreshCcw className="h-4 w-4" /> Reset Filters</Button>
          <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:rounded-full">
            {report.metrics.orders} matching orders · generated {formatDateTime(report.generatedAt)}
          </span>
        </div>
      </Card>

      <div className={`mb-6 grid gap-4 md:grid-cols-2 ${canSeeFinance ? 'xl:grid-cols-5' : 'xl:grid-cols-3'}`}>
        <MetricCard label="Orders" value={report.metrics.orders} icon={FileBarChart2} tone="blue" />
        <MetricCard label="Avg TAT" value={`${report.metrics.avgTat}h`} icon={TrendingUp} tone="green" />
        {canSeeFinance && <MetricCard label="Collected" value={money(report.metrics.paid)} icon={WalletCards} tone="purple" />}
        {canSeeFinance && <MetricCard label="Outstanding" value={money(report.metrics.outstanding)} icon={WalletCards} tone="yellow" />}
        <MetricCard label="Abnormal Rate" value={`${report.metrics.abnormalRate}%`} icon={AlertTriangle} tone="red" />
        <MetricCard label="Delivery Success" value={`${report.metrics.deliverySuccessRate || 0}%`} icon={Download} tone="green" />
      </div>

      <ResponsiveTabs tabs={availableTabs} activeTab={displayTab} onChange={setActiveTab} className="mb-6" ariaLabel="Report sections" />

      {displayTab === 'tat' && (
        <Card title="Turnaround time per finalized order" subtitle="Submission to release, separated by routed department and test/scan type.">
          <DataTable
            columns={[
              { key: 'orderId', label: 'Order' },
              { key: 'patient', label: 'Patient' },
              { key: 'hospital', label: 'Hospital' },
              { key: 'doctor', label: 'Doctor' },
              { key: 'department', label: 'Department', render: (row) => <StatusBadge status={row.department} /> },
              { key: 'tests', label: 'Tests / Scans' },
              { key: 'submittedAt', label: 'Submitted', render: (row) => formatDateTime(row.submittedAt) },
              { key: 'releasedAt', label: 'Released', render: (row) => formatDateTime(row.releasedAt) },
              { key: 'tatHours', label: 'TAT', render: (row) => `${row.tatHours}h` }
            ]}
            rows={report.tatRows}
            emptyMessage="No finalized orders match this report filter yet."
          />
        </Card>
      )}

      {displayTab === 'volume' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Order volume by hospital" subtitle="Registered partner hospital contribution.">
            <DataTable columns={[{ key: 'label', label: 'Hospital' }, { key: 'count', label: 'Orders' }]} rows={report.orderVolumeByHospital} />
          </Card>
          <Card title="Order volume by doctor" subtitle="Doctor referral counts.">
            <DataTable columns={[{ key: 'label', label: 'Doctor' }, { key: 'count', label: 'Orders' }]} rows={report.orderVolumeByDoctor} />
          </Card>
          <Card title="Order volume by department" subtitle="Lab vs Imaging routing demand.">
            <DataTable columns={[{ key: 'label', label: 'Department' }, { key: 'count', label: 'Orders' }]} rows={report.orderVolumeByDepartment} />
          </Card>
          <Card title="Order volume by day" subtitle="Daily intake trend.">
            <DataTable columns={[{ key: 'label', label: 'Date' }, { key: 'count', label: 'Orders' }]} rows={report.orderVolumeByDay} />
          </Card>
          <Card className="xl:col-span-2" title="Order volume by status" subtitle="Operational queue distribution by lifecycle state.">
            <DataTable columns={[{ key: 'label', label: 'Status', render: (row) => <StatusBadge status={row.label} /> }, { key: 'count', label: 'Orders' }]} rows={report.orderVolumeByStatus} />
          </Card>
        </div>
      )}

      {canSeeFinance && displayTab === 'finance' && (
        <div className="grid gap-6">
          <Card title="Daily / monthly revenue summary" subtitle="Collected, outstanding, insurance-pending, and refunded totals by month.">
            <DataTable
              columns={[
                { key: 'label', label: 'Month' },
                { key: 'invoices', label: 'Invoices' },
                { key: 'collected', label: 'Collected', render: (row) => money(row.collected) },
                { key: 'outstanding', label: 'Outstanding', render: (row) => money(row.outstanding) },
                { key: 'insurancePending', label: 'Insurance Pending', render: (row) => money(row.insurancePending) },
                { key: 'refunded', label: 'Refunded', render: (row) => money(row.refunded) }
              ]}
              rows={report.revenueByMonth}
            />
          </Card>
          <Card title="Revenue and outstanding balances" subtitle="Invoice-level report by hospital, doctor, patient, and payment status.">
            <DataTable
              columns={[
                { key: 'id', label: 'Invoice' },
                { key: 'orderId', label: 'Order' },
                { key: 'hospital', label: 'Hospital' },
                { key: 'doctor', label: 'Doctor' },
                { key: 'patient', label: 'Patient' },
                { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'method', label: 'Method', render: (row) => row.method || '—' }
              ]}
              rows={report.invoices}
            />
          </Card>
        </div>
      )}

      {displayTab === 'quality' && (
        <div className="grid gap-6">
          <Card title="Abnormal result rate by department" subtitle="Quality oversight for abnormal, high, low and critical flags.">
            <DataTable
              columns={[
                { key: 'label', label: 'Department' },
                { key: 'total', label: 'Results' },
                { key: 'abnormal', label: 'Abnormal' },
                { key: 'rate', label: 'Rate', render: (row) => `${row.rate}%` }
              ]}
              rows={report.abnormalByDepartment}
            />
          </Card>
          <Card title="Abnormal result register" subtitle="Results with abnormal flags highlighted for clinical quality review.">
            <DataTable
              columns={[
                { key: 'id', label: 'Result' },
                { key: 'orderId', label: 'Order' },
                { key: 'patient', label: 'Patient' },
                { key: 'hospital', label: 'Hospital' },
                { key: 'department', label: 'Department', render: (row) => <StatusBadge status={row.department} /> },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'hasAbnormal', label: 'Flag', render: (row) => row.hasAbnormal ? <StatusBadge status="Abnormal" /> : <StatusBadge status="Normal" /> },
                { key: 'abnormalParameters', label: 'Abnormal Parameters', render: (row) => row.abnormalParameters || '—' }
              ]}
              rows={report.results}
            />
          </Card>
        </div>
      )}


      {displayTab === 'delivery' && (
        <div className="grid gap-6">
          <Card title="Result delivery summary by channel" subtitle="Shows delivery volume, queued items, failed messages and success rate for released-result communication channels.">
            <DataTable
              columns={[
                { key: 'label', label: 'Channel', render: (row) => <StatusBadge status={row.label} /> },
                { key: 'total', label: 'Total' },
                { key: 'delivered', label: 'Delivered / Read / Printed' },
                { key: 'queued', label: 'Queued' },
                { key: 'failed', label: 'Failed' },
                { key: 'successRate', label: 'Success Rate', render: (row) => `${row.successRate}%` }
              ]}
              rows={report.deliverySummary}
              emptyMessage="No result delivery events match this report filter yet."
            />
          </Card>
          <Card title="Result delivery event register" subtitle="Audit-friendly register of result release notifications, patient notices, retries and delivery status.">
            <DataTable
              columns={[
                { key: 'id', label: 'Event ID' },
                { key: 'orderId', label: 'Order' },
                { key: 'channel', label: 'Channel', render: (row) => <StatusBadge status={row.channel} /> },
                { key: 'audience', label: 'Audience' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'privacyChecked', label: 'SMS Privacy' },
                { key: 'retryCount', label: 'Retries' },
                { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
                { key: 'deliveredAt', label: 'Delivered', render: (row) => row.deliveredAt ? formatDateTime(row.deliveredAt) : '—' }
              ]}
              rows={report.deliveryRows}
              emptyMessage="No delivery events match this report filter yet."
            />
          </Card>
        </div>
      )}

      {displayTab === 'productivity' && (
        <Card title="Staff productivity" subtitle="Action counts from audit logs, including approvals and result-processing actions.">
          <DataTable
            columns={[
              { key: 'staff', label: 'Staff' },
              { key: 'role', label: 'Role', render: (row) => <StatusBadge status={row.role} /> },
              { key: 'actions', label: 'Audit Actions' },
              { key: 'approvals', label: 'Approvals / Sign-offs' },
              { key: 'resultActions', label: 'Result Actions' },
              { key: 'modules', label: 'Modules' }
            ]}
            rows={report.staffProductivity}
          />
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <BarChart3 className="mr-2 inline h-4 w-4" />
            Productivity metrics are based on audit activity and should be reviewed together with workload context.
          </div>
        </Card>
      )}
    </div>
  );
}
