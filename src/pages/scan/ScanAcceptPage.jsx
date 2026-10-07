import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Printer } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { getScanOrders } from '../../utils/orderViews';
import { departmentTests, paymentStateFor, pendingTests, requestedBy } from '../../utils/diagnosticWorkflow';
import { escapeHtml, printDocument } from '../../utils/printDocument';

/*
  Accepting studies - the second half of the Incoming tab.

  Tick the studies about to be done and accept them; the rest stay in Incoming
  until the patient comes back for them. The slip printed afterwards goes with
  the patient to the modality, which is the imaging equivalent of the label on a
  tube.
*/

function acceptanceSlipHtml({ order, rows, facilityName }) {
  const body = rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.item?.modality || '')}</td>
      <td class="sign"></td>
    </tr>`).join('');

  return `
    <header>
      <div>
        <h1>${escapeHtml(facilityName)}</h1>
        <div class="sub">Scan / Imaging — Accepted Requests</div>
      </div>
      <div class="meta">Order ${escapeHtml(order.id)}<br>${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
    </header>
    <dl>
      <div><dt>Patient:</dt><dd>${escapeHtml(order.patient?.fullName || '—')}</dd></div>
      <div><dt>Hospital ID:</dt><dd>${escapeHtml(order.patient?.id || '—')}</dd></div>
      <div><dt>Gender:</dt><dd>${escapeHtml(order.patient?.gender || '—')}</dd></div>
      <div><dt>Date of birth:</dt><dd>${escapeHtml(order.patient?.dateOfBirth || '—')}</dd></div>
      <div><dt>Requested by:</dt><dd>${escapeHtml(requestedBy(order))}</dd></div>
      <div><dt>Requested:</dt><dd>${escapeHtml(order.createdAt ? formatDateTime(order.createdAt) : '—')}</dd></div>
    </dl>
    <table>
      <thead><tr><th>#</th><th>Study</th><th>Modality</th><th>Done by</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <footer>This slip goes with the patient. Studies not listed here are still waiting in the incoming queue.</footer>`;
}

