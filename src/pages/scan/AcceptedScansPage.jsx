import { useMemo, useState } from 'react';
import { FileImage, Search, Save, Send } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { describeOrderItems, getPriorImaging, getScanCatalogItems, getScanOrders } from '../../utils/orderViews';
import { formatDateTime } from '../../utils/formatters';

function fileMeta(file) {
  const isDicom = Boolean(file.isDicom) || /\.(dcm|dicom)$/i.test(file.name || '');
  return {
    name: file.name,
    size: file.size,
    type: file.type || (isDicom ? 'application/dicom' : 'application/octet-stream'),
    isDicom,
    dicomStudyStatus: isDicom ? 'DICOM metadata captured for future PACS/DICOMweb' : ''
  };
}

function ReportModal({ open, onClose, order, data, dispatch }) {
  const existing = order?.result;
  const [files, setFiles] = useState(existing?.files || []);
  const [findings, setFindings] = useState(existing?.reportText?.split('Impression:')[0]?.replace('Findings:', '').trim() || '');
  const [impression, setImpression] = useState(existing?.reportText?.split('Impression:')[1]?.trim() || '');
  const [internalNotes, setInternalNotes] = useState(existing?.internalNotes || '');
  if (!order) return null;
  const acceptance = (data.scanBookings || []).find((booking) => booking.orderId === order.id && booking.status === 'Accepted');
  const equipment = acceptance ? `${acceptance.machine} / ${acceptance.room}` : '';
  const dicomFiles = files.filter((file) => file.isDicom || /\.(dcm|dicom)$/i.test(file.name || ''));
  const save = (status) => {
    dispatch({ type: 'SAVE_SCAN_REPORT', payload: { orderId: order.id, findings, impression, files, internalNotes, equipment, status } });
    if (status === 'Pending Review') onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Scan report · ${order.patient?.fullName}`} description="Save a draft first, then submit for radiologist review when findings and impression are complete.">
      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-50 p-3"><p className="font-bold text-slate-900">{order.id}</p><p className="text-sm text-slate-500">{describeOrderItems(order.items)} · {equipment || 'No equipment assigned'}</p></div>
        <FormField label="Image / DICOM upload"><input type="file" multiple accept=".dcm,.dicom,application/dicom,image/*,.pdf" className={inputClass} onChange={(event) => setFiles(Array.from(event.target.files || []).map(fileMeta))} help="Upload .dcm/.dicom, image or PDF files. File metadata is captured with the imaging record." /></FormField>
        {files.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{files.map((file) => <div key={file.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700"><div className="flex items-center justify-between gap-2"><span>{file.name}</span>{file.isDicom && <StatusBadge status="DICOM" />}</div><span className="font-semibold text-slate-500">{Math.ceil((file.size || 0) / 1024)} KB · {file.type || 'Unknown type'}</span>{file.isDicom && <p className="mt-1 text-[11px] font-semibold text-purple-700">Study/Series metadata captured for imaging records.</p>}</div>)}</div>}
        <div className="grid gap-3 rounded-2xl border border-purple-100 bg-purple-50 p-4 sm:grid-cols-3"><Info label="Attachments" value={files.length} /><Info label="DICOM files" value={dicomFiles.length} /><Info label="Report state" value={existing?.status || 'Not Entered'} /></div>
        <FormField label="Radiologist findings"><textarea rows="5" className={inputClass} value={findings} onChange={(event) => setFindings(event.target.value)} placeholder="Structured findings" /></FormField>
        <FormField label="Impression"><textarea rows="4" className={inputClass} value={impression} onChange={(event) => setImpression(event.target.value)} placeholder="Clinical impression" /></FormField>
        <FormField label="Internal technician notes"><textarea rows="3" className={inputClass} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Internal review notes not visible to doctor" /></FormField>
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end [&_button]:w-full sm:[&_button]:w-auto"><Button variant="secondary" onClick={onClose}>Close</Button><Button variant="secondary" onClick={() => save('Draft')}><Save className="h-4 w-4" /> Save Draft</Button><Button onClick={() => save('Pending Review')}><Send className="h-4 w-4" /> Submit for Review</Button></div>
      </div>
    </Modal>
  );
}

export function AcceptedScansPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const [activeOrderId, setActiveOrderId] = useState(state.ui.activeAcceptedScanOrderId || '');
  const [reportOrderId, setReportOrderId] = useState('');
  const scanOrders = useMemo(() => getScanOrders(data), [data]);
  const accepted = (data.scanBookings || []).filter((booking) => ['Accepted', 'Booked', 'In Use'].includes(booking.status)).map((booking) => {
    const order = scanOrders.find((item) => item.id === booking.orderId);
    const result = (data.results || []).find((item) => item.orderId === booking.orderId && item.department === 'Imaging');
    return { ...booking, order: order ? { ...order, result } : null, patient: order?.patient, doctor: order?.doctor, hospital: order?.hospital, result };
  }).filter((row) => row.order);
  const rows = accepted.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.id, row.orderId, row.patient?.fullName, row.patient?.id, row.doctor?.name, describeOrderItems(row.order?.items)].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
  });
  const activeOrder = scanOrders.find((order) => order.id === activeOrderId) || rows[0]?.order;
  const reportOrder = scanOrders.find((order) => order.id === reportOrderId);
  const activeResult = activeOrder ? (data.results || []).find((result) => result.orderId === activeOrder.id && result.department === 'Imaging') : null;
  const activeItems = activeOrder ? getScanCatalogItems(activeOrder, data.catalog || []) : [];
  const selectedModality = activeItems[0]?.modality || '';
  const priorScans = activeOrder ? getPriorImaging(data, activeOrder, selectedModality) : [];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Imaging · Accepted Scans" title="Accepted Scans" description="Work accepted scan cases from a clean reporting workspace. Draft reports stay here; submitted reports move to Imaging Review & Sign-off." />
      <div className="grid gap-4 md:grid-cols-4"><Card className="clinical-stat-card p-4"><Info label="Accepted Cases" value={accepted.length} /></Card><Card className="clinical-stat-card p-4"><Info label="Draft Reports" value={(data.results || []).filter((r) => r.department === 'Imaging' && r.status === 'Draft').length} /></Card><Card className="clinical-stat-card p-4"><Info label="Pending Review" value={(data.results || []).filter((r) => r.department === 'Imaging' && r.status === 'Pending Review').length} /></Card><Card className="clinical-stat-card p-4"><Info label="DICOM Ready" value=".dcm/.dicom" /></Card></div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card title="Accepted scan search" subtitle="Search by patient, booking ID, order ID, doctor or scan name.">
          <div className="relative mb-4"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accepted scans..." /></div>
          <DataTable columns={[{ key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName}</p><p className="text-xs text-slate-500">{row.patient?.id}</p></div> }, { key: 'id', label: 'Booking ID', render: (row) => <span className="font-bold text-slate-900">{row.id}</span> }, { key: 'orderId', label: 'Order' }, { key: 'report', label: 'Report', render: (row) => <StatusBadge status={row.result?.status || 'Not Entered'} /> }, { key: 'actions', label: 'Action', render: (row) => <Button onClick={() => { setActiveOrderId(row.orderId); dispatch({ type: 'OPEN_ACCEPTED_SCAN', orderId: row.orderId }); }}>Open</Button> }]} rows={rows} emptyMessage="No accepted scans match your search." />
        </Card>
        <Card title="Accepted scan workspace" subtitle="Compare prior scans, attach images/DICOM files, save drafts and submit reports for review.">
          {!activeOrder ? <p className="text-sm text-slate-500">Select an accepted scan to begin.</p> : <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="font-bold text-slate-900">{activeOrder.patient?.fullName}</p><p className="text-sm text-slate-500">{activeOrder.patient?.id} · {activeOrder.patient?.phone}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Order</p><p className="font-bold text-slate-900">{activeOrder.id}</p><p className="text-sm text-slate-500">{formatDateTime(activeOrder.createdAt)}</p></div></div><div className="space-y-3">{activeItems.map((scan) => <div key={scan.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-bold text-slate-900"><FileImage className="mr-2 inline h-4 w-4 text-purple-600" />{scan.name}</p><p className="text-sm text-slate-500">{scan.id} · {scan.modality}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={activeResult?.status || 'Not Entered'} /><Button onClick={() => setReportOrderId(activeOrder.id)}>Enter Report</Button></div></div>)}</div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Comparison to prior scans</p>{priorScans.length === 0 ? <p className="mt-2 text-sm font-semibold text-slate-500">No prior {selectedModality || 'imaging'} reports found for this patient.</p> : <div className="mt-3 space-y-2">{priorScans.map((scan) => <div key={scan.id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><span className="font-bold text-slate-900">{scan.orderId}</span> · {scan.reportText}</div>)}</div>}</div><div className="rounded-2xl border border-purple-100 bg-purple-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-purple-700">DICOM metadata preview</p>{activeResult?.files?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{activeResult.files.map((file) => <div key={file.name} className="rounded-xl bg-white p-3 text-xs font-bold text-slate-700">{file.name}<br /><span className="text-slate-500">{file.isDicom ? 'DICOM object' : file.type || 'Attachment'}</span></div>)}</div> : <p className="mt-2 text-sm font-semibold text-purple-700">No images or DICOM metadata attached yet.</p>}</div></div>}
        </Card>
      </div>
      <ReportModal open={Boolean(reportOrderId)} onClose={() => setReportOrderId('')} order={reportOrder} data={data} dispatch={dispatch} />
    </div>
  );
}
function Info({ label, value }) { return <div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{value ?? '—'}</p></div>; }
