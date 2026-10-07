import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Printer, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { getLabOrders } from '../../utils/orderViews';
import { departmentTests, paymentStateFor, pendingTests, requestedBy } from '../../utils/diagnosticWorkflow';
import { escapeHtml, printDocument } from '../../utils/printDocument';

/*
  Accepting samples - the second half of the Incoming tab.

  Tick only the tests whose samples are on the bench now, then accept. Anything
  not ticked stays in Incoming until its sample is drawn, which is the whole
  point: a request for six tests almost never arrives as six tubes, and the lab
  should not have to pretend otherwise to get started on the three it has.

  Accepting prints a slip - patient details at the top, then the accepted tests
  with their accession numbers and a column to initial. That slip travels with
  the samples, which is how the bench knows which tube is which.
*/

function acceptanceSlipHtml({ order, samples, facilityName }) {
  const rows = samples.map((sample, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(sample.testName)}</td>
      <td>${escapeHtml(sample.sampleCode)}</td>
      <td class="sign"></td>
    </tr>`).join('');

  return `
    <header>
      <div>
        <h1>${escapeHtml(facilityName)}</h1>
        <div class="sub">Laboratory — Accepted Samples</div>
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
      <thead><tr><th>#</th><th>Test</th><th>Accession No.</th><th>Done by</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <footer>Attach this slip to the samples. Tests not listed here are still waiting in the incoming queue.</footer>`;
}

export function LabAcceptPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [selected, setSelected] = useState([]);
  const [sampleType, setSampleType] = useState('Blood');
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const orderId = state.ui.activeLabAcceptOrderId;
  const order = useMemo(() => getLabOrders(data).find((candidate) => candidate.id === orderId) || null, [data, orderId]);

  // The slip the command hands back once the samples are accepted.
  const printout = state.ui.acceptedPrintout?.orderId === orderId ? state.ui.acceptedPrintout : null;

  // Tests that have been accepted drop out of the pending list, so a selection
  // made before accepting must not linger and re-submit the same ids.
  useEffect(() => { setSelected([]); }, [orderId]);

  const backToQueue = () => dispatch({ type: 'NAVIGATE', pageId: 'lab-queue' });

  if (!order) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Laboratory · Incoming" title="Accept samples" description="Open a request from the incoming queue to accept its samples." />
        <Card title="Nothing selected" subtitle="This page works on one request at a time.">
          <Button onClick={backToQueue}><ArrowLeft className="h-4 w-4" /> Back to Incoming Labs</Button>
        </Card>
      </div>
    );
  }

  const pending = pendingTests(order, 'Laboratory');
  const accepted = departmentTests(order, 'Laboratory').filter((row) => row.accepted);
  const allOn = pending.length > 0 && selected.length === pending.length;

  const toggle = (orderItemId) => {
    setError('');
    setSelected((current) => current.includes(orderItemId) ? current.filter((id) => id !== orderItemId) : [...current, orderItemId]);
  };

  function acceptSelected() {
    if (!selected.length) {
      setError('Tick at least one test whose sample is available.');
      return;
    }
    dispatch({ type: 'ACCEPT_LAB_TESTS', payload: { orderId: order.id, orderItemIds: selected, sampleType } });
    setSelected([]);
  }

  function closePrintout() {
    dispatch({ type: 'CLOSE_ACCEPTED_PRINTOUT' });
    // Nothing left to accept on this request, so the bench is done with it.
    if (pendingTests(order, 'Laboratory').length === 0) backToQueue();
  }

  function confirmReject() {
    if (!rejectReason.trim()) return;
    dispatch({ type: 'REJECT_SAMPLE', sampleId: rejecting.sample.id, reason: rejectReason.trim(), requestRecollection: true });
    setRejecting(null);
    setRejectReason('');
  }

  const facilityName = state.auth?.facility?.name || 'CurataMed';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Laboratory · Incoming"
        title="Accept samples"
        description="Tick only the tests whose samples are available now, then accept. Anything not ticked stays in Incoming Labs."
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

      <Card
        title="Tests waiting to be accepted"
        subtitle={pending.length ? 'The price and payment status are shown so you know what has been settled. They do not stop you accepting a sample.' : undefined}
      >
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="font-bold text-slate-900">Everything on this request has been accepted.</p>
            <div className="mt-3"><Button onClick={backToQueue}>Back to Incoming Labs</Button></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <th className="w-10 py-2">
                      <input
                        type="checkbox"
                        checked={allOn}
                        aria-label="Select every test"
                        onChange={() => setSelected(allOn ? [] : pending.map((row) => row.orderItemId))}
                      />
                    </th>
                    <th className="py-2 pr-3">Requested test</th>
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
                      <td className="py-3 pr-3 text-slate-600">{row.price === null ? '—' : money(row.price)}</td>
                      <td className="py-3"><StatusBadge status={paymentStateFor(order, row)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 sm:max-w-xs">
              <FormField label="Sample type">
                <select className={inputClass} value={sampleType} onChange={(event) => setSampleType(event.target.value)}>
                  <option>Blood</option>
                  <option>Urine</option>
                  <option>Stool</option>
                  <option>Swab</option>
                  <option>Sputum</option>
                  <option>Tissue</option>
                  <option>Other</option>
                </select>
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
        <Card title="Already accepted" subtitle="These are with the bench. A sample that turns out to be unusable can be sent back for recollection." compact>
          <div className="space-y-2">
            {accepted.map((row) => (
              <div key={row.orderItemId} className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-emerald-900">{row.name}</p>
                  <p className="text-xs font-semibold text-emerald-700">
                    {row.sample?.id} · accepted {row.sample?.acceptedAt ? formatDateTime(row.sample.acceptedAt) : '—'}
                    {row.hasResult ? ' · result entered' : ''}
                  </p>
                </div>
                {!row.hasResult && (
                  <Button variant="danger" size="sm" onClick={() => { setRejectReason(''); setRejecting(row); }}>
                    <XCircle className="h-4 w-4" /> Reject / recollect
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(printout)}
        onClose={closePrintout}
        title="Samples accepted"
        description="Print this slip and attach it to the samples."
        footer={(
          <>
            <Button variant="secondary" onClick={closePrintout}>Close</Button>
            <Button onClick={() => {
              const ok = printDocument(`Accepted samples ${order.id}`, acceptanceSlipHtml({ order, samples: printout?.samples || [], facilityName }));
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
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="py-2 pr-3">Test</th>
                <th className="py-2">Accession no.</th>
              </tr>
            </thead>
            <tbody>
              {(printout?.samples || []).map((sample) => (
                <tr key={sample.sampleCode} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{sample.testName || '—'}</td>
                  <td className="py-2 font-mono text-slate-700">{sample.sampleCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pendingTests(order, 'Laboratory').length > 0 && (
            <p className="text-sm text-slate-600">
              {pendingTests(order, 'Laboratory').length} test(s) on this request are still waiting for their samples, and stay in Incoming Labs.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.name || 'sample'}`}
        description="The test goes back to Incoming Labs so a fresh sample can be drawn. The reason is kept."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmReject} disabled={!rejectReason.trim()}>Reject and request recollection</Button>
          </>
        )}
      >
        <FormField label="Reason">
          <input
            className={inputClass}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="e.g. haemolysed, insufficient volume, clotted"
          />
        </FormField>
      </Modal>
    </div>
  );
}
