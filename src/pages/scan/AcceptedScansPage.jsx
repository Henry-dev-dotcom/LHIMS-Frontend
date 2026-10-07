import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Monitor, Printer, ScanLine, Search, Upload } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters';
import { getScanOrders } from '../../utils/orderViews';
import { acceptedQueue, awaitingResult, paymentStateFor, queueMatches, requestedBy } from '../../utils/diagnosticWorkflow';
import { escapeHtml, printDocument } from '../../utils/printDocument';

/*
  Accepted Scans - the second of the imaging unit's three tabs.

  Studies that have been taken in and still owe a report. One row per patient;
  opening one lists that patient's accepted studies, each with its own Enter
  Report button, because a chest film is read in a minute and a CT is not.

  Writing the report is one popup with one Submit: the report itself, a comment,
  and the images. There is no separate impression, comparison or recommendations
  box to fill in first - a radiographer writing a single paragraph about an
  ultrasound should not have to split it into three before it can be sent.
*/

/** DICOM files are large; base64 in a JSON body is what the upload route takes. */
const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function reportHtml({ order, row, reportText, comment, facilityName, reportedBy }) {
  return `
    <header>
      <div>
        <h1>${escapeHtml(facilityName)}</h1>
        <div class="sub">Imaging Report — ${escapeHtml(row.name)}</div>
      </div>
      <div class="meta">Order ${escapeHtml(order.id)}<br>${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
    </header>
    <dl>
      <div><dt>Patient:</dt><dd>${escapeHtml(order.patient?.fullName || '—')}</dd></div>
      <div><dt>Hospital ID:</dt><dd>${escapeHtml(order.patient?.id || '—')}</dd></div>
      <div><dt>Requested by:</dt><dd>${escapeHtml(requestedBy(order))}</dd></div>
      <div><dt>Modality:</dt><dd>${escapeHtml(row.item?.modality || '—')}</dd></div>
      <div><dt>Reported by:</dt><dd>${escapeHtml(reportedBy)}</dd></div>
      <div><dt>Study accepted:</dt><dd>${escapeHtml(row.sample?.acceptedAt ? formatDateTime(row.sample.acceptedAt) : '—')}</dd></div>
    </dl>
    <h1 style="font-size:14px;margin-top:18px">Report</h1>
    <pre>${escapeHtml(reportText)}</pre>
    ${comment ? `<h1 style="font-size:14px;margin-top:18px">Comment</h1><pre>${escapeHtml(comment)}</pre>` : ''}
    <footer>This is a preview of the report as entered. It is not valid until submitted.</footer>`;
}

