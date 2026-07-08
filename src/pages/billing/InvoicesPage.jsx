import { useMemo, useState } from 'react';
import { CreditCard, Landmark, Printer, ReceiptText, RotateCcw, Search } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricCard } from '../../components/ui/MetricCard';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, getById, money } from '../../utils/formatters';
import { dateInRange, invoiceBalance, invoiceContext, invoicePaid, invoiceTotal, uniqueCashiers } from '../../utils/financeUtils';

function statusGroup(status) {
  if (status === 'Paid') return 'Paid';
  if (status === 'Partial') return 'Partly Paid';
  if (status === 'Refunded') return 'Refunded';
  if (status === 'Insurance Pending') return 'Insurance Pending';
  return 'Yet To Pay';
}

export function InvoicesPage() {
  const { state, dispatch } = useAppStore();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [cashier, setCashier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(state.data.invoices[0]?.id || '');
  const [payment, setPayment] = useState({ amount: '', method: 'Transfer', reference: '' });
  const [receiptInvoiceId, setReceiptInvoiceId] = useState('');
  const selectedInvoice = getById(state.data.invoices, selectedInvoiceId);
  const activeShift = (state.data.financeShifts || []).find((shift) => shift.status === 'Open' && shift.startedBy === state.auth?.userName);
  const cashiers = uniqueCashiers(state.data);

  const invoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state.data.invoices || [])
      .map((invoice) => ({ ...invoice, ...invoiceContext(state.data, invoice) }))
      .filter((invoice) => !status || statusGroup(invoice.status) === status || invoice.status === status)
      .filter((invoice) => dateInRange(invoice.createdAt, startDate, endDate))
      .filter((invoice) => !cashier || (invoice.transactions || []).some((txn) => txn.staff === cashier))
      .filter((invoice) => !q || [invoice.id, invoice.orderId, invoice.patient?.fullName, invoice.hospital?.name, invoice.insuranceReference, invoice.status, invoice.method].join(' ').toLowerCase().includes(q));
  }, [state.data, query, status, cashier, startDate, endDate]);

  const collected = invoices.reduce((sum, invoice) => sum + invoicePaid(invoice), 0);
  const outstanding = invoices.filter((invoice) => !['Paid','Refunded'].includes(invoice.status)).reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const partial = invoices.filter((invoice) => invoice.status === 'Partial').length;
  const pending = invoices.filter((invoice) => ['Pending','Insurance Pending'].includes(invoice.status)).length;
  const receiptInvoice = receiptInvoiceId ? { ...getById(state.data.invoices, receiptInvoiceId), ...invoiceContext(state.data, getById(state.data.invoices, receiptInvoiceId) || {}) } : null;

  function updateInvoice(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    dispatch({ type: 'UPDATE_INVOICE', payload: { invoiceId: selectedInvoiceId, tax: form.get('tax'), discount: form.get('discount'), insuranceReference: form.get('insuranceReference'), status: form.get('status'), method: form.get('method') } });
  }

  function recordPayment(event) {
    event.preventDefault();
    dispatch({ type: 'RECORD_PAYMENT', payload: { invoiceId: selectedInvoiceId, amount: payment.amount || invoiceBalance(selectedInvoice), method: payment.method, reference: payment.reference } });
    setPayment({ amount: '', method: 'Transfer', reference: '' });
  }

  function refund(invoiceId) {
    const amount = window.prompt('Refund / adjustment amount:', '0') || '0';
    const reason = window.prompt('Required reason for refund / adjustment:') || '';
    if (!reason.trim()) return;
    const supervisorCode = window.prompt('Supervisor approval code / name required:') || '';
    if (!supervisorCode.trim()) return;
    dispatch({ type: 'REFUND_OR_ADJUST_INVOICE', payload: { invoiceId, amount, reason, supervisorCode } });
  }

  function printReceipt() {
    window.print();
  }

  return (
    <div>
      <PageHeader eyebrow="Finance" title="Invoices & Payment Status Tracker" description="Central invoice register for patients who have paid, partly paid, have yet to pay, or are under insurance processing." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Invoices" value={invoices.length} icon={ReceiptText} tone="blue" />
        <MetricCard label="Collected" value={money(collected)} icon={CreditCard} tone="green" />
        <MetricCard label="Outstanding" value={money(outstanding)} icon={Landmark} tone="red" />
        <MetricCard label="Partly Paid" value={partial} icon={Landmark} tone="yellow" />
        <MetricCard label="Yet To Pay / Insurance" value={pending} icon={Landmark} tone="purple" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-6">
          <Card title="Invoice editor" subtitle="Tax, discount, insurance reference, and status updates are audited.">
            <form onSubmit={updateInvoice} className="space-y-4">
              <FormField label="Select invoice"><select className={inputClass} value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)}>{state.data.invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.id} — {invoice.orderId}</option>)}</select></FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Tax"><input name="tax" type="number" step="0.01" className={inputClass} defaultValue={selectedInvoice?.tax || 0} key={`${selectedInvoiceId}-tax`} /></FormField>
                <FormField label="Discount"><input name="discount" type="number" step="0.01" className={inputClass} defaultValue={selectedInvoice?.discount || 0} key={`${selectedInvoiceId}-discount`} /></FormField>
              </div>
              <FormField label="Insurance claim reference"><input name="insuranceReference" className={inputClass} defaultValue={selectedInvoice?.insuranceReference || ''} key={`${selectedInvoiceId}-insurance`} /></FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Payment status"><select name="status" className={inputClass} defaultValue={selectedInvoice?.status || 'Pending'} key={`${selectedInvoiceId}-status`}><option>Pending</option><option>Partial</option><option>Paid</option><option>Insurance Pending</option><option>Refunded</option></select></FormField>
                <FormField label="Method"><select name="method" className={inputClass} defaultValue={selectedInvoice?.method || ''} key={`${selectedInvoiceId}-method`}><option value="">Not recorded</option><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Transfer</option><option>Insurance</option></select></FormField>
              </div>
              <Button type="submit">Update Invoice</Button>
            </form>
          </Card>
          <Card title="Payment method log" subtitle="Payments are blocked unless the cashier has started a shift. Every payment goes to the active float.">
            <form onSubmit={recordPayment} className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-3 text-sm">
                <div className="font-bold text-slate-700">Selected invoice balance</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{money(invoiceBalance(selectedInvoice || {}))}</div>
              </div>
              <FormField label="Payment amount"><input type="number" step="0.01" className={inputClass} value={payment.amount} placeholder={selectedInvoice ? String(invoiceBalance(selectedInvoice)) : '0'} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} /></FormField>
              <FormField label="Payment method"><select className={inputClass} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Transfer</option><option>Insurance</option></select></FormField>
              <FormField label="Reference / note"><input className={inputClass} value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} placeholder="Transaction reference" /></FormField>
              {!activeShift && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">Start a finance shift before accepting payment.</div>}
              <Button type="submit" disabled={!activeShift}><CreditCard className="h-4 w-4" /> Record Payment</Button>
            </form>
          </Card>
        </div>

        <Card title="Invoice register" subtitle="Filter by payment category, cashier and date range. Print receipts directly from completed payments.">
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="relative md:col-span-2 xl:col-span-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, order, patient, hospital" /></div>
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All payment categories</option><option>Paid</option><option>Partly Paid</option><option>Yet To Pay</option><option>Insurance Pending</option><option>Refunded</option></select>
            <select className={inputClass} value={cashier} onChange={(event) => setCashier(event.target.value)}><option value="">All cashiers</option>{cashiers.map((name) => <option key={name}>{name}</option>)}</select>
            <input className={inputClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <input className={inputClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            <Button variant="secondary" onClick={() => { setQuery(''); setStatus(''); setCashier(''); setStartDate(''); setEndDate(''); }}>Clear filters</Button>
          </div>
          <DataTable columns={[{ key: 'id', label: 'Invoice' }, { key: 'patient', label: 'Patient', render: (row) => row.patient?.fullName || '—' }, { key: 'hospital', label: 'Hospital', render: (row) => row.hospital?.name || '—' }, { key: 'total', label: 'Total', render: (row) => money(invoiceTotal(row)) }, { key: 'paid', label: 'Paid', render: (row) => money(invoicePaid(row)) }, { key: 'balance', label: 'Balance', render: (row) => money(invoiceBalance(row)) }, { key: 'status', label: 'Status', render: (row) => <StatusBadge status={statusGroup(row.status)} /> }, { key: 'cashier', label: 'Cashier', render: (row) => (row.transactions || []).map((txn) => txn.staff).filter(Boolean).join(', ') || '—' }, { key: 'updatedAt', label: 'Updated', render: (row) => formatDateTime(row.updatedAt) }, { key: 'actions', label: 'Actions', render: (row) => <div className="flex flex-wrap gap-2"><Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setReceiptInvoiceId(row.id)}><Printer className="h-3.5 w-3.5" /> Receipt</Button><Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => refund(row.id)}><RotateCcw className="h-3.5 w-3.5" /> Adjust</Button></div> }]} rows={invoices} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Outstanding balances report" subtitle="Patients/accounts with unpaid, partial, or insurance-pending balances.">
          <DataTable columns={[{ key: 'patient', label: 'Patient / Account' }, { key: 'count', label: 'Invoices' }, { key: 'amount', label: 'Outstanding', render: (row) => money(row.amount) }]} rows={Object.values(invoices.filter((invoice) => !['Paid','Refunded'].includes(invoice.status)).reduce((acc, invoice) => { const patient = invoice.patient?.fullName || invoice.hospital?.name || 'Unassigned'; if (!acc[patient]) acc[patient] = { id: patient, patient, count: 0, amount: 0 }; acc[patient].count += 1; acc[patient].amount += invoiceBalance(invoice); return acc; }, {}))} />
        </Card>
        <Card title="Recent payment transactions" subtitle="Micro-level cashier view of every payment received into the system.">
          <DataTable columns={[{ key: 'id', label: 'Txn' }, { key: 'invoiceId', label: 'Invoice' }, { key: 'staff', label: 'Cashier' }, { key: 'method', label: 'Method' }, { key: 'amount', label: 'Amount', render: (row) => money(row.amount) }, { key: 'shiftId', label: 'Shift' }, { key: 'createdAt', label: 'Time', render: (row) => formatDateTime(row.createdAt) }]} rows={invoices.flatMap((invoice) => (invoice.transactions || []).map((txn) => ({ ...txn, invoiceId: invoice.id }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12)} />
        </Card>
      </div>

      <Modal open={Boolean(receiptInvoice)} onClose={() => setReceiptInvoiceId('')} title="Payment Receipt">
        {receiptInvoice && <div className="space-y-5" id="receipt-print-area">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm">
            <div className="text-center"><div className="text-xl font-bold text-slate-900">Diagnosis Center</div><div className="text-slate-500">Official Payment Receipt</div></div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div><span className="font-bold text-slate-500">Receipt / Invoice</span><p className="font-bold">{receiptInvoice.id}</p></div>
              <div><span className="font-bold text-slate-500">Order</span><p className="font-bold">{receiptInvoice.orderId}</p></div>
              <div><span className="font-bold text-slate-500">Patient</span><p className="font-bold">{receiptInvoice.patient?.fullName || '—'}</p></div>
              <div><span className="font-bold text-slate-500">Hospital</span><p className="font-bold">{receiptInvoice.hospital?.name || '—'}</p></div>
              <div><span className="font-bold text-slate-500">Total</span><p className="font-bold">{money(invoiceTotal(receiptInvoice))}</p></div>
              <div><span className="font-bold text-slate-500">Paid</span><p className="font-bold">{money(invoicePaid(receiptInvoice))}</p></div>
              <div><span className="font-bold text-slate-500">Balance</span><p className="font-bold">{money(invoiceBalance(receiptInvoice))}</p></div>
              <div><span className="font-bold text-slate-500">Status</span><p className="font-bold">{statusGroup(receiptInvoice.status)}</p></div>
            </div>
            <div className="mt-5">
              <div className="font-bold text-slate-700">Transactions</div>
              <DataTable columns={[{ key: 'createdAt', label: 'Date', render: (row) => formatDateTime(row.createdAt) }, { key: 'method', label: 'Method' }, { key: 'amount', label: 'Amount', render: (row) => money(row.amount) }, { key: 'staff', label: 'Cashier' }, { key: 'reference', label: 'Reference' }]} rows={receiptInvoice.transactions || []} emptyMessage="No payment transactions recorded yet." />
            </div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setReceiptInvoiceId('')}>Close</Button><Button onClick={printReceipt}><Printer className="h-4 w-4" /> Print Receipt</Button></div>
        </div>}
      </Modal>
    </div>
  );
}
