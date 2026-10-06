import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Cpu, Printer, Search, TestTube } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { getLabOrders } from '../../utils/orderViews';
import { acceptedQueue, awaitingResult, paymentStateFor, queueMatches, requestedBy } from '../../utils/labWorkflow';
import { escapeHtml, printDocument } from '../../utils/printDocument';

/*
  Accepted Samples - the second of the laboratory's three tabs.

  Samples that are with the bench and still owe a result. The list is by
  patient; opening one shows that patient's accepted tests and gives each its
  own Enter Results button, because tests finish at different times and the
  clinician should see each as it is ready.

  Entering a result is one popup with one Submit. What used to be here - draft
  values saved separately, an equipment/analyzer box, a report-summary panel and
  an internal-notes panel all above a push button - asked the bench to fill in
  four places and left it unclear which one actually sent anything. Analyzers
  have their own section now, and they file their own results.
*/

/*
  The flag a value earns against its reference range, worked out as it is typed.

  A value past a critical bound is called critical rather than merely high or
  low, because that is the one the bench must not read past. The server works the
  same flag out again when it stores the result, so what is shown here and what
  the clinician receives agree.
*/
function flagFor(parameter, raw) {
  const value = Number(String(raw ?? '').trim());
  if (!Number.isFinite(value)) return '';
  if (parameter.criticalLow !== undefined && value < parameter.criticalLow) return 'Critical';
  if (parameter.criticalHigh !== undefined && value > parameter.criticalHigh) return 'Critical';
  if (parameter.low !== undefined && value < parameter.low) return 'Low';
  if (parameter.high !== undefined && value > parameter.high) return 'High';
  if (parameter.low !== undefined || parameter.high !== undefined) return 'Normal';
  return '';
}