function ReportEntryModal({ open, onClose, onSubmit, onViewImages, order, row, reportedBy, facilityName, submitting }) {
  const [reportText, setReportText] = useState('');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const draft = row?.draftResult || null;
    setReportText(draft?.reportText || '');
    setComment(draft?.comment || '');
    setFiles([]);
    setError('');
  }, [open, row?.orderItemId, row?.draftResult]);

  if (!row) return null;

  function chooseFiles(fileList) {
    const picked = Array.from(fileList || []);
    const tooBig = picked.filter((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (tooBig.length) {
      setError(`${tooBig.map((file) => file.name).join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} too large to attach here. Open the study in the DICOM Viewer from the disc instead.`);
      return;
    }
    setError('');
    setFiles(picked);
  }

  async function submit() {
    if (!reportText.trim()) {
      setError('Enter the report.');
      return;
    }
    try {
      // The upload route takes the bytes in the request body, so they are read
      // here rather than streamed.
      const payload = await Promise.all(files.map(async (file) => ({
        fileName: file.name,
        fileType: file.type || 'application/dicom',
        fileSize: file.size,
        dataUrl: await readAsDataUrl(file),
        isDicom: true
      })));
      onSubmit({ reportText, comment, files: payload });
    } catch (caught) {
      setError(caught.message || 'The images could not be read.');
    }
  }

  const alreadyAttached = row.sample?.dicomCount || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enter report — ${row.name}`}
      description={`${order.patient?.fullName || ''} (${order.patient?.id || ''}) · requested by ${requestedBy(order)}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            variant="secondary"
            onClick={() => printDocument(`Imaging report ${row.name}`, reportHtml({ order, row, reportText, comment, facilityName, reportedBy }))}
            disabled={!reportText.trim()}
          >
            <Printer className="h-4 w-4" /> Preview
          </Button>
          <Button onClick={submit} disabled={submitting || !reportText.trim()}>{submitting ? 'Submitting…' : 'Submit'}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        {row.returnedReason && (
          <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">Returned for correction: {row.returnedReason}</p>
              <p>The previous report is below. Correct it and submit again.</p>
            </div>
          </div>
        )}

        <FormField label="Report / findings">
          <textarea
            className={`${inputClass} min-h-[180px]`}
            value={reportText}
            onChange={(event) => setReportText(event.target.value)}
            placeholder="Type the imaging findings…"
          />
        </FormField>

        <FormField label="Comment">
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Optional comment for the clinician."
          />
        </FormField>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">DICOM images</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Attach images
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              aria-label="Attach DICOM images"
              onChange={(event) => chooseFiles(event.target.files)}
            />
            <span className="text-xs font-semibold text-slate-600">
              {files.length ? `${files.length} file(s) chosen` : 'Optional — the .dcm files from the modality'}
              {alreadyAttached ? ` · ${alreadyAttached} already attached` : ''}
            </span>
            {alreadyAttached > 0 && (
              <Button variant="ghost" size="sm" onClick={onViewImages}><Monitor className="h-4 w-4" /> View attached</Button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            A whole series is usually too large to attach. Those stay on the disc and open in the DICOM Viewer from there.
          </p>
        </div>

        {error && <p role="alert" className="text-sm font-semibold text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}

export function AcceptedScansPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const [activeRow, setActiveRow] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const orderId = state.ui.activeAcceptedScanOrderId;
  const order = useMemo(() => (orderId ? getScanOrders(data).find((candidate) => candidate.id === orderId) || null : null), [data, orderId]);
  const queue = useMemo(() => acceptedQueue(data, 'Imaging'), [data]);
  const visible = queue.filter((candidate) => queueMatches(candidate, query));

  const facilityName = state.auth?.facility?.name || 'CurataMed';
  const reportedBy = state.auth?.userName || 'Imaging';

  const openOrder = (id) => dispatch({ type: 'OPEN_ACCEPTED_SCAN', orderId: id });
  const backToList = () => dispatch({ type: 'OPEN_ACCEPTED_SCAN', orderId: '' });

  const waiting = order ? awaitingResult(order, 'Imaging') : [];
  useEffect(() => {
    if (!activeRow) return;
    if (!waiting.some((row) => row.orderItemId === activeRow.orderItemId)) {
      setActiveRow(null);
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting.map((row) => row.orderItemId).join(), activeRow?.orderItemId]);

  function submitReport({ reportText, comment, files }) {
    setSubmitting(true);
    dispatch({
      type: 'SUBMIT_SCAN_REPORT',
      payload: {
        orderItemId: activeRow.orderItemId,
        orderId: order.id,
        testName: activeRow.name,
        reportText,
        comment,
        files
      }
    });
    window.setTimeout(() => setSubmitting(false), 1500);
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Imaging · Accepted"
          title="Accepted Scans"
          description="Studies with the unit, waiting to be reported. Find the patient and write the report."
        />
        <Card
          title={`${queue.length} patient${queue.length === 1 ? '' : 's'} waiting for reports`}
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
              <ScanLine className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="mt-2 font-bold text-slate-900">{queue.length ? 'No patient matches your search.' : 'Nothing waiting to be reported.'}</p>
              <p className="mt-1 text-sm text-slate-500">
                {queue.length ? 'Clear the search to see everything waiting.' : 'Accept a study in Incoming Scans and it appears here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <th className="py-2 pr-3">Patient</th>
                    <th className="py-2 pr-3">Accepted Scans</th>
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
                          {awaitingResult(candidate, 'Imaging').map((row) => (
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
                      <td className="py-3"><Button size="sm" onClick={() => openOrder(candidate.id)}>Enter Reports</Button></td>
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
        eyebrow="Imaging · Accepted"
        title={`Enter reports — ${order.patient?.fullName || 'patient'}`}
        description="Click Enter Report on a study, write the report and comment, attach the images, then Submit."
        actions={<Button variant="secondary" onClick={backToList}><ArrowLeft className="h-4 w-4" /> Back</Button>}
      />

      <Card title={`${waiting.length} study${waiting.length === 1 ? '' : 's'} waiting`} subtitle={`${order.patient?.id || '—'} · ${order.id}`}>
        {waiting.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="font-bold text-slate-900">Every accepted study for this patient has a report.</p>
            <div className="mt-3"><Button onClick={backToList}>Back to Accepted Scans</Button></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="py-2 pr-3">Requested study</th>
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
                      <p className="text-xs font-semibold text-slate-500">{row.item?.modality || '—'}</p>
                      {row.returnedReason && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Returned for correction</span>
                      )}
                      {row.sample?.dicomCount > 0 && (
                        <span className="mt-1 block text-[11px] font-semibold text-clinical-700">{row.sample.dicomCount} image(s) attached</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-slate-900">{order.patient?.fullName}</p>
                      <p className="text-xs font-semibold text-slate-500">{order.patient?.id}</p>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{row.price === null ? '—' : money(row.price)}</td>
                    <td className="py-3 pr-3"><StatusBadge status={paymentStateFor(order, row)} /></td>
                    <td className="py-3 pr-3 text-slate-600">{requestedBy(order)}</td>
                    <td className="py-3"><Button size="sm" onClick={() => setActiveRow(row)}>Enter Report</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReportEntryModal
        open={Boolean(activeRow)}
        onClose={() => setActiveRow(null)}
        onSubmit={submitReport}
        onViewImages={() => dispatch({ type: 'OPEN_DICOM_VIEWER', acceptanceId: activeRow?.sample?.apiId })}
        order={order}
        row={activeRow}
        reportedBy={reportedBy}
        facilityName={facilityName}
        submitting={submitting}
      />
    </div>
  );
}
