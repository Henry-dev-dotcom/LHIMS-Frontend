import { useMemo, useState } from 'react';
import { Banknote, CreditCard, Landmark, PlusCircle, Smartphone } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { buildFloatRows, dateInRange, uniqueCashiers } from '../../utils/financeUtils';

const METHOD_ICONS = { Cash: Banknote, 'Mobile Money': Smartphone, Card: CreditCard, Transfer: Landmark, Insurance: Landmark };

export function FloatTrackerPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState('');
  const [cashier, setCashier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adjustment, setAdjustment] = useState({ type: 'In', method: 'Cash', amount: '', description: '' });
  const activeShift = (data.financeShifts || []).find((shift) => shift.status === 'Open' && shift.startedBy === state.auth?.userName);
  const cashiers = uniqueCashiers(data);
  const allRows = useMemo(() => buildFloatRows(data), [data]);
  const rows = allRows.filter((row) => {
    const q = query.trim().toLowerCase();
    return (!q || [row.id, row.description, row.reference, row.staff, row.shiftId, row.patientName, row.hospitalName].filter(Boolean).join(' ').toLowerCase().includes(q))
      && (!method || row.method === method)
      && (!cashier || row.staff === cashier)
      && dateInRange(row.createdAt, startDate, endDate);
  });
  const methodTotals = ['Cash','Mobile Money','Card','Transfer','Insurance'].map((name) => ({
    id: name,
    name,
    amount: rows.filter((row) => row.method === name).reduce((sum, row) => sum + (row.type === 'Out' ? -Number(row.amount || 0) : Number(row.amount || 0)), 0),
    count: rows.filter((row) => row.method === name).length,
    Icon: METHOD_ICONS[name] || Banknote
  }));

  function saveAdjustment(event) {
    event.preventDefault();
    dispatch({ type: 'CREATE_FLOAT_ADJUSTMENT', payload: adjustment });
    setAdjustment({ type: 'In', method: 'Cash', amount: '', description: '' });
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance" title="Cashier Float Tracker" description="Centralised float view showing every sale/payment, cashier, shift, method and manual adjustment." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {methodTotals.map(({ id, name, amount, count, Icon }) => <MetricCard key={id} label={`${name} · ${count}`} value={money(amount)} icon={Icon} tone={amount >= 0 ? 'green' : 'red'} />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card title="Active float" subtitle="Payments and adjustments can only be recorded after a shift starts.">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-700">Current shift</span><StatusBadge status={activeShift ? 'Open' : 'No Shift'} /></div>
            <div className="mt-2 text-slate-600">{activeShift ? `${activeShift.id} · ${activeShift.startedBy} · opened ${formatDateTime(activeShift.startedAt)}` : 'Start a shift before taking payments or making float adjustments.'}</div>
          </div>
          <form onSubmit={saveAdjustment} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Type"><select className={inputClass} value={adjustment.type} onChange={(event) => setAdjustment({ ...adjustment, type: event.target.value })}><option>In</option><option>Out</option></select></FormField>
              <FormField label="Method"><select className={inputClass} value={adjustment.method} onChange={(event) => setAdjustment({ ...adjustment, method: event.target.value })}><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Transfer</option><option>Insurance</option></select></FormField>
            </div>
            <FormField label="Amount"><input className={inputClass} type="number" step="0.01" value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} /></FormField>
            <FormField label="Description"><input className={inputClass} value={adjustment.description} onChange={(event) => setAdjustment({ ...adjustment, description: event.target.value })} placeholder="Petty cash, refund cash movement, drawer correction..." /></FormField>
            <Button type="submit" disabled={!activeShift}><PlusCircle className="h-4 w-4" /> Save Float Adjustment</Button>
          </form>
        </Card>
        <Card title="Float transaction log" subtitle="Filter by cashier, payment method and date range to audit at micro level.">
          <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search float log" aria-label="Search float log" />
            <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Filter by method"><option value="">All methods</option><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Transfer</option><option>Insurance</option></select>
            <select className={inputClass} value={cashier} onChange={(event) => setCashier(event.target.value)} aria-label="Filter by cashier"><option value="">All cashiers</option>{cashiers.map((name) => <option key={name}>{name}</option>)}</select>
            <input className={inputClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Filter by start date" />
            <input className={inputClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Filter by end date" />
          </div>
          <DataTable columns={[{ key: 'createdAt', label: 'Time', render: (row) => formatDateTime(row.createdAt) }, { key: 'type', label: 'Type', render: (row) => <StatusBadge status={row.type === 'Out' ? 'Debit' : 'Credit'} /> }, { key: 'description', label: 'Patient / Description' }, { key: 'method', label: 'Method' }, { key: 'amount', label: 'Amount', render: (row) => <span className={row.type === 'Out' ? 'font-bold text-red-700' : 'font-bold text-emerald-700'}>{row.type === 'Out' ? '-' : '+'}{money(row.amount)}</span> }, { key: 'staff', label: 'Cashier' }, { key: 'shiftId', label: 'Shift' }, { key: 'reference', label: 'Reference' }]} rows={rows} emptyMessage="No float transactions match your filters." />
        </Card>
      </div>
    </div>
  );
}
