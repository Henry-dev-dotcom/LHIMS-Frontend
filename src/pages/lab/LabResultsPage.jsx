import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eraser, FileDown, FileText, GitCompareArrows, History, PenLine, QrCode, Search, Send, UploadCloud } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { getLabOrders } from '../../utils/orderViews';
import { getPatientPortalUrl, getQrCodeUrl, getReportVerificationUrl, openLabResultPdfWindow } from '../../utils/reporting';

function resultTestNames(result, order) {
  const namesFromParameters = Array.from(new Set((result?.parameters || []).map((parameter) => parameter.testName).filter(Boolean)));
  if (namesFromParameters.length) return namesFromParameters;
  return (order?.items || []).map((item) => item.name).filter(Boolean);
}

function matchesResult(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.result?.id, row.result?.orderId, row.order?.patient?.fullName, row.order?.patient?.id, row.order?.doctor?.name, row.order?.hospital?.name, resultTestNames(row.result, row.order).join(', '), row.result?.status]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function snapshotParameters(snapshot) {
  if (Array.isArray(snapshot)) return snapshot;
  return snapshot?.parameters || [];
}

function VersionTimelineModal({ open, result, onClose, onCompare }) {
  const versions = [...(result?.versionHistory || [])].sort((a, b) => (b.version || 0) - (a.version || 0));
  return (
    <Modal
      open={open}
      title="Version timeline"
      description="Every correction to this laboratory result is versioned with who changed it, why, and the integrity hash before and after."
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {versions.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No corrections yet — this is the original signed version.</p>
      ) : (
        <ol className="space-y-3">
          {versions.map((amendment) => (
            <li key={amendment.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-clinical-50 text-xs font-bold text-clinical-700">v{amendment.versionAfter || amendment.version}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{amendment.reason}</p>
                    <p className="text-xs text-slate-500">{amendment.changedBy} · {formatDateTime(amendment.changedAt)}</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onCompare(amendment)}><GitCompareArrows className="h-4 w-4" /> Compare</Button>
              </div>
              <div className="mt-3 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-2">
                <p className="truncate rounded-xl bg-slate-50 px-3 py-2 font-mono">Before: {amendment.previousHash || '—'}</p>
                <p className="truncate rounded-xl bg-slate-50 px-3 py-2 font-mono">After: {amendment.updatedHash || '—'}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function CompareChangesModal({ amendment, onClose }) {
  const previous = snapshotParameters(amendment?.previousValues?.length ? amendment.previousValues : amendment?.previousSnapshot);
  const updated = snapshotParameters(amendment?.updatedValues?.length ? amendment.updatedValues : amendment?.updatedSnapshot);
  const names = Array.from(new Set([...previous, ...updated].map((parameter) => `${parameter.testName || ''}·${parameter.name || ''}`)));
  return (
    <Modal
      open={Boolean(amendment)}
      title={`Compare changes · v${amendment?.versionBefore || '—'} → v${amendment?.versionAfter || '—'}`}
      description={amendment?.reason}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-2">
        {names.map((key) => {
          const [testName, name] = key.split('·');
          const before = previous.find((parameter) => (parameter.testName || '') === testName && (parameter.name || '') === name);
          const after = updated.find((parameter) => (parameter.testName || '') === testName && (parameter.name || '') === name);
          const changed = String(before?.value ?? '') !== String(after?.value ?? '');
          return (
            <div key={key} className={`grid gap-2 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1.2fr)_1fr_1fr] ${changed ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-slate-50'}`}>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-500">{testName || 'Laboratory'}</p>
                <p className="truncate text-sm font-bold text-slate-900">{name}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Before</p>
                <p className="text-sm font-semibold text-slate-700">{before ? `${before.value} ${before.unit || ''}` : '—'} {before?.flag && <StatusBadge status={before.flag} />}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">After</p>
                <p className={`text-sm font-semibold ${changed ? 'text-amber-800' : 'text-slate-700'}`}>{after ? `${after.value} ${after.unit || ''}` : '—'} {after?.flag && <StatusBadge status={after.flag} />}</p>
              </div>
            </div>
          );
        })}
        {names.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No parameter snapshots stored for this amendment.</p>}
      </div>
    </Modal>
  );
}

function SignatureModal({ open, result, onClose, onSign, defaultName }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [signedBy, setSignedBy] = useState(defaultName || '');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setSignedBy(defaultName || '');
    setNote('');
    setHasInk(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.lineWidth = 2.2;
      context.lineCap = 'round';
      context.strokeStyle = '#0f172a';
    }
  }, [open, defaultName]);

  function pointerPosition(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  }

  function startDraw(event) {
    drawingRef.current = true;
    const { x, y } = pointerPosition(event);
    const context = canvasRef.current.getContext('2d');
    context.beginPath();
    context.moveTo(x, y);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function draw(event) {
    if (!drawingRef.current) return;
    const { x, y } = pointerPosition(event);
    const context = canvasRef.current.getContext('2d');
    context.lineTo(x, y);
    context.stroke();
    setHasInk(true);
  }

  function endDraw() {
    drawingRef.current = false;
  }

  function clearPad() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  return (
    <Modal
      open={open}
      title={result?.signatureStatus === 'Needs re-sign after correction' ? 'Re-sign corrected result' : 'Sign laboratory result'}
      description="Draw the supervisor signature below. Signing finalises the report, regenerates the integrity hash and secure verification links, and notifies the clinician."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="success" disabled={!hasInk || !signedBy.trim()} onClick={() => onSign({ signedBy: signedBy.trim(), note: note.trim(), signatureDataUrl: canvasRef.current?.toDataURL('image/png') })}>
            <PenLine className="h-4 w-4" /> Sign & Finalise
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Signed by" required>
          <input className={inputClass} value={signedBy} onChange={(event) => setSignedBy(event.target.value)} placeholder="Supervisor full name" />
        </FormField>
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">Signature pad</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <canvas
              ref={canvasRef}
              width={640}
              height={180}
              className="h-40 w-full touch-none rounded-xl bg-white shadow-sm"
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">Draw with mouse or touch.</p>
              <Button variant="subtle" size="sm" onClick={clearPad}><Eraser className="h-4 w-4" /> Clear</Button>
            </div>
          </div>
        </div>
        <FormField label="Sign-off note (optional)">
          <textarea className={inputClass} rows="2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Verified against analyzer output" />
        </FormField>
      </div>
    </Modal>
  );
}

function LabResultCard({ row, onOpen }) {
  const abnormal = (row.result?.parameters || []).some((parameter) => ['High', 'Low', 'Critical'].includes(parameter.flag));
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-clinical-200 hover:bg-slate-50/70">
      <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.9fr)_minmax(320px,1.2fr)_minmax(260px,0.9fr)]">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{row.order?.patient?.fullName || 'Unknown patient'}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-500">{row.order?.patient?.id} · {row.result?.orderId}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status="Sent to Clinician" />
            {abnormal && <StatusBadge status="Abnormal" />}
            {row.result?.signatureStatus === 'Needs re-sign after correction' && <StatusBadge status="Needs re-sign" />}
            {(row.result?.versionHistory || []).length > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">v{(row.result.versionHistory[row.result.versionHistory.length - 1]?.versionAfter) || row.result.versionHistory.length + 1}</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Lab tests</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {resultTestNames(row.result, row.order).map((name) => (
              <span key={`${row.result?.id}-${name}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">{name}</span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician / Hospital</p>
            <p className="mt-1 truncate font-bold text-slate-900">{row.order?.doctor?.name}</p>
            <p className="truncate text-sm text-slate-500">{row.order?.hospital?.name}</p>
          </div>
          <p className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">Sent {formatDateTime(row.result?.signedAt || row.result?.approvedAt || row.result?.updatedAt)}</p>
          <Button onClick={() => onOpen(row)} className="w-full justify-center"><FileText className="h-4 w-4" /> View Stored Result</Button>
        </div>
      </div>
    </article>
  );
}

export function LabResultsPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const labOrders = useMemo(() => getLabOrders(data), [data]);
  const [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState('list');
  const [activeResultId, setActiveResultId] = useState('');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [compareAmendment, setCompareAmendment] = useState(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionValues, setCorrectionValues] = useState([]);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionReport, setCorrectionReport] = useState('');

  const rows = useMemo(() => (data.results || [])
    .filter((result) => result.department === 'Laboratory' && result.status === 'Final / Released')
    .map((result) => ({ result, order: labOrders.find((order) => order.id === result.orderId) }))
    .sort((a, b) => new Date(b.result.signedAt || b.result.approvedAt || b.result.updatedAt || 0) - new Date(a.result.signedAt || a.result.approvedAt || a.result.updatedAt || 0)), [data, labOrders]);

  const filteredRows = rows.filter((row) => matchesResult(row, query));
  const activeRow = rows.find((row) => row.result.id === activeResultId) || null;
  const abnormalCount = rows.filter((row) => (row.result.parameters || []).some((parameter) => ['High', 'Low', 'Critical'].includes(parameter.flag))).length;
  const fileCount = rows.reduce((total, row) => total + (row.result.files?.length || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = rows.filter((row) => String(row.result.signedAt || row.result.approvedAt || row.result.updatedAt || '').startsWith(today)).length;

  const openResult = (row) => {
    setActiveResultId(row.result.id);
    setWorkspace('detail');
    setCorrectionOpen(false);
  };

  function beginCorrection() {
    if (!activeRow) return;
    setCorrectionValues((activeRow.result.parameters || []).map((parameter) => ({ ...parameter })));
    setCorrectionReason('');
    setCorrectionReport(activeRow.result.reportText || '');
    setCorrectionOpen(true);
  }

  function submitCorrection(event) {
    event.preventDefault();
    if (!activeRow || !correctionReason.trim()) return;
    dispatch({
      type: 'UPDATE_LAB_RESULT_ARCHIVE',
      resultId: activeRow.result.id,
      payload: {
        parameters: correctionValues,
        reportText: correctionReport,
        reason: correctionReason.trim()
      }
    });
    setCorrectionOpen(false);
  }

  function signActiveResult(payload) {
    if (!activeRow) return;
    dispatch({ type: 'SIGN_LAB_RESULT_WITH_SIGNATURE', resultId: activeRow.result.id, payload });
    setSignatureOpen(false);
  }

  const verificationUrl = activeRow ? getReportVerificationUrl(activeRow.result) : '';
  const portalUrl = activeRow ? getPatientPortalUrl(activeRow.result) : '';

  return (
    <div className="getlabs-page space-y-6">
      <PageHeader
        eyebrow="Laboratory · Sent Reports"
        title="Results"
        description="All laboratory results pushed to clinicians are stored here for review, audit reference, versioned corrections and future retrieval."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Stored Results" value={rows.length} icon={FileText} tone="blue" />
        <MetricCard label="Sent Today" value={sentToday} icon={Send} tone="green" />
        <MetricCard label="Abnormal Flags" value={abnormalCount} icon={CheckCircle2} tone="red" />
        <MetricCard label="Attachments" value={fileCount} icon={UploadCloud} tone="purple" />
      </div>

      {workspace === 'list' && (
        <Card title="Sent laboratory results" subtitle="Search all reports that have already been pushed directly to clinicians.">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, order ID, clinician, hospital, or test..." />
            </div>
            <div className="space-y-3">
              {filteredRows.length ? filteredRows.map((row) => (
                <LabResultCard key={row.result.id} row={row} onOpen={openResult} />
              )) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="font-bold text-slate-900">No sent laboratory results found.</p>
                  <p className="mt-2 text-sm text-slate-500">Completed results will appear here after they are pushed from Accepted Samples.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {workspace === 'detail' && (
        <Card title="Laboratory result archive" subtitle="This report has already been pushed to the clinician. Corrections are versioned, hashed and require re-signing.">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Button variant="secondary" onClick={() => setWorkspace('list')}><ArrowLeft className="h-4 w-4" /> Back to Results</Button>
              {activeRow && (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="Sent to Clinician" />
                  <StatusBadge status={activeRow.result.signatureStatus || 'Signed'} />
                </div>
              )}
            </div>

            {!activeRow ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-900">No stored result selected.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => openLabResultPdfWindow({ data, result: activeRow.result })}><FileDown className="h-4 w-4" /> Print / PDF</Button>
                  <Button variant="secondary" onClick={() => setTimelineOpen(true)}><History className="h-4 w-4" /> Version Timeline{(activeRow.result.versionHistory || []).length ? ` (${activeRow.result.versionHistory.length})` : ''}</Button>
                  <Button variant="secondary" onClick={beginCorrection}><PenLine className="h-4 w-4" /> Correct Result</Button>
                  {activeRow.result.signatureStatus !== 'Signed' && (
                    <Button variant="success" onClick={() => setSignatureOpen(true)}><PenLine className="h-4 w-4" /> {activeRow.result.signatureStatus === 'Needs re-sign after correction' ? 'Re-sign Result' : 'Sign Result'}</Button>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="mt-1 font-bold text-slate-900">{activeRow.order?.patient?.fullName}</p><p className="text-sm text-slate-500">{activeRow.order?.patient?.id}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Order / Result</p><p className="mt-1 font-bold text-slate-900">{activeRow.result.orderId}</p><p className="text-sm text-slate-500">{activeRow.result.id}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician</p><p className="mt-1 font-bold text-slate-900">{activeRow.order?.doctor?.name}</p><p className="text-sm text-slate-500">{activeRow.order?.hospital?.name}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Sent</p><p className="mt-1 font-bold text-slate-900">{formatDateTime(activeRow.result.signedAt || activeRow.result.approvedAt || activeRow.result.updatedAt)}</p><p className="text-sm text-slate-500">{activeRow.result.signedBy || activeRow.result.approvedBy}</p></div>
                </div>

                {correctionOpen && (
                  <form onSubmit={submitCorrection} className="rounded-3xl border border-amber-200 bg-amber-50/50 p-4">
                    <p className="text-sm font-bold text-amber-900">Correct archived result</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">Every change is stored as a new version with before/after snapshots. A signed result will require re-signing.</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {correctionValues.map((parameter, index) => (
                        <FormField key={`${parameter.testId}-${parameter.name}-${index}`} label={`${parameter.testName ? `${parameter.testName} · ` : ''}${parameter.name}${parameter.unit ? ` (${parameter.unit})` : ''}`}>
                          <input
                            className={inputClass}
                            value={parameter.value}
                            onChange={(event) => setCorrectionValues((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}
                          />
                        </FormField>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <FormField label="Report summary">
                        <textarea className={inputClass} rows="3" value={correctionReport} onChange={(event) => setCorrectionReport(event.target.value)} />
                      </FormField>
                      <FormField label="Reason for correction" required>
                        <textarea className={inputClass} rows="3" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="e.g. Transcription error in potassium value" />
                      </FormField>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="submit" disabled={!correctionReason.trim()}>Save Corrected Version</Button>
                      <Button type="button" variant="subtle" onClick={() => setCorrectionOpen(false)}>Cancel</Button>
                    </div>
                  </form>
                )}

                <div className="rounded-3xl border border-slate-200 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Result parameters</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(activeRow.result.parameters || []).map((parameter, index) => (
                      <div key={`${parameter.testId}-${parameter.name}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">{parameter.testName}</p>
                        <p className="mt-1 font-bold text-slate-900">{parameter.name}: {parameter.value} {parameter.unit}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {parameter.referenceRange && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">Ref: {parameter.referenceRange}</span>}
                          <StatusBadge status={parameter.flag || 'Normal'} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Report summary</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activeRow.result.reportText || 'No report summary provided.'}</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Attachments</p>
                    <div className="mt-3 space-y-2">
                      {(activeRow.result.files || []).length ? activeRow.result.files.map((file) => (
                        <div key={file.id || file.name} className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">
                          <UploadCloud className="mt-0.5 h-4 w-4 shrink-0 text-clinical-600" />
                          <div className="min-w-0">
                            <p className="truncate">{file.name || file.fileName}</p>
                            {file.testName && <p className="mt-0.5 text-xs font-semibold text-slate-500">Attached to {file.testName}</p>}
                          </div>
                        </div>
                      )) : <p className="text-sm text-slate-500">No imported files attached.</p>}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Audit details</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p><span className="font-bold text-slate-900">Hash:</span> <span className="break-all font-mono text-xs">{activeRow.result.reportHash || 'Not available'}</span></p>
                      <p><span className="font-bold text-slate-900">Secure ID:</span> {activeRow.result.secureId || 'Not available'}</p>
                      <p><span className="font-bold text-slate-900">Signature:</span> {activeRow.result.signatureStatus || 'Signed'}</p>
                      <p><span className="font-bold text-slate-900">Versions:</span> {(activeRow.result.versionHistory || []).length + 1}</p>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-4 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"><QrCode className="mr-1 inline h-3.5 w-3.5" /> Secure verification</p>
                    <img src={getQrCodeUrl(verificationUrl)} alt="QR code linking to the secure report verification page" className="mx-auto mt-3 h-32 w-32 rounded-xl border border-slate-100" />
                    <p className="mt-2 break-all text-[11px] text-slate-500">{verificationUrl}</p>
                    <a className="mt-2 inline-block text-xs font-semibold text-clinical-700 underline" href={portalUrl}>Patient portal link</a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <VersionTimelineModal
        open={timelineOpen}
        result={activeRow?.result}
        onClose={() => setTimelineOpen(false)}
        onCompare={(amendment) => { setTimelineOpen(false); setCompareAmendment(amendment); }}
      />
      <CompareChangesModal amendment={compareAmendment} onClose={() => setCompareAmendment(null)} />
      <SignatureModal
        open={signatureOpen}
        result={activeRow?.result}
        defaultName={state.auth?.userName || ''}
        onClose={() => setSignatureOpen(false)}
        onSign={signActiveResult}
      />
    </div>
  );
}