function reportHtml({ order, row, parameters, resultText, comment, facilityName, enteredBy }) {
  const rows = parameters
    .filter((parameter) => String(parameter.value ?? '').trim() !== '')
    .map((parameter) => `
      <tr>
        <td>${escapeHtml(parameter.name)}</td>
        <td>${escapeHtml(parameter.value)}</td>
        <td>${escapeHtml(parameter.unit || '')}</td>
        <td>${escapeHtml(parameter.referenceRange || '')}</td>
        <td>${escapeHtml(flagFor(parameter, parameter.value))}</td>
      </tr>`).join('');

  return `
    <header>
      <div>
        <h1>${escapeHtml(facilityName)}</h1>
        <div class="sub">Laboratory Report — ${escapeHtml(row.name)}</div>
      </div>
      <div class="meta">Order ${escapeHtml(order.id)}<br>${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
    </header>
    <dl>
      <div><dt>Patient:</dt><dd>${escapeHtml(order.patient?.fullName || '—')}</dd></div>
      <div><dt>Hospital ID:</dt><dd>${escapeHtml(order.patient?.id || '—')}</dd></div>
      <div><dt>Requested by:</dt><dd>${escapeHtml(requestedBy(order))}</dd></div>
      <div><dt>Accession no.:</dt><dd>${escapeHtml(row.sample?.id || '—')}</dd></div>
      <div><dt>Entered by:</dt><dd>${escapeHtml(enteredBy)}</dd></div>
      <div><dt>Sample accepted:</dt><dd>${escapeHtml(row.sample?.acceptedAt ? formatDateTime(row.sample.acceptedAt) : '—')}</dd></div>
    </dl>
    ${rows ? `<table><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Reference range</th><th>Flag</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
    ${resultText ? `<h1 style="font-size:14px;margin-top:18px">Report</h1><pre>${escapeHtml(resultText)}</pre>` : ''}
    ${comment ? `<h1 style="font-size:14px;margin-top:18px">Comment</h1><pre>${escapeHtml(comment)}</pre>` : ''}
    <footer>This is a preview of the report as entered. It is not valid until submitted.</footer>`;
}

/*
  One popup: the result, a comment, Submit.

  Where the test catalogue defines measured parameters the popup asks for those,
  with their units and reference ranges, and flags anything outside them as it is
  typed - that is what makes a numeric result readable to a clinician. Where it
  defines none, the test reports in words and gets one box to write them in.
*/
function ResultEntryModal({ open, onClose, onSubmit, order, row, enteredBy, facilityName, submitting }) {
  const parameterDefs = row?.item?.parameters || [];
  const [values, setValues] = useState({});
  const [resultText, setResultText] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  // A fresh popup per test, and a returned result arrives with its old values
  // filled in so the correction is an edit rather than a re-typing.
  useEffect(() => {
    if (!open) return;
    const draft = row?.draftResult || null;
    setValues(Object.fromEntries(parameterDefs.map((parameter) => [
      parameter.name,
      draft?.parameters?.find((entry) => entry.name === parameter.name)?.value ?? ''
    ])));
    setResultText(draft?.reportText || '');
    setComment(draft?.comment || '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.orderItemId]);

  if (!row) return null;

  // Values an instrument already filed, by field name, so each can be marked.
  const analyzerValues = new Map(
    (row.draftResult?.parameters || []).filter((parameter) => parameter.fromAnalyzer).map((parameter) => [parameter.name, parameter])
  );
  const analyzerName = analyzerValues.size > 0 ? (row.draftResult?.analyzer || 'An analyzer') : '';
  const parameters = parameterDefs.map((parameter) => ({ ...parameter, value: values[parameter.name] ?? '' }));
  const anyValue = parameters.some((parameter) => String(parameter.value).trim() !== '');
  const canSubmit = parameterDefs.length > 0 ? anyValue : resultText.trim() !== '';

  function submit() {
    if (!canSubmit) {
      setError(parameterDefs.length > 0 ? 'Enter at least one measured value.' : 'Enter the result.');
      return;
    }
    onSubmit({ parameters, resultText, comment });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enter test result — ${row.name}`}
      description={`${order.patient?.fullName || ''} (${order.patient?.id || ''}) · requested by ${requestedBy(order)}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            variant="secondary"
            onClick={() => printDocument(
              `Lab report ${row.name}`,
              reportHtml({ order, row, parameters, resultText, comment, facilityName, enteredBy })
            )}
            disabled={!canSubmit}
          >
            <Printer className="h-4 w-4" /> Preview
          </Button>
          <Button onClick={submit} disabled={submitting || !canSubmit}>{submitting ? 'Submitting…' : 'Submit'}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        {row.returnedReason && (
          <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">Returned for correction: {row.returnedReason}</p>
              <p>The previous entry is filled in below. Correct it and submit again.</p>
            </div>
          </div>
        )}

        {/*
          An analyzer may already have filed some of these values. The bench is
          checking them rather than typing them, so it is told which ones, under
          what code the instrument sent them, and what the untouched reading was
          where a unit conversion changed it. Nothing reaches the clinician until
          a person submits it.
        */}
        {analyzerName && (
          <div className="flex gap-2 rounded-2xl border border-clinical-200 bg-clinical-50 p-3 text-sm text-clinical-900">
            <Cpu className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p><span className="font-bold">{analyzerName}</span> filled the marked fields — check them before you submit.</p>
          </div>
        )}

        {parameterDefs.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {parameterDefs.map((parameter) => {
              const raw = values[parameter.name] ?? '';
              const flag = flagFor(parameter, raw);
              const filed = analyzerValues.get(parameter.name);
              return (
                <label key={parameter.name} className={`block rounded-2xl border p-3 ${filed ? 'border-clinical-200 bg-clinical-50/60' : 'border-slate-200 bg-slate-50'}`}>
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{parameter.name}</span>
                    <span className="flex items-center gap-1.5">
                      {filed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-clinical-100 px-2 py-0.5 text-[10px] font-bold text-clinical-800">
                          <Cpu className="h-3 w-3" aria-hidden="true" /> From the analyzer
                        </span>
                      )}
                      {flag && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${flag === 'Normal' ? 'bg-emerald-100 text-emerald-800' : flag === 'Critical' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-800'}`}>{flag}</span>
                      )}
                    </span>
                  </span>
                  <input
                    className={`${inputClass} mt-2`}
                    value={raw}
                    onChange={(event) => setValues((current) => ({ ...current, [parameter.name]: event.target.value }))}
                    placeholder={parameter.unit ? `Value in ${parameter.unit}` : 'Value'}
                    aria-label={parameter.name}
                  />
                  <span className="mt-1 block text-[11px] font-semibold text-slate-500">
                    {parameter.unit || '—'}{parameter.referenceRange ? ` · reference ${parameter.referenceRange}` : ''}
                  </span>
                  {filed && (
                    <span className="mt-1 block text-[11px] font-semibold text-clinical-700">
                      Sent as <span className="font-mono font-bold">{filed.analyzerCode || parameter.name}</span>
                      {filed.analyzerRawValue && filed.analyzerRawValue !== String(raw) ? ` · reading was ${filed.analyzerRawValue}, converted` : ''}
                      {filed.measuredAt ? ` · measured ${formatDateTime(filed.measuredAt)}` : ''}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        ) : (
          <FormField label="Result">
            <textarea
              className={`${inputClass} min-h-[160px]`}
              value={resultText}
              onChange={(event) => setResultText(event.target.value)}
              placeholder={'Type the result manually, for example:\nNo growth after 48 hours\nGram stain: no organisms seen'}
            />
          </FormField>
        )}

        {parameterDefs.length > 0 && (
          <FormField label="Report (optional)">
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={resultText}
              onChange={(event) => setResultText(event.target.value)}
              placeholder="Anything the numbers do not say on their own."
            />
          </FormField>
        )}

        <FormField label="Comment">
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Optional comment for the clinician."
          />
        </FormField>

        {error && <p role="alert" className="text-sm font-semibold text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}

export function AcceptedSamplesPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const [activeRow, setActiveRow] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const orderId = state.ui.activeAcceptedSampleOrderId;
  const order = useMemo(() => (orderId ? getLabOrders(data).find((candidate) => candidate.id === orderId) || null : null), [data, orderId]);
  const queue = useMemo(() => acceptedQueue(data, 'Laboratory'), [data]);
  const visible = queue.filter((candidate) => queueMatches(candidate, query));

  const facilityName = state.auth?.facility?.name || 'LHIMS';
  const enteredBy = state.auth?.userName || 'Laboratory';

  const openOrder = (id) => dispatch({ type: 'OPEN_ACCEPTED_SAMPLE', orderId: id });
  const backToList = () => dispatch({ type: 'OPEN_ACCEPTED_SAMPLE', orderId: '' });

  // The popup closes once the test it was entering leaves the waiting list,
  // which is the store's own confirmation that the result landed.
  const waiting = order ? awaitingResult(order, 'Laboratory') : [];
  useEffect(() => {
    if (!activeRow) return;
    if (!waiting.some((row) => row.orderItemId === activeRow.orderItemId)) {
      setActiveRow(null);
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting.map((row) => row.orderItemId).join(), activeRow?.orderItemId]);

  function submitResult({ parameters, resultText, comment }) {
    setSubmitting(true);
    dispatch({
      type: 'SUBMIT_LAB_TEST_RESULT',
      payload: {
        sampleApiId: activeRow.sample?.apiId,
        orderId: order.id,
        testName: activeRow.name,
        parameters,
        resultText,
        comment
      }
    });
    // The command runs asynchronously; a failure toast leaves the popup open so
    // the entry is not lost, and the effect above closes it on success.
    window.setTimeout(() => setSubmitting(false), 1500);
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Laboratory · Accepted"
          title="Accepted Samples"
          description="Samples with the bench, waiting for results. Find the patient and enter them."
        />
        <Card
          title={`${queue.length} patient${queue.length === 1 ? '' : 's'} waiting for results`}
          actions={(
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
              <input
                className={`${inputClass} pl-9`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patient name or Hospital ID..."
                aria-label="Search patient name or Hospital ID"
              />
            </div>
          )}
        >
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <TestTube className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="mt-2 font-bold text-slate-900">{queue.length ? 'No patient matches your search.' : 'Nothing waiting for results.'}</p>
              <p className="mt-1 text-sm text-slate-500">
                {queue.length ? 'Clear the search to see everything waiting.' : 'Accept a sample in Incoming Labs and it appears here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <th className="py-2 pr-3">Patient</th>
                    <th className="py-2 pr-3">Accepted Labs</th>
                    <th className="py-2 pr-3">Time Requested</th>
                    <th className="py-2 pr-3">Requested By</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((candidate) => (
                    <tr key={candidate.id} className="border-b border-slate-100 align-top last:border-b-0">
                      <td className="py-3 pr-3">
                        <p className="font-bold text-slate-900">{candidate.patient?.fullName || 'Unknown patient'}</p>
                        <p className="text-xs font-semibold text-slate-500">{candidate.patient?.id || '—'}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {awaitingResult(candidate, 'Laboratory').map((row) => (
                            <span
                              key={row.orderItemId}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${row.returnedReason ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}
                            >
                              {row.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{candidate.createdAt ? formatDateTime(candidate.createdAt) : '—'}</td>
                      <td className="py-3 pr-3 text-slate-600">{requestedBy(candidate)}</td>
                      <td className="py-3"><Button size="sm" onClick={() => openOrder(candidate.id)}>Enter Results</Button></td>
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

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Laboratory · Accepted"
        title={`Enter results — ${order.patient?.fullName || 'patient'}`}
        description="Click Enter Results on a test, type the result and comment, then Submit. Each test is sent on its own."
        actions={<Button variant="secondary" onClick={backToList}><ArrowLeft className="h-4 w-4" /> Back</Button>}
      />

      <Card title={`${waiting.length} test${waiting.length === 1 ? '' : 's'} waiting`} subtitle={`${order.patient?.id || '—'} · ${order.id}`}>
        {waiting.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="font-bold text-slate-900">Every accepted test for this patient has a result.</p>
            <div className="mt-3"><Button onClick={backToList}>Back to Accepted Samples</Button></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="py-2 pr-3">Prescribed test</th>
                  <th className="py-2 pr-3">Patient</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Payment status</th>
                  <th className="py-2 pr-3">Requested by</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {waiting.map((row) => (
                  <tr key={row.orderItemId} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900">{row.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{row.sample?.id || '—'}</p>
                      {row.returnedReason && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Returned for correction</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-slate-900">{order.patient?.fullName}</p>
                      <p className="text-xs font-semibold text-slate-500">{order.patient?.id}</p>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{row.price === null ? '—' : money(row.price)}</td>
                    <td className="py-3 pr-3"><StatusBadge status={paymentStateFor(order, row)} /></td>
                    <td className="py-3 pr-3 text-slate-600">{requestedBy(order)}</td>
                    <td className="py-3"><Button size="sm" onClick={() => setActiveRow(row)}>Enter Result</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ResultEntryModal
        open={Boolean(activeRow)}
        onClose={() => setActiveRow(null)}
        onSubmit={submitResult}
        order={order}
        row={activeRow}
        enteredBy={enteredBy}
        facilityName={facilityName}
        submitting={submitting}
      />
    </div>
  );
}
