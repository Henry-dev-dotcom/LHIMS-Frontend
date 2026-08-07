import { useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, FileWarning, TrendingUp, UsersRound } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { getById, money } from '../../utils/formatters';
import { dateInRange, invoiceBalance, invoiceContext, invoicePaid, invoiceTotal, paymentRows, uniqueCashiers } from '../../utils/financeUtils';

function daysOld(invoice) {
  return Math.max(0, Math.floor((Date.now() - new Date(invoice.createdAt).getTime()) / 86400000));
}
function bucketFor(invoice) {
  const age = daysOld(invoice);
  if (age <= 30) return '0–30 days';
  if (age <= 60) return '31–60 days';
  if (age <= 90) return '61–90 days';
  return '90+ days';
}
function withinPeriod(invoice, period) {
  if (period === 'all') return true;
  const date = new Date(invoice.createdAt);
  const now = new Date();
  if (period === 'week') return now - date <= 7 * 86400000;
  if (period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (period === 'quarter') return now - date <= 92 * 86400000;
  return true;
}

export function BillingAnalyticsPage() {
  const { state } = useAppStore();
  const data = state.data;
  const [range, setRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cashier, setCashier] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const cashiers = uniqueCashiers(data);
  const filteredInvoices = useMemo(() => (data.invoices || [])
    .map((invoice) => ({ ...invoice, ...invoiceContext(data, invoice) }))
    .filter((invoice) => withinPeriod(invoice, range))
    .filter((invoice) => dateInRange(invoice.createdAt, startDate, endDate))
    .filter((invoice) => !hospitalId || invoice.order?.hospitalId === hospitalId)
    .filter((invoice) => !cashier || (invoice.transactions || []).some((txn) => txn.staff === cashier)), [data, range, startDate, endDate, hospitalId, cashier]);
  const payments = paymentRows({ ...data, invoices: filteredInvoices });
  const collections = payments.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const outstanding = filteredInvoices.filter((invoice) => !['Paid','Refunded'].includes(invoice.status)).reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const paidInvoices = filteredInvoices.filter((invoice) => invoice.status === 'Paid').length;
  const writeOffs = (data.adjustments || []).reduce((sum, row) => sum + Number(row.amount || 0), 0) + (data.expenses || []).filter((expense) => expense.status === 'Written Off').reduce((sum, expense) => sum + Math.max(0, Number(expense.amount || 0) - Number(expense.amountPaid || 0)), 0);
  const visits = new Set(filteredInvoices.map((invoice) => invoice.order?.patientId).filter(Boolean)).size;
  const netRevenue = collections - writeOffs;
  const methodRows = Object.values(payments.reduce((acc, txn) => {
    const method = txn.method || 'Transfer';
    if (!acc[method]) acc[method] = { id: method, method, count: 0, amount: 0 };
    acc[method].count += 1;
    acc[method].amount += Number(txn.amount || 0);
    return acc;
  }, {}));
  const ageingRows = Object.values(filteredInvoices.filter((invoice) => !['Paid','Refunded'].includes(invoice.status)).reduce((acc, invoice) => {
    const bucket = bucketFor(invoice);
    if (!acc[bucket]) acc[bucket] = { id: bucket, bucket, count: 0, amount: 0, partial: 0 };
    acc[bucket].count += 1;
    acc[bucket].amount += invoiceBalance(invoice);
    if (invoice.status === 'Partial') acc[bucket].partial += 1;
    return acc;
  }, {}));
  const cashierRows = Object.values(payments.reduce((acc, txn) => {
    const staff = txn.staff || 'Unknown';
    if (!acc[staff]) acc[staff] = { id: staff, staff, count: 0, amount: 0, cash: 0, nonCash: 0 };
    acc[staff].count += 1;
    acc[staff].amount += Number(txn.amount || 0);
    if (txn.method === 'Cash') acc[staff].cash += Number(txn.amount || 0); else acc[staff].nonCash += Number(txn.amount || 0);
    return acc;
  }, {}));
  const hospitalRows = Object.values(filteredInvoices.reduce((acc, invoice) => {
    const hospital = getById(data.hospitals || [], invoice.order?.hospitalId)?.name || 'Unassigned';
    if (!acc[hospital]) acc[hospital] = { id: hospital, hospital, visits: 0, billed: 0, paid: 0, outstanding: 0 };
    acc[hospital].visits += 1;
    acc[hospital].billed += invoiceTotal(invoice);
    acc[hospital].paid += invoicePaid(invoice);
    acc[hospital].outstanding += ['Paid','Refunded'].includes(invoice.status) ? 0 : invoiceBalance(invoice);
    return acc;
  }, {}));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance" title="Billing Analytics" description="Period-end dashboard for visits, collections, outstanding balances, paid invoices, write-offs, cashier performance and ageing." />
      <Card title="Analytics filters" subtitle="Use period, custom dates, cashier and hospital filters for weekly/monthly/micro-level reviews.">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <select className={inputClass} value={range} onChange={(event) => setRange(event.target.value)} aria-label="Filter by date range"><option value="week">Last 7 days</option><option value="month">This month</option><option value="quarter">This quarter</option><option value="all">All time</option></select>
          <input className={inputClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Filter by start date" />
          <input className={inputClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Filter by end date" />
          <select className={inputClass} value={cashier} onChange={(event) => setCashier(event.target.value)} aria-label="Filter by cashier"><option value="">All cashiers</option>{cashiers.map((name) => <option key={name}>{name}</option>)}</select>
          <select className={inputClass} value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} aria-label="Filter by hospital"><option value="">All hospitals</option>{(data.hospitals || []).map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</select>
          <Button variant="secondary" onClick={() => { setRange('all'); setStartDate(''); setEndDate(''); setCashier(''); setHospitalId(''); }}>Clear</Button>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Patient Visits" value={visits} icon={UsersRound} tone="blue" />
        <MetricCard label="Collections" value={money(collections)} icon={CreditCard} tone="green" />
        <MetricCard label="Net Outstanding" value={money(outstanding)} icon={FileWarning} tone="yellow" />
        <MetricCard label="Paid Invoices" value={paidInvoices} icon={CheckCircle2} tone="green" />
        <MetricCard label="Write-offs" value={money(writeOffs)} icon={FileWarning} tone="red" />
        <MetricCard label="Net Revenue" value={money(netRevenue)} icon={TrendingUp} tone="purple" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Payment method split" subtitle="Graphical breakdown of collections by method.">
          <div className="space-y-3">{methodRows.length === 0 ? <p className="text-sm text-slate-500">No collections for this period.</p> : methodRows.map((row) => { const pct = collections ? Math.round((row.amount / collections) * 100) : 0; return <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between text-sm font-bold text-slate-700"><span>{row.method}</span><span>{money(row.amount)} · {pct}%</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div></div>; })}</div>
        </Card>
        <Card title="Accounts receivable ageing" subtitle="Outstanding balances grouped by age bucket, including partial invoices.">
          <DataTable columns={[{ key: 'bucket', label: 'Ageing Bucket' }, { key: 'count', label: 'Count' }, { key: 'partial', label: 'Partial' }, { key: 'amount', label: 'Amount', render: (row) => money(row.amount) }]} rows={ageingRows} emptyMessage="No outstanding balances." />
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Cashier collection summary" subtitle="Micro-level cashier report for collections by staff.">
          <DataTable columns={[{ key: 'staff', label: 'Cashier' }, { key: 'count', label: 'Payments' }, { key: 'cash', label: 'Cash', render: (row) => money(row.cash) }, { key: 'nonCash', label: 'Non-cash', render: (row) => money(row.nonCash) }, { key: 'amount', label: 'Total', render: (row) => money(row.amount) }]} rows={cashierRows} emptyMessage="No cashier collections for this filter." />
        </Card>
        <Card title="Hospital revenue summary" subtitle="Collections and balances by hospital or account.">
          <DataTable columns={[{ key: 'hospital', label: 'Hospital' }, { key: 'visits', label: 'Visits' }, { key: 'billed', label: 'Billed', render: (row) => money(row.billed) }, { key: 'paid', label: 'Collected', render: (row) => money(row.paid) }, { key: 'outstanding', label: 'Outstanding', render: (row) => money(row.outstanding) }]} rows={hospitalRows} />
        </Card>
      </div>
    </div>
  );
}
