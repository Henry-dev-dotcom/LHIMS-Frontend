import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer, Receipt as ReceiptIcon, Search, Wallet } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { patientMatchesSearch } from '../../utils/patientUtils';
import { escapeHtml, printDocument } from '../../utils/printDocument';

/*
  The cashier's window.

  Search the patient, open their tab, see what they owe and what it is for, take
  the money, print the receipt. That is the whole job, and it is one screen
  because at a window there is a person waiting on the other side of it.

  Everything else Finance does - expenses, float, shift reconciliation, the
  ledger, the analytics - is accounting rather than cashiering, and now sits
  under its own heading instead of competing with this for the cashier's
  attention.
*/

const METHODS = ['Cash', 'Mobile Money', 'Card', 'Bank Transfer', 'Insurance'];

/** Everything owed and paid by one patient, from the invoices already loaded. */
function financeRowFor(patient, invoices) {
  const theirs = invoices.filter((invoice) => invoice.patientId === patient.id);
  const billed = theirs.reduce((total, invoice) => total + invoice.amount, 0);
  const outstanding = theirs.reduce((total, invoice) => total + invoice.balance, 0);
  const lastBilledAt = theirs.reduce((latest, invoice) => (
    !latest || String(invoice.createdAt || '') > latest ? invoice.createdAt || '' : latest
  ), '');
  return { patient, invoices: theirs, billed, outstanding, lastBilledAt };
}

