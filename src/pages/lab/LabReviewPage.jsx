import { useMemo, useState } from 'react';
import { FileText, ShieldCheck, Search, Eye, Printer } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { getLabOrders } from '../../utils/orderViews';
import { formatDateTime } from '../../utils/formatters';


function formatFileSize(size = 0) {
  const value = Number(size || 0);
  if (!value) return '0 KB';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function openResultAttachment(file) {
  if (!file?.dataUrl && !file?.url) return;
  const win = window.open(file.dataUrl || file.url, '_blank', 'noopener,noreferrer');
  if (!win) {
    const link = document.createElement('a');
    link.href = file.dataUrl || file.url;
    link.download = file.name || file.fileName || 'lab-result-document';
    link.click();
  }
}

function AttachmentReviewBlock({ files = [] }) {
  if (!files.length) return null;
  return (
    <div className="rounded-2xl border border-clinical-100 bg-clinical-50/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-clinical-700">Imported result documents</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {files.map((file) => (
          <div key={file.id || file.name} className="rounded-2xl bg-white p-3">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-5 w-5 shrink-0 text-clinical-700" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-slate-900">{file.name || file.fileName || 'Imported result document'}</p>
                <p className="text-xs font-semibold text-slate-500">{file.testName || 'Lab result'} · {formatFileSize(file.size || file.fileSize)}</p>
              </div>
              {(file.dataUrl || file.url) && <Button size="sm" variant="secondary" onClick={() => openResultAttachment(file)}>Open</Button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPatientSummary(data, result) {
  const order = (data.orders || []).find((item) => item.id === result.orderId);
  const patient = (data.patients || []).find((item) => item.id === order?.patientId);
  const doctor = (data.doctors || []).find((item) => item.id === order?.doctorId);
  return { order, patient, doctor };
}

function ResultPreviewModal({ result, data, onClose, dispatch }) {
  const [approverNote, setApproverNote] = useState('');
  if (!result) return null;
  const { order, patient, doctor } = getPatientSummary(data, result);
  const signOff = () => {
    dispatch({ type: 'APPROVE_DEPARTMENT_RESULT', payload: { orderId: result.orderId, department: 'Laboratory', approverNote } });
    onClose();
  };
  const printPreview = () => {
    const win = window.open('', '_blank', 'width=860,height=700');
    if (!win) return;
    win.document.write(`<html><head><title>Lab Review ${result.orderId}</title></head><body style="font-family:Arial,sans-serif;padding:28px;"><h1>Laboratory Review</h1><p><strong>Patient:</strong> ${patient?.fullName || ''}</p><p><strong>Order:</strong> ${result.orderId}</p><p><strong>Doctor:</strong> ${doctor?.name || ''}</p><table border="1" cellspacing="0" cellpadding="8"><thead><tr><th>Test</th><th>Parameter</th><th>Value</th><th>Unit</th><th>Reference Range</th><th>Flag</th></tr></thead><tbody>${(result.parameters || []).map((p) => `<tr><td>${p.testName || ''}</td><td>${p.name}</td><td>${p.value}</td><td>${p.unit || ''}</td><td>${p.referenceRange || ''}</td><td>${p.flag || ''}</td></tr>`).join('')}</tbody></table></body></html>`);
    win.document.close();
    // From here rather than from a <script> in the popup: inline script is what a
    // strict Content-Security-Policy refuses.
    win.print();
  };
  return (
    <Modal open={Boolean(result)} onClose={onClose} title={`Review Lab Result · ${result.orderId}`} description="Senior review/sign-off before final release to the doctor and reception.">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Patient</p><p className="font-bold text-slate-900">{patient?.fullName}</p><p className="text-xs text-slate-500">{patient?.id}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Doctor</p><p className="font-bold text-slate-900">{doctor?.name || '—'}</p><p className="text-xs text-slate-500">{order?.urgency}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Status</p><StatusBadge status={result.status} /><p className="mt-1 text-xs text-slate-500">{formatDateTime(result.updatedAt)}</p></div>
        </div>
        <DataTable
          dense
          columns={[
            { key: 'testName', label: 'Test' },
            { key: 'name', label: 'Parameter' },
            { key: 'value', label: 'Value' },
            { key: 'unit', label: 'Unit' },
            { key: 'referenceRange', label: 'Reference Range' },
            { key: 'flag', label: 'Flag', render: (row) => <StatusBadge status={row.flag || 'No Range'} /> }
          ]}
          rows={result.parameters || []}
          emptyMessage="No parameters entered."
        />
        <AttachmentReviewBlock files={result.files || []} />
        {result.amendments?.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Amendment history exists for this result. Review previous values before sign-off.</div>}
        <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Approver note</label>
        <textarea className={`${inputClass} min-h-24`} value={approverNote} onChange={(event) => setApproverNote(event.target.value)} placeholder="Optional senior reviewer/pathologist note." />
        <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={printPreview}><Printer className="h-4 w-4" /> Print Review Copy</Button><Button variant="secondary" onClick={onClose}>Close</Button><Button disabled={result.status === 'Final / Released'} onClick={signOff}><ShieldCheck className="h-4 w-4" /> Sign Off & Release</Button></div>
      </div>
    </Modal>
  );
}

export function LabReviewPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Pending Review');
  const [activeResultId, setActiveResultId] = useState('');
  const labOrders = useMemo(() => getLabOrders(data), [data]);
  const rows = (data.results || [])
    .filter((result) => result.department === 'Laboratory')
    .map((result) => {
      const { order, patient, doctor } = getPatientSummary(data, result);
      return { ...result, order, patient, doctor };
    })
    .filter((row) => row.order)
    .filter((row) => !status || row.status === status)
    .filter((row) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [row.orderId, row.patient?.fullName, row.patient?.id, row.doctor?.name, row.parameters?.map((p) => `${p.testName} ${p.name}`).join(' ')].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const activeResult = (data.results || []).find((result) => result.id === activeResultId);
  const pending = (data.results || []).filter((result) => result.department === 'Laboratory' && result.status === 'Pending Review').length;
  const drafts = (data.results || []).filter((result) => result.department === 'Laboratory' && result.status === 'Draft').length;
  const released = (data.results || []).filter((result) => result.department === 'Laboratory' && result.status === 'Final / Released').length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Laboratory · Review & Sign-off" title="Lab Review Queue" description="Review completed structured lab results before final release to doctors, reception and results delivery." />
      <div className="grid gap-4 md:grid-cols-3"><Card title="Drafts" subtitle={String(drafts)} /><Card title="Pending Review" subtitle={String(pending)} /><Card title="Released" subtitle={String(released)} /></div>
      <Card title="Review queue" subtitle="Senior reviewer/pathologist sign-off queue for lab results.">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input aria-label="Search patient, order, doctor, test or parameter" className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, order, doctor, test or parameter..." /></div>
          <select aria-label="Filter by lab result state" className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All lab result states</option><option>Draft</option><option>In Progress</option><option>Pending Review</option><option>Final / Released</option></select>
        </div>
        <DataTable
          columns={[
            { key: 'orderId', label: 'Order ID', render: (row) => <span className="font-bold text-slate-900">{row.orderId}</span> },
            { key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName}</p><p className="text-xs text-slate-500">{row.patient?.id}</p></div> },
            { key: 'tests', label: 'Tests', render: (row) => [...new Set((row.parameters || []).map((p) => p.testName))].join(', ') || '—' },
            { key: 'flags', label: 'Flags', render: (row) => <div className="flex flex-wrap gap-1">{[...new Set((row.parameters || []).map((p) => p.flag))].map((flag) => <StatusBadge key={flag} status={flag} />)}</div> },
            { key: 'files', label: 'Files', render: (row) => row.files?.length ? <span className="font-bold text-clinical-700">{row.files.length} file(s)</span> : '—' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'updatedAt', label: 'Updated', render: (row) => formatDateTime(row.updatedAt) },
            { key: 'action', label: 'Action', render: (row) => <Button onClick={() => setActiveResultId(row.id)}><Eye className="h-4 w-4" /> Review</Button> }
          ]}
          rows={rows}
          emptyMessage="No lab results match this review filter."
        />
      </Card>
      <ResultPreviewModal result={activeResult} data={data} dispatch={dispatch} onClose={() => setActiveResultId('')} />
    </div>
  );
}