export function ScanAcceptPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const orderId = state.ui.activeScanAcceptOrderId;
  const order = useMemo(() => getScanOrders(data).find((candidate) => candidate.id === orderId) || null, [data, orderId]);
  const printout = state.ui.acceptedPrintout?.orderId === orderId ? state.ui.acceptedPrintout : null;

  useEffect(() => { setSelected([]); }, [orderId]);

  const backToQueue = () => dispatch({ type: 'NAVIGATE', pageId: 'scan-queue' });

  if (!order) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Imaging · Incoming" title="Accept studies" description="Open a request from the incoming queue to accept its studies." />
        <Card title="Nothing selected" subtitle="This page works on one request at a time.">
          <Button onClick={backToQueue}><ArrowLeft className="h-4 w-4" /> Back to Incoming Scans</Button>
        </Card>
      </div>
    );
  }

  const pending = pendingTests(order, 'Imaging');
  const accepted = departmentTests(order, 'Imaging').filter((row) => row.accepted);
  const allOn = pending.length > 0 && selected.length === pending.length;
  const facilityName = state.auth?.facility?.name || 'CurataMed';

  const toggle = (orderItemId) => {
    setError('');
    setSelected((current) => current.includes(orderItemId) ? current.filter((id) => id !== orderItemId) : [...current, orderItemId]);
  };

  function acceptSelected() {
    if (!selected.length) {
      setError('Tick at least one study you are about to do.');
      return;
    }
    dispatch({ type: 'ACCEPT_SCAN_TESTS', payload: { orderId: order.id, orderItemIds: selected, notes } });
    setSelected([]);
  }

  function closePrintout() {
    dispatch({ type: 'CLOSE_ACCEPTED_PRINTOUT' });
    if (pendingTests(order, 'Imaging').length === 0) backToQueue();
  }

  // The slip is printed from the current pending/accepted state rather than from
  // what the command returned, so it names the studies by their proper names.
  const justAccepted = accepted.filter((row) => (printout?.samples || []).some((sample) => sample.sampleCode === row.sample?.apiId));
  const slipRows = justAccepted.length ? justAccepted : accepted;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Imaging · Incoming"
        title="Accept studies"
        description="Tick only the studies you are about to do, then accept. Anything not ticked stays in Incoming Scans."
        actions={<Button variant="secondary" onClick={backToQueue}><ArrowLeft className="h-4 w-4" /> Back</Button>}
      />

      <Card title={order.patient?.fullName || 'Unknown patient'} subtitle={`${order.patient?.id || '—'} · ${order.id}`} compact>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Requested by</p>
            <p className="font-bold text-slate-900">{requestedBy(order)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Time requested</p>
            <p className="font-bold text-slate-900">{order.createdAt ? formatDateTime(order.createdAt) : '—'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Urgency</p>
            <p className="font-bold text-slate-900">{order.urgency || 'Routine'}</p>
          </div>
        </div>
        {order.clinicalNotes && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinical notes from the clinician</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{order.clinicalNotes}</p>
          </div>
        )}
      </Card>

      <Card title="Studies waiting to be accepted" subtitle={pending.length ? 'Price and payment status are shown so you know what has been settled. They do not stop you accepting a study.' : undefined}>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="font-bold text-slate-900">Everything on this request has been accepted.</p>
            <div className="mt-3"><Button onClick={backToQueue}>Back to Incoming Scans</Button></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <th className="w-10 py-2">
                      <input
                        type="checkbox"
                        checked={allOn}
                        aria-label="Select every study"
                        onChange={() => setSelected(allOn ? [] : pending.map((row) => row.orderItemId))}
                      />
                    </th>
                    <th className="py-2 pr-3">Requested study</th>
                    <th className="py-2 pr-3">Modality</th>
                    <th className="py-2 pr-3">Price</th>
                    <th className="py-2">Payment status</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((row) => (
                    <tr key={row.orderItemId} className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50" onClick={() => toggle(row.orderItemId)}>
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(row.orderItemId)}
                          aria-label={`Accept ${row.name}`}
                          onChange={() => toggle(row.orderItemId)}
                          onClick={(event) => event.stopPropagation()}
                        />
                      </td>
                      <td className="py-3 pr-3 font-bold text-slate-900">{row.name}</td>
                      <td className="py-3 pr-3 text-slate-600">{row.item?.modality || '—'}</td>
                      <td className="py-3 pr-3 text-slate-600">{row.price === null ? '—' : money(row.price)}</td>
                      <td className="py-3"><StatusBadge status={paymentStateFor(order, row)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 sm:max-w-md">
              <FormField label="Note for the unit (optional)">
                <input className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. patient cannot lie flat" />
              </FormField>
            </div>

            {error && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}

            <div className="mt-4">
              <Button onClick={acceptSelected} disabled={!selected.length}>
                <Check className="h-4 w-4" /> Accept selected ({selected.length})
              </Button>
            </div>
          </>
        )}
      </Card>

      {accepted.length > 0 && (
        <Card title="Already accepted" subtitle="These are with the unit, waiting to be reported." compact>
          <div className="space-y-2">
            {accepted.map((row) => (
              <div key={row.orderItemId} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="font-bold text-emerald-900">{row.name}</p>
                <p className="text-xs font-semibold text-emerald-700">
                  accepted {row.sample?.acceptedAt ? formatDateTime(row.sample.acceptedAt) : '—'}
                  {row.hasResult ? ' · reported' : ''}
                  {row.sample?.dicomCount ? ` · ${row.sample.dicomCount} image(s)` : ''}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(printout)}
        onClose={closePrintout}
        title="Studies accepted"
        description="Print this slip and send it with the patient."
        footer={(
          <>
            <Button variant="secondary" onClick={closePrintout}>Close</Button>
            <Button onClick={() => {
              const ok = printDocument(`Accepted studies ${order.id}`, acceptanceSlipHtml({ order, rows: slipRows, facilityName }));
              if (!ok) setError('The printout could not open. Allow pop-ups for this site and try again.');
            }}>
              <Printer className="h-4 w-4" /> Print slip
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-50 p-3 text-sm">
            <p className="font-bold text-slate-900">{order.patient?.fullName}</p>
            <p className="text-slate-600">{order.patient?.id} · {order.id} · requested by {requestedBy(order)}</p>
          </div>
          <ul className="space-y-1 text-sm">
            {slipRows.map((row) => (
              <li key={row.orderItemId} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 last:border-b-0">
                <span className="font-semibold text-slate-900">{row.name}</span>
                <span className="text-xs font-semibold text-slate-500">{row.item?.modality || '—'}</span>
              </li>
            ))}
          </ul>
          {pendingTests(order, 'Imaging').length > 0 && (
            <p className="text-sm text-slate-600">
              {pendingTests(order, 'Imaging').length} study(s) on this request are still waiting, and stay in Incoming Scans.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