function receiptHtml({ facilityName, patient, invoice, receipt, cashier }) {
  const items = invoice.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.description)}${item.quantity > 1 ? ` &times;${item.quantity}` : ''}</td>
      <td style="text-align:right">${escapeHtml(money(item.amount))}</td>
    </tr>`).join('');

  // The balance as it stands after this payment, which is what the patient asks.
  const balance = Math.max(0, invoice.balance);

  return `
    <header>
      <div>
        <h1>${escapeHtml(facilityName)}</h1>
        <div class="sub">Payment receipt</div>
      </div>
      <div class="meta">${escapeHtml(receipt.receiptCode || 'Receipt')}<br>${escapeHtml(formatDateTime(receipt.paidAt))}</div>
    </header>
    <dl>
      <div><dt>Patient:</dt><dd>${escapeHtml(patient?.fullName || '—')}</dd></div>
      <div><dt>Hospital ID:</dt><dd>${escapeHtml(patient?.id || '—')}</dd></div>
      <div><dt>Bill:</dt><dd>${escapeHtml(invoice.id)}</dd></div>
      <div><dt>Method:</dt><dd>${escapeHtml(receipt.method)}${receipt.reference ? ` (${escapeHtml(receipt.reference)})` : ''}</dd></div>
      <div><dt>Received by:</dt><dd>${escapeHtml(cashier)}</dd></div>
    </dl>
    <table>
      <thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${items}
        <tr><td><strong>Bill total</strong></td><td style="text-align:right"><strong>${escapeHtml(money(invoice.amount))}</strong></td></tr>
        <tr><td><strong>Paid on this receipt</strong></td><td style="text-align:right"><strong>${escapeHtml(money(receipt.amount))}</strong></td></tr>
        <tr><td>Paid to date</td><td style="text-align:right">${escapeHtml(money(invoice.paidAmount))}</td></tr>
        <tr><td>Balance remaining</td><td style="text-align:right">${escapeHtml(money(balance))}</td></tr>
      </tbody>
    </table>
    <footer>Thank you. Please keep this receipt.</footer>`;
}

export function FinanceDeskPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const [owingOnly, setOwingOnly] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [openingFloat, setOpeningFloat] = useState('0');

  const invoices = useMemo(() => data.invoices || [], [data.invoices]);
  /*
    The till has to be open before money can be taken.

    That is proper practice rather than an obstacle - cash is counted in at the
    start of a shift and reconciled at the end - but it has to be visible here.
    Clicking "Take payment" against a closed till used to do nothing at all,
    because the refusal arrived as a toast that had gone by the time anyone
    looked for it.
  */
  const shift = useMemo(
    () => (data.financeShifts || []).find((entry) => entry.status === 'Open'),
    [data.financeShifts]
  );
  const patients = useMemo(() => data.patients || [], [data.patients]);
  const patientId = state.ui.activeFinancePatientId;
  const patient = patients.find((candidate) => candidate.id === patientId) || null;
  const receipt = state.ui.lastReceipt;

  // Only patients who have ever been billed; the rest are nothing to do with a till.
  const rows = useMemo(() => {
    const billedIds = new Set(invoices.map((invoice) => invoice.patientId));
    return patients
      .filter((candidate) => billedIds.has(candidate.id))
      .map((candidate) => financeRowFor(candidate, invoices))
      .filter((row) => (owingOnly ? row.outstanding > 0 : true))
      .filter((row) => patientMatchesSearch(row.patient, query))
      .sort((a, b) => b.outstanding - a.outstanding || String(b.lastBilledAt).localeCompare(String(a.lastBilledAt)));
  }, [patients, invoices, owingOnly, query]);

  const theirInvoices = useMemo(() => (patient ? financeRowFor(patient, invoices).invoices : []), [patient, invoices]);
  const payingInvoice = theirInvoices.find((invoice) => invoice.id === payingInvoiceId) || null;
  const receiptInvoice = receipt ? theirInvoices.find((invoice) => invoice.id === receipt.invoiceId) || null : null;

  // Once the payment lands the dialog has served its purpose; the receipt takes over.
  useEffect(() => {
    if (receipt) {
      setPayingInvoiceId('');
      setBusy(false);
    }
  }, [receipt]);

  /*
    A refusal from the server belongs in the dialog, not in a toast.

    The cashier is looking at the amount they just typed, with a patient waiting;
    an error that appears at the edge of the screen and then disappears is the
    same as no error at all.
  */
  const toast = state.ui.toast;
  useEffect(() => {
    if (!busy || !toast || toast.type !== 'error') return;
    setError(toast.message || 'The payment was not taken.');
    setBusy(false);
  }, [toast, busy]);

  function openPayment(invoice) {
    setPayingInvoiceId(invoice.id);
    // Default to clearing the bill, which is what most people are paying.
    setAmount(invoice.balance > 0 ? String(invoice.balance) : '');
    setMethod('Cash');
    setReference('');
    setError('');
  }

  function submitPayment() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the amount being paid.');
      return;
    }
    if (value > payingInvoice.balance) {
      setError(`That is more than the ${money(payingInvoice.balance)} outstanding on this bill.`);
      return;
    }
    setError('');
    setBusy(true);
    dispatch({
      type: 'RECEIVE_PAYMENT',
      payload: { invoiceId: payingInvoice.id, patientId: patient.id, amount: value, method, reference }
    });
    window.setTimeout(() => setBusy(false), 1500);
  }

  const facilityName = state.auth?.facility?.name || 'LHIMS';
  const cashier = state.auth?.userName || 'Cashier';

  /* ------------------------------------------------------------ the patient's tab */
  if (patient) {
    const row = financeRowFor(patient, invoices);
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Finance · Billing"
          title={patient.fullName}
          description={`${patient.id}${patient.phone ? ` · ${patient.phone}` : ''} · ${row.outstanding > 0 ? `${money(row.outstanding)} outstanding` : 'nothing outstanding'}`}
          actions={<Button variant="secondary" onClick={() => dispatch({ type: 'OPEN_FINANCE_PATIENT', patientId: '' })}><ArrowLeft className="h-4 w-4" /> Back</Button>}
        />

        {!shift && (
        <Card title="The till is closed" subtitle="Cash is counted in at the start of a shift, so a payment cannot be taken until it is open." compact>
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Opening float">
              <input className={inputClass} type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} />
            </FormField>
            <Button onClick={() => dispatch({ type: 'START_FINANCE_SHIFT', payload: { openingFloat: Number(openingFloat || 0) } })}>
              Open the till
            </Button>
          </div>
        </Card>
      )}

      {theirInvoices.length === 0 ? (
          <Card title="No bills" subtitle="This patient has nothing billed to them.">
            <Button onClick={() => dispatch({ type: 'OPEN_FINANCE_PATIENT', patientId: '' })}>Back to the window</Button>
          </Card>
        ) : theirInvoices.map((invoice) => (
          <Card
            key={invoice.id}
            title={invoice.id}
            subtitle={`${invoice.orderId ? `For ${invoice.orderId} · ` : ''}${invoice.createdAt ? formatDateTime(invoice.createdAt) : ''}`}
            actions={(
              <>
                <StatusBadge status={invoice.status} />
                {invoice.balance > 0 && (
                  <Button onClick={() => openPayment(invoice)} disabled={!shift} title={shift ? undefined : 'Open the till first'}>
                    <Wallet className="h-4 w-4" /> Receive payment
                  </Button>
                )}
              </>
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2 pr-3 text-slate-700">{item.description}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</td>
                      <td className="py-2 text-right text-slate-700">{money(item.amount)}</td>
                    </tr>
                  ))}
                  {invoice.items.length === 0 && (
                    <tr><td colSpan={2} className="py-2 text-slate-500">No itemised lines on this bill.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Bill total</p>
                <p className="font-bold text-slate-900">{money(invoice.amount)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Paid</p>
                <p className="font-bold text-slate-900">{money(invoice.paidAmount)}</p>
              </div>
              <div className={`rounded-2xl p-3 ${invoice.balance > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Outstanding</p>
                <p className={`font-bold ${invoice.balance > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {invoice.balance > 0 ? money(invoice.balance) : 'Cleared'}
                </p>
              </div>
            </div>

            {invoice.payments.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Payments taken</p>
                <ul className="mt-1.5 space-y-1">
                  {invoice.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                      <span className="flex items-center gap-2 font-semibold text-slate-900">
                        <ReceiptIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                        {money(payment.amount)} · {payment.method}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {payment.receiptCode || '—'}{payment.receivedBy ? ` · ${payment.receivedBy}` : ''}{payment.paidAt ? ` · ${formatDateTime(payment.paidAt)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ))}

        <Modal
          open={Boolean(payingInvoice)}
          onClose={() => setPayingInvoiceId('')}
          title={`Receive payment — ${payingInvoice?.id || ''}`}
          description={payingInvoice ? `${patient.fullName} · ${money(payingInvoice.balance)} outstanding` : ''}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setPayingInvoiceId('')} disabled={busy}>Cancel</Button>
              <Button onClick={submitPayment} disabled={busy}>{busy ? 'Taking payment…' : 'Take payment'}</Button>
            </>
          )}
        >
          <div className="space-y-4">
            <FormField label="Amount">
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                autoFocus
              />
            </FormField>
            <FormField label="Method">
              <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}>
                {METHODS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </FormField>
            {method !== 'Cash' && (
              <FormField label="Reference">
                <input
                  className={inputClass}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Transaction or authorisation number"
                />
              </FormField>
            )}
            {error && <p role="alert" className="text-sm font-semibold text-rose-600">{error}</p>}
          </div>
        </Modal>

        <Modal
          open={Boolean(receipt && receiptInvoice)}
          onClose={() => dispatch({ type: 'CLOSE_RECEIPT' })}
          title="Payment received"
          description="Print the receipt and give it to the patient."
          footer={(
            <>
              <Button variant="secondary" onClick={() => dispatch({ type: 'CLOSE_RECEIPT' })}>Close</Button>
              <Button onClick={() => printDocument(
                `Receipt ${receipt?.receiptCode || ''}`,
                receiptHtml({ facilityName, patient, invoice: receiptInvoice, receipt, cashier })
              )}>
                <Printer className="h-4 w-4" /> Print receipt
              </Button>
            </>
          )}
        >
          {receipt && receiptInvoice && (
            <div className="space-y-2 text-sm">
              <p className="text-lg font-bold text-slate-900">{money(receipt.amount)} received</p>
              <p className="text-slate-600">
                {receipt.receiptCode || 'Receipt issued'} · {receipt.method}{receipt.reference ? ` · ${receipt.reference}` : ''}
              </p>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">{patient.fullName} · {receiptInvoice.id}</p>
                <p className="text-slate-600">
                  Paid to date {money(receiptInvoice.paidAmount)} of {money(receiptInvoice.amount)}
                  {receiptInvoice.balance > 0 ? ` · ${money(receiptInvoice.balance)} still outstanding` : ' · cleared'}
                </p>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  /* ---------------------------------------------------------------- the window */
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Finance · Billing"
        title="Cashier"
        description="Find the patient, open their bills, and take the payment."
      />

      {!shift && (
        <Card title="The till is closed" subtitle="Open it before taking any payment. Cash is counted in now and reconciled when the shift closes." compact>
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Opening float">
              <input className={inputClass} type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} />
            </FormField>
            <Button onClick={() => dispatch({ type: 'START_FINANCE_SHIFT', payload: { openingFloat: Number(openingFloat || 0) } })}>
              Open the till
            </Button>
          </div>
        </Card>
      )}

      <Card
        title={`${rows.length} patient${rows.length === 1 ? '' : 's'}`}
        actions={(
          <>
            <div className="inline-flex rounded-2xl bg-white p-1 ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => setOwingOnly(false)}
                aria-pressed={!owingOnly}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${!owingOnly ? 'bg-clinical-500 text-white' : 'text-slate-600'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setOwingOnly(true)}
                aria-pressed={owingOnly}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${owingOnly ? 'bg-clinical-500 text-white' : 'text-slate-600'}`}
              >
                Owing only
              </button>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
              <input
                className={`${inputClass} pl-9`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patient name, ID or phone..."
                aria-label="Search patient name, ID or phone"
              />
            </div>
          </>
        )}
      >
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <Wallet className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-2 font-bold text-slate-900">{owingOnly ? 'Nobody owes anything.' : 'No billed patients found.'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {owingOnly ? 'Switch to All to see everyone who has been billed.' : 'A patient appears here once something has been billed to them.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="py-2 pr-3">Patient</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3 text-right">Total billed</th>
                  <th className="py-2 pr-3 text-right">Outstanding</th>
                  <th className="py-2 pr-3">Last bill</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.patient.id} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900">{row.patient.fullName}</p>
                      <p className="text-xs font-semibold text-slate-500">{row.patient.id}</p>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{row.patient.phone || '—'}</td>
                    <td className="py-3 pr-3 text-right text-slate-700">{money(row.billed)}</td>
                    <td className="py-3 pr-3 text-right">
                      {row.outstanding > 0
                        ? <span className="font-bold text-amber-900">{money(row.outstanding)}</span>
                        : <StatusBadge status="Cleared" />}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{row.lastBilledAt ? formatDateTime(row.lastBilledAt) : '—'}</td>
                    <td className="py-3">
                      <Button size="sm" onClick={() => dispatch({ type: 'OPEN_FINANCE_PATIENT', patientId: row.patient.id })}>Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
