import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileDown, FileText, History, QrCode, RotateCcw, Search, Send, UploadCloud } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { getScanOrders } from '../../utils/orderViews';
import { getPatientPortalUrl, getQrCodeUrl, getReportVerificationUrl, openReportPrintWindow } from '../../utils/reporting';
import { getReportForOrder } from '../doctor/doctorUtils';

function matchesResult(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.result?.id, row.result?.orderId, row.order?.patient?.fullName, row.order?.patient?.id, row.order?.doctor?.name, row.order?.hospital?.name, row.result?.impression, row.result?.status]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function VersionTimelineModal({ open, result, onClose }) {
  const history = result?.versionHistory || [];
  return (
    <Modal
      open={open}
      title="Reversal history"
      description="Every time this scan report was withdrawn after being sent, with who did it, when, and why."
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {history.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">This report has never been reversed since it was sent.</p>
      ) : (
        <ol className="space-y-3">
          {history.map((amendment) => (
            <li key={amendment.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <RotateCcw className="h-4 w-4 shrink-0 text-amber-700" />
                <p className="text-sm font-bold text-slate-900">{amendment.fromStatus || 'Sent'} → {amendment.toStatus || 'Draft'}</p>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-slate-700">{amendment.reason}</p>
              <p className="mt-1 text-xs text-slate-500">{amendment.changedBy || 'Scan unit'} · {formatDateTime(amendment.changedAt)}</p>
              {(amendment.findings || amendment.impression) && (
                <p className="mt-2 rounded-xl bg-white p-2 text-xs text-slate-600">{amendment.findings}{amendment.findings && amendment.impression ? ' — ' : ''}{amendment.impression}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function ReverseResultModal({ open, result, onClose, onConfirm, submitting }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      title="Reverse this report"
      description="This report was already sent to the clinician. Reversing it withdraws that report at once (any secure link stops working) and returns it to draft here in the scan unit so it can be corrected and sent again."
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={reason.trim().length < 10 || submitting} onClick={() => onConfirm(reason.trim())}>
            <RotateCcw className="h-4 w-4" /> {submitting ? 'Reversing…' : 'Reverse report'}
          </Button>
        </>
      )}
    >
      <FormField label="Why is this being reversed?" required help="At least 10 characters. This is recorded against the report and shown to reception and the ordering clinician.">
        <textarea className={inputClass} rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Wrong patient image attached to this report" autoFocus />
      </FormField>
      {result && (
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
          {result.orderId} · {result.order?.patient?.fullName || 'Patient'} — sent {formatDateTime(result.signedAt || result.approvedAt)}
        </p>
      )}
    </Modal>
  );
}

function ScanResultCard({ row, onOpen }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-clinical-200 hover:bg-slate-50/70">
      <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.9fr)_minmax(320px,1.2fr)_minmax(260px,0.9fr)]">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{row.order?.patient?.fullName || 'Unknown patient'}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-500">{row.order?.patient?.id} · {row.result?.orderId}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status="Sent to Clinician" />
            {row.result?.abnormal && <StatusBadge status="Abnormal" />}
            {(row.result?.versionHistory || []).length > 0 && <StatusBadge status="Previously reversed" />}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Scan / Impression</p>
          <p className="mt-2 line-clamp-3 text-sm text-slate-700">{row.result?.impression || row.result?.findings || 'No impression recorded.'}</p>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician / Hospital</p>
            <p className="mt-1 truncate font-bold text-slate-900">{row.order?.doctor?.name}</p>
            <p className="truncate text-sm text-slate-500">{row.order?.hospital?.name}</p>
          </div>
          <p className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">Sent {formatDateTime(row.result?.signedAt || row.result?.approvedAt || row.result?.updatedAt)}</p>
          <Button onClick={() => onOpen(row)} className="w-full justify-center"><FileText className="h-4 w-4" /> View Stored Report</Button>
        </div>
      </div>
    </article>
  );
}

export function ScanResultsPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const scanOrders = useMemo(() => getScanOrders(data), [data]);
  const [query, setQuery] = useState('');
  const [workspace, setWorkspace] = useState('list');
  const [activeResultId, setActiveResultId] = useState('');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reversing, setReversing] = useState(false);

  const rows = useMemo(() => (data.results || [])
    .filter((result) => result.department === 'Imaging' && result.status === 'Final / Released')
    .map((result) => ({ result, order: scanOrders.find((order) => order.id === result.orderId) }))
    .sort((a, b) => new Date(b.result.signedAt || b.result.approvedAt || b.result.updatedAt || 0) - new Date(a.result.signedAt || a.result.approvedAt || a.result.updatedAt || 0)), [data, scanOrders]);

  const filteredRows = rows.filter((row) => matchesResult(row, query));
  const activeRow = rows.find((row) => row.result.id === activeResultId) || null;
  const abnormalCount = rows.filter((row) => row.result.abnormal).length;
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = rows.filter((row) => String(row.result.signedAt || row.result.approvedAt || row.result.updatedAt || '').startsWith(today)).length;

  const openResult = (row) => {
    setActiveResultId(row.result.id);
    setWorkspace('detail');
  };

  function confirmReverse(reason) {
    if (!activeRow || reversing) return;
    setReversing(true);
    const orderId = activeRow.order?.id || activeRow.result.orderId;
    dispatch({ type: 'REVERSE_SCAN_RESULT', resultId: activeRow.result.id, payload: { reason } });
    setReverseOpen(false);
    // The report is no longer "Final / Released", so it leaves this list once the
    // refresh that command triggers lands; go back to it now rather than wait.
    setWorkspace('list');
    setActiveResultId('');
    window.setTimeout(() => setReversing(false), 1500);
    // Pulling a report back exists in order to correct it, so go where the
    // correction is written, with what was reported before already there.
    if (orderId) window.setTimeout(() => dispatch({ type: 'OPEN_ACCEPTED_SCAN', orderId }), 1600);
  }

  function printActive() {
    if (!activeRow) return;
    const report = getReportForOrder(data, activeRow.order?.id);
    openReportPrintWindow({ ...activeRow.order, results: [activeRow.result], resultReport: report });
  }

  const verificationUrl = activeRow ? getReportVerificationUrl(activeRow.result) : '';
  const portalUrl = activeRow ? getPatientPortalUrl(activeRow.result) : '';

  return (
    <div className="getlabs-page space-y-6">
      <PageHeader
        eyebrow="Imaging · Sent Reports"
        title="Results"
        description="All scan reports pushed to clinicians are stored here for review, audit reference, and reversal if a mistake needs correcting."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Stored Reports" value={rows.length} icon={FileText} tone="blue" />
        <MetricCard label="Sent Today" value={sentToday} icon={Send} tone="green" />
        <MetricCard label="Abnormal Flags" value={abnormalCount} icon={CheckCircle2} tone="red" />
      </div>

      {workspace === 'list' && (
        <Card title="Sent scan reports" subtitle="Search all reports that have already been pushed directly to clinicians.">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input aria-label="Search patient, order ID, clinician, hospital, or impression" className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, order ID, clinician, hospital, or impression..." />
            </div>
            <div className="space-y-3">
              {filteredRows.length ? filteredRows.map((row) => (
                <ScanResultCard key={row.result.id} row={row} onOpen={openResult} />
              )) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="font-bold text-slate-900">No sent scan reports found.</p>
                  <p className="mt-2 text-sm text-slate-500">Completed reports will appear here after they are signed off from Accepted Scans.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {workspace === 'detail' && (
        <Card title="Scan report archive" subtitle="This report has already been pushed to the clinician. A mistake can be reversed here, then corrected and re-sent from Accepted Scans.">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Button variant="secondary" onClick={() => setWorkspace('list')}><ArrowLeft className="h-4 w-4" /> Back to Results</Button>
              {activeRow && <StatusBadge status="Sent to Clinician" />}
            </div>

            {!activeRow ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-900">No stored report selected.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={printActive}><FileDown className="h-4 w-4" /> Print / PDF</Button>
                  <Button variant="secondary" onClick={() => setTimelineOpen(true)}><History className="h-4 w-4" /> Reversal History{(activeRow.result.versionHistory || []).length ? ` (${activeRow.result.versionHistory.length})` : ''}</Button>
                  <Button variant="danger" onClick={() => setReverseOpen(true)}><RotateCcw className="h-4 w-4" /> Reverse Report</Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="mt-1 font-bold text-slate-900">{activeRow.order?.patient?.fullName}</p><p className="text-sm text-slate-500">{activeRow.order?.patient?.id}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Order / Report</p><p className="mt-1 font-bold text-slate-900">{activeRow.result.orderId}</p><p className="text-sm text-slate-500">{activeRow.result.id}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician</p><p className="mt-1 font-bold text-slate-900">{activeRow.order?.doctor?.name}</p><p className="text-sm text-slate-500">{activeRow.order?.hospital?.name}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Sent</p><p className="mt-1 font-bold text-slate-900">{formatDateTime(activeRow.result.signedAt || activeRow.result.approvedAt || activeRow.result.updatedAt)}</p><p className="text-sm text-slate-500">{activeRow.result.signedBy || activeRow.result.approvedBy}</p></div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Findings</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activeRow.result.findings || 'No findings recorded.'}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Impression</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activeRow.result.impression || 'No impression recorded.'}</p>
                  </div>
                  {activeRow.result.comment && (
                    <div className="rounded-3xl border border-slate-200 p-4 md:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Comment</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activeRow.result.comment}</p>
                    </div>
                  )}
                  {activeRow.result.comparison && (
                    <div className="rounded-3xl border border-slate-200 p-4 md:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Comparison to prior scans</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activeRow.result.comparison}</p>
                    </div>
                  )}
                  {activeRow.result.recommendation && (
                    <div className="rounded-3xl border border-slate-200 p-4 md:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Recommendation</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activeRow.result.recommendation}</p>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Audit details</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p><span className="font-bold text-slate-900">Reversals:</span> {(activeRow.result.versionHistory || []).length}</p>
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

      <VersionTimelineModal open={timelineOpen} result={activeRow?.result} onClose={() => setTimelineOpen(false)} />
      <ReverseResultModal open={reverseOpen} result={activeRow ? { ...activeRow.result, order: activeRow.order } : null} onClose={() => setReverseOpen(false)} onConfirm={confirmReverse} submitting={reversing} />
    </div>
  );
}
