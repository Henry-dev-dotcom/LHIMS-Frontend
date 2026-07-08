import { useMemo, useState } from 'react';
import { FileImage, Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { describeOrderItems, getScanCatalogItems, getScanOrders } from '../../utils/orderViews';
import { formatDateTime } from '../../utils/formatters';

export function ScanReviewPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [approverNote, setApproverNote] = useState('');
  const scanOrders = useMemo(() => getScanOrders(data), [data]);
  const rows = (data.results || [])
    .filter((result) => result.department === 'Imaging' && result.status === 'Pending Review')
    .map((result) => {
      const order = scanOrders.find((item) => item.id === result.orderId);
      return { ...result, order, patient: order?.patient, doctor: order?.doctor, hospital: order?.hospital };
    })
    .filter((row) => row.order)
    .filter((row) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [row.orderId, row.patient?.fullName, row.doctor?.name, row.hospital?.name, row.reportText, describeOrderItems(row.order?.items)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  const selected = rows.find((row) => row.orderId === selectedOrderId) || rows[0];
  const scans = selected?.order ? getScanCatalogItems(selected.order, data.catalog || []) : [];
  const dicomFiles = (selected?.files || []).filter((file) => file.isDicom || /\.(dcm|dicom)$/i.test(file.name || ''));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Imaging · Review & Sign-off" title="Scan Review & Sign-off" description="Dedicated radiologist review queue for submitted imaging reports before final release to doctors and reception." />
      <div className="grid gap-4 md:grid-cols-3">
        <Summary label="Pending Review" value={rows.length} />
        <Summary label="DICOM Attachments" value={rows.reduce((sum, row) => sum + (row.files || []).filter((file) => file.isDicom || /\.(dcm|dicom)$/i.test(file.name || '')).length, 0)} />
        <Summary label="Image/PDF Files" value={rows.reduce((sum, row) => sum + (row.files || []).length, 0)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Card title="Pending imaging reports" subtitle="Search reports waiting for radiologist sign-off.">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, order, report text..." />
          </div>
          <DataTable
            columns={[
              { key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName}</p><p className="text-xs text-slate-500">{row.patient?.id}</p></div> },
              { key: 'orderId', label: 'Order', render: (row) => <span className="font-bold text-slate-900">{row.orderId}</span> },
              { key: 'scan', label: 'Scans', render: (row) => <span className="text-sm font-semibold text-slate-700">{describeOrderItems(row.order?.items)}</span> },
              { key: 'files', label: 'Files', render: (row) => <span className="font-bold">{(row.files || []).length}</span> },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'actions', label: 'Action', render: (row) => <Button onClick={() => setSelectedOrderId(row.orderId)}>Review</Button> }
            ]}
            rows={rows}
            emptyMessage="No imaging reports are pending review."
          />
        </Card>
        <Card title="Radiologist review panel" subtitle="Review scans, attached files, report text and then sign off.">
          {!selected ? <p className="text-sm text-slate-500">Select a pending imaging report.</p> : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Patient" value={`${selected.patient?.fullName || '—'} · ${selected.patient?.id || ''}`} />
                <Info label="Order" value={`${selected.orderId} · ${formatDateTime(selected.createdAt || selected.order?.updatedAt)}`} />
                <Info label="Doctor" value={selected.doctor?.name} />
                <Info label="Hospital" value={selected.hospital?.name} />
              </div>
              <div className="space-y-2">{scans.map((scan) => <div key={scan.id} className="rounded-2xl border border-slate-200 p-3"><FileImage className="mr-2 inline h-4 w-4 text-purple-600" /><span className="font-bold text-slate-900">{scan.name}</span><span className="ml-2 text-sm text-slate-500">{scan.modality}</span></div>)}</div>
              <div className="rounded-2xl bg-slate-50 p-3 whitespace-pre-line text-sm font-semibold text-slate-700">{selected.reportText}</div>
              <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-purple-700">Attachments / DICOM metadata</p>
                {(selected.files || []).length === 0 ? <p className="mt-2 text-sm font-semibold text-purple-700">No files attached.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.files.map((file) => <div key={file.name} className="rounded-xl bg-white p-3 text-xs font-bold text-slate-700">{file.name}<br /><span className="text-slate-500">{file.isDicom ? 'DICOM object · metadata captured' : file.type || 'Attachment'}</span></div>)}</div>}
                <p className="mt-2 text-xs font-semibold text-purple-700">DICOM files detected: {dicomFiles.length}</p>
              </div>
              <FormField label="Approver note"><textarea rows="3" className={inputClass} value={approverNote} onChange={(event) => setApproverNote(event.target.value)} placeholder="Radiologist approval note" /></FormField>
              <div className="flex justify-end"><Button onClick={() => dispatch({ type: 'APPROVE_DEPARTMENT_RESULT', payload: { orderId: selected.orderId, department: 'Imaging', approverNote } })}><ShieldCheck className="h-4 w-4" /> Sign off and release imaging result</Button></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Summary({ label, value }) {
  return <Card className="clinical-stat-card p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></Card>;
}
function Info({ label, value }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900">{value || '—'}</p></div>;
}
