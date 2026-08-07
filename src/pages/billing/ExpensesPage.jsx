import { useMemo, useState } from 'react';
import { ArrowDownCircle, FileText, PlusCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { dateInRange, uniqueCashiers } from '../../utils/financeUtils';

const blankExpense = { description: '', category: 'Purchase Cost', amount: '', amountPaid: '', method: 'Cash', vendor: '', reference: '', notes: '' };

export function ExpensesPage() {
  const { state, dispatch } = useAppStore();
  const [form, setForm] = useState(blankExpense);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [cashier, setCashier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const expenses = state.data.expenses || [];
  const cashiers = uniqueCashiers(state.data);
  const filtered = useMemo(() => expenses.filter((expense) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || [expense.id, expense.description, expense.category, expense.vendor, expense.reference, expense.status, expense.createdBy].filter(Boolean).join(' ').toLowerCase().includes(q);
    const matchesStatus = !status || expense.status === status;
    const matchesCategory = !category || expense.category === category;
    const matchesCashier = !cashier || expense.createdBy === cashier || (expense.payments || []).some((pay) => pay.staff === cashier);
    return matchesQuery && matchesStatus && matchesCategory && matchesCashier && dateInRange(expense.createdAt, startDate, endDate);
  }), [expenses, query, status, category, cashier, startDate, endDate]);
  const paid = filtered.reduce((sum, expense) => sum + Number(expense.amountPaid || 0), 0);
  const outstanding = filtered.filter((expense) => !['Paid','Written Off'].includes(expense.status)).reduce((sum, expense) => sum + Math.max(0, Number(expense.amount || 0) - Number(expense.amountPaid || 0)), 0);
  const writtenOff = filtered.filter((expense) => expense.status === 'Written Off').reduce((sum, expense) => sum + Math.max(0, Number(expense.amount || 0) - Number(expense.amountPaid || 0)), 0);

  function saveExpense(event) {
    event.preventDefault();
    dispatch({ type: 'CREATE_EXPENSE', payload: form });
    setForm(blankExpense);
  }

  function recordExpensePayment(expense) {
    const amount = window.prompt('Payment amount:', String(Math.max(0, Number(expense.amount || 0) - Number(expense.amountPaid || 0)))) || '';
    if (!amount) return;
    const method = window.prompt('Payment method:', expense.method || 'Cash') || expense.method || 'Cash';
    dispatch({ type: 'RECORD_EXPENSE_PAYMENT', payload: { expenseId: expense.id, amount, method } });
  }

  function writeOff(expense) {
    const reason = window.prompt('Required write-off reason:') || '';
    if (!reason.trim()) return;
    const supervisorCode = window.prompt('Supervisor approval code / name required:') || '';
    if (!supervisorCode.trim()) return;
    dispatch({ type: 'WRITE_OFF_EXPENSE', payload: { expenseId: expense.id, reason, supervisorCode } });
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance" title="Expenses" description="Centralised outgoing payments for purchase cost, courier fees, subscriptions, rent, equipment, salaries, partial payments and write-offs." />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Paid Out" value={money(paid)} icon={ArrowDownCircle} tone="red" />
        <MetricCard label="Outstanding" value={money(outstanding)} icon={FileText} tone="yellow" />
        <MetricCard label="Written Off" value={money(writtenOff)} icon={RotateCcw} tone="purple" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card title="Create expense" subtitle="Record a vendor/payment obligation and its paid/unpaid/write-off status.">
          <form onSubmit={saveExpense} className="space-y-4">
            <FormField label="Description"><input className={inputClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Category"><select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Purchase Cost</option><option>Salary / Staff</option><option>Courier Fees</option><option>Subscription</option><option>Rent / Utilities</option><option>Equipment</option><option>Other</option></select></FormField>
              <FormField label="Method"><select className={inputClass} value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option></select></FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Total amount"><input className={inputClass} type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></FormField>
              <FormField label="Amount paid"><input className={inputClass} type="number" step="0.01" value={form.amountPaid} onChange={(event) => setForm({ ...form, amountPaid: event.target.value })} /></FormField>
            </div>
            <FormField label="Vendor / Payee"><input className={inputClass} value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} /></FormField>
            <FormField label="Reference / receipt"><input className={inputClass} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></FormField>
            <FormField label="Notes"><textarea className={`${inputClass} min-h-20`} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></FormField>
            <Button type="submit"><PlusCircle className="h-4 w-4" /> Save Expense</Button>
          </form>
        </Card>
        <Card title="Expense register" subtitle="Recall payments that are fully paid, partly paid, unpaid, or forgiven/write-off. Supervisor approval is required for write-offs.">
          <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search expenses" aria-label="Search expenses" />
            <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="">All categories</option><option>Purchase Cost</option><option>Salary / Staff</option><option>Courier Fees</option><option>Subscription</option><option>Rent / Utilities</option><option>Equipment</option><option>Other</option></select>
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option>Paid</option><option>Partial</option><option>Unpaid</option><option>Written Off</option></select>
            <select className={inputClass} value={cashier} onChange={(event) => setCashier(event.target.value)} aria-label="Filter by cashier"><option value="">All staff</option>{cashiers.map((name) => <option key={name}>{name}</option>)}</select>
            <input className={inputClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Filter by start date" />
            <input className={inputClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Filter by end date" />
          </div>
          <DataTable columns={[{ key: 'id', label: 'Expense ID' }, { key: 'description', label: 'Description' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: (row) => money(row.amount) }, { key: 'amountPaid', label: 'Paid', render: (row) => money(row.amountPaid) }, { key: 'balance', label: 'Balance', render: (row) => money(Math.max(0, Number(row.amount || 0) - Number(row.amountPaid || 0))) }, { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> }, { key: 'createdBy', label: 'Recorded By' }, { key: 'createdAt', label: 'Date', render: (row) => formatDateTime(row.createdAt) }, { key: 'actions', label: 'Actions', render: (row) => <div className="flex flex-wrap gap-2"><Button className="px-3 py-1.5 text-xs" disabled={row.status === 'Paid' || row.status === 'Written Off'} onClick={() => recordExpensePayment(row)}>Pay</Button><Button variant="danger" className="px-3 py-1.5 text-xs" disabled={row.status === 'Written Off'} onClick={() => writeOff(row)}>Write Off</Button></div> }]} rows={filtered} emptyMessage="No expenses match your filters." />
        </Card>
      </div>
    </div>
  );
}
