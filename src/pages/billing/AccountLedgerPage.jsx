import { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Scale } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { buildLedgerRows, dateInRange, uniqueCashiers } from '../../utils/financeUtils';

function withinPeriod(row, period) {
  if (period === 'all') return true;
  const date = new Date(row.createdAt);
  const now = new Date();
  const ms = now - date;
  if (period === 'today') return date.toDateString() === now.toDateString();
  if (period === 'week') return ms <= 7 * 24 * 60 * 60 * 1000;
  if (period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  return true;
}

export function AccountLedgerPage() {
  const { state } = useAppStore();
  const [period, setPeriod] = useState('all');
  const [query, setQuery] = useState('');
  const [cashier, setCashier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const cashiers = uniqueCashiers(state.data);
  const rows = useMemo(() => buildLedgerRows(state.data)
    .filter((row) => withinPeriod(row, period))
    .filter((row) => dateInRange(row.createdAt, startDate, endDate))
    .filter((row) => !cashier || row.staff === cashier)
    .filter((row) => {
      const q = query.trim().toLowerCase();
      return !q || [row.id, row.description, row.reference, row.method, row.staff, row.category, row.type].filter(Boolean).join(' ').toLowerCase().includes(q);
    }), [state.data, period, query, cashier, startDate, endDate]);
  const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit || 0), 0);
  const totalDebit = rows.reduce((sum, row) => sum + Number(row.debit || 0), 0);
  const balance = totalCredit - totalDebit;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance" title="Account Ledger" description="Complete cash-flow breakdown: billing credits, expense debits, float adjustments, running balance and cashier traceability." />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Credit" value={money(totalCredit)} icon={ArrowUpCircle} tone="green" />
        <MetricCard label="Total Debit" value={money(totalDebit)} icon={ArrowDownCircle} tone="red" />
        <MetricCard label="Current Balance" value={money(balance)} icon={Scale} tone="blue" />
      </div>
      <Card title="Ledger entries" subtitle="Money coming in from billing and money going out through expenses or float adjustments are centralised here.">
        <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ledger" aria-label="Search ledger" />
          <select className={inputClass} value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Filter by period"><option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option></select>
          <select className={inputClass} value={cashier} onChange={(event) => setCashier(event.target.value)} aria-label="Filter by cashier"><option value="">All staff</option>{cashiers.map((name) => <option key={name}>{name}</option>)}</select>
          <input className={inputClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Filter by start date" />
          <input className={inputClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Filter by end date" />
          <Button variant="secondary" onClick={() => { setPeriod('all'); setQuery(''); setCashier(''); setStartDate(''); setEndDate(''); }}>Clear filters</Button>
        </div>
        <DataTable columns={[{ key: 'createdAt', label: 'Date', render: (row) => formatDateTime(row.createdAt) }, { key: 'type', label: 'Type' }, { key: 'category', label: 'Category' }, { key: 'description', label: 'Description' }, { key: 'reference', label: 'Reference' }, { key: 'method', label: 'Method' }, { key: 'staff', label: 'Staff' }, { key: 'credit', label: 'Credit', render: (row) => row.credit ? <span className="font-bold text-emerald-700">{money(row.credit)}</span> : '—' }, { key: 'debit', label: 'Debit', render: (row) => row.debit ? <span className="font-bold text-red-700">{money(row.debit)}</span> : '—' }, { key: 'balance', label: 'Balance', render: (row) => money(row.balance) }]} rows={rows} emptyMessage="No ledger entries match your filters." />
      </Card>
    </div>
  );
}
