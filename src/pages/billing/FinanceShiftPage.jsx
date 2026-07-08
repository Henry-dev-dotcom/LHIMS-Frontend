import { useMemo, useState } from 'react';
import { Banknote, Clock, Lock, PlayCircle, Scale } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { dateInRange, denominationTotal, paymentRows, uniqueCashiers } from '../../utils/financeUtils';

const blankDenoms = { n200: '', n100: '', n50: '', n20: '', n10: '', n5: '', c2: '', c1: '' };

function getShiftTransactions(data, shiftId) {
  return paymentRows(data).filter((txn) => txn.shiftId === shiftId);
}

export function FinanceShiftPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [openingFloat, setOpeningFloat] = useState('');
  const [shiftType, setShiftType] = useState('Morning');
  const [startNotes, setStartNotes] = useState('');
  const [denoms, setDenoms] = useState(blankDenoms);
  const [closeNotes, setCloseNotes] = useState('');
  const [cashier, setCashier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const activeShift = (data.financeShifts || []).find((shift) => shift.status === 'Open' && shift.startedBy === state.auth?.userName);
  const cashiers = uniqueCashiers(data);
  const activeTransactions = activeShift ? getShiftTransactions(data, activeShift.id) : [];
  const cash = activeTransactions.filter((txn) => txn.method === 'Cash').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const mobileMoney = activeTransactions.filter((txn) => txn.method === 'Mobile Money').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const card = activeTransactions.filter((txn) => txn.method === 'Card').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const transfer = activeTransactions.filter((txn) => txn.method === 'Transfer').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const insurance = activeTransactions.filter((txn) => txn.method === 'Insurance').reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const expectedCash = Number(activeShift?.openingFloat || 0) + cash;
  const countedCash = denominationTotal(denoms);
  const variance = countedCash - expectedCash;

  const shiftRows = useMemo(() => (data.financeShifts || [])
    .filter((shift) => !cashier || shift.startedBy === cashier || shift.closedBy === cashier)
    .filter((shift) => dateInRange(shift.startedAt, startDate, endDate))
    .map((shift) => ({ ...shift, txnCount: getShiftTransactions(data, shift.id).length })), [data, cashier, startDate, endDate]);

  const startShift = (event) => {
    event.preventDefault();
    dispatch({ type: 'START_FINANCE_SHIFT', payload: { openingFloat, shiftType, notes: startNotes } });
    setOpeningFloat('');
    setStartNotes('');
  };
  const closeShift = (event) => {
    event.preventDefault();
    if (!activeShift) return;
    dispatch({ type: 'CLOSE_FINANCE_SHIFT', shiftId: activeShift.id, payload: { actualCash: countedCash, denominations: denoms, notes: closeNotes } });
    setDenoms(blankDenoms);
    setCloseNotes('');
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance" title="Shift Start / Close" description="Start cashier shifts, block payments without a shift, count cash by denominations, close with variance, and preserve cashier-level history." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Active Shift" value={activeShift ? activeShift.id : 'None'} icon={Clock} tone={activeShift ? 'green' : 'yellow'} />
        <MetricCard label="Expected Cash" value={money(expectedCash)} icon={Banknote} tone="blue" />
        <MetricCard label="Counted Cash" value={money(countedCash)} icon={Banknote} tone="green" />
        <MetricCard label="Variance" value={money(variance)} icon={Scale} tone={Math.abs(variance) < 0.01 ? 'green' : 'red'} />
        <MetricCard label="Non-cash" value={money(mobileMoney + card + transfer + insurance)} icon={Clock} tone="purple" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Start shift" subtitle="Open a shift before recording payments so every transaction enters the cashier float.">
          <form onSubmit={startShift} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Shift type"><select className={inputClass} value={shiftType} onChange={(event) => setShiftType(event.target.value)} disabled={Boolean(activeShift)}><option>Morning</option><option>Afternoon</option><option>Night</option><option>Full Day</option></select></FormField>
              <FormField label="Opening float"><input className={inputClass} type="number" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} placeholder="0.00" disabled={Boolean(activeShift)} /></FormField>
            </div>
            <FormField label="Opening notes"><textarea className={`${inputClass} min-h-24`} value={startNotes} onChange={(event) => setStartNotes(event.target.value)} disabled={Boolean(activeShift)} /></FormField>
            <Button type="submit" disabled={Boolean(activeShift)}><PlayCircle className="h-4 w-4" /> Start Shift</Button>
          </form>
        </Card>
        <Card title="Close shift with cash count" subtitle="Enter counted notes/coins. The system compares counted cash with opening float + cash payments.">
          <form onSubmit={closeShift} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[['n200','GHS 200'],['n100','GHS 100'],['n50','GHS 50'],['n20','GHS 20'],['n10','GHS 10'],['n5','GHS 5'],['c2','GHS 2'],['c1','GHS 1']].map(([key, label]) => (
                <FormField key={key} label={label}><input className={inputClass} type="number" min="0" value={denoms[key]} onChange={(event) => setDenoms({ ...denoms, [key]: event.target.value })} disabled={!activeShift} /></FormField>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Expected cash</p><p className="font-bold text-slate-900">{money(expectedCash)}</p></div>
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Counted</p><p className="font-bold text-slate-900">{money(countedCash)}</p></div>
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Variance</p><p className="font-bold text-slate-900">{money(variance)}</p></div>
            </div>
            <FormField label="Closing notes"><textarea className={`${inputClass} min-h-20`} value={closeNotes} onChange={(event) => setCloseNotes(event.target.value)} disabled={!activeShift} /></FormField>
            <Button type="submit" variant="danger" disabled={!activeShift}><Lock className="h-4 w-4" /> Close Shift</Button>
          </form>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Payment breakdown for active shift" subtitle="Breakdown of current shift collections by payment method.">
          <DataTable columns={[{ key: 'method', label: 'Method' }, { key: 'count', label: 'Count' }, { key: 'amount', label: 'Amount', render: (row) => money(row.amount) }]} rows={['Cash','Mobile Money','Card','Transfer','Insurance'].map((method) => ({ id: method, method, count: activeTransactions.filter((txn) => txn.method === method).length, amount: activeTransactions.filter((txn) => txn.method === method).reduce((sum, txn) => sum + Number(txn.amount || 0), 0) }))} />
        </Card>
        <Card title="Active shift transactions" subtitle="Payments recorded while a shift is open are linked to that shift.">
          <DataTable columns={[{ key: 'id', label: 'Txn ID' }, { key: 'invoiceId', label: 'Invoice' }, { key: 'patient', label: 'Patient', render: (row) => row.patient?.fullName || '—' }, { key: 'method', label: 'Method' }, { key: 'amount', label: 'Amount', render: (row) => money(row.amount) }, { key: 'createdAt', label: 'Time', render: (row) => formatDateTime(row.createdAt) }]} rows={activeTransactions} emptyMessage="No transactions linked to the active shift yet." />
        </Card>
      </div>
      <Card title="Shift history" subtitle="Closed shifts are read-only and can be filtered by cashier/date for audits.">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <select className={inputClass} value={cashier} onChange={(event) => setCashier(event.target.value)}><option value="">All cashiers</option>{cashiers.map((name) => <option key={name}>{name}</option>)}</select>
          <input className={inputClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <input className={inputClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <Button variant="secondary" onClick={() => { setCashier(''); setStartDate(''); setEndDate(''); }}>Clear filters</Button>
        </div>
        <DataTable columns={[{ key: 'id', label: 'Shift' }, { key: 'shiftType', label: 'Type', render: (row) => row.shiftType || '—' }, { key: 'startedBy', label: 'Cashier' }, { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> }, { key: 'openingFloat', label: 'Opening', render: (row) => money(row.openingFloat) }, { key: 'expectedCash', label: 'Expected Cash', render: (row) => money(row.expectedCash) }, { key: 'actualCash', label: 'Actual Cash', render: (row) => row.status === 'Closed' ? money(row.actualCash) : '—' }, { key: 'variance', label: 'Variance', render: (row) => row.status === 'Closed' ? money(row.variance) : '—' }, { key: 'txnCount', label: 'Transactions' }, { key: 'startedAt', label: 'Started', render: (row) => formatDateTime(row.startedAt) }, { key: 'closedAt', label: 'Closed', render: (row) => row.closedAt ? formatDateTime(row.closedAt) : '—' }]} rows={shiftRows} emptyMessage="No finance shifts match your filters." />
      </Card>
    </div>
  );
}
