import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Camera, CheckCircle2, CheckSquare, MonitorUp, Search, Square } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';

function getCatalogItem(data, itemId) {
  return (data.catalog || []).find((item) => item.id === itemId);
}

function getScanItemsForOrder(data, order) {
  return (order.itemIds || [])
    .map((itemId) => getCatalogItem(data, itemId))
    .filter((item) => item?.department === 'Imaging');
}

function getScanOrders(data) {
  return (data.orders || [])
    .map((order) => ({ ...order, items: getScanItemsForOrder(data, order) }))
    .filter((order) => order.items.length > 0 || (order.routedDepartments || []).includes('Imaging'));
}

function describeScanItems(items = []) {
  if (!items.length) return 'No scan items listed';
  return items.map((item) => item.name || item.id).join(', ');
}

function scanQueueMatches(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    row.id,
    row.patient?.fullName,
    row.patient?.id,
    row.doctor?.name,
    row.hospital?.name,
    describeScanItems(row.items),
    row.urgency,
    row.status
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function scanStateForOrder(data, orderId) {
  const bookings = (data.scanBookings || []).filter((booking) => booking.orderId === orderId);
  if (bookings.some((booking) => booking.status === 'Accepted')) return 'Accepted';
  if (bookings.some((booking) => booking.status === 'Retake Requested')) return 'Retake Requested';
  if (bookings.some((booking) => booking.status === 'Rejected')) return 'Rejected';
  if (bookings.some((booking) => booking.status === 'Booked')) return 'Booked';
  return 'Awaiting Acceptance';
}

function acceptedScanForOrder(data, orderId) {
  return (data.scanBookings || []).find((booking) => booking.orderId === orderId && booking.status === 'Accepted');
}

function defaultEquipment(data) {
  return (data.scanEquipment || []).find((equipment) => equipment.status === 'Available') || (data.scanEquipment || [])[0] || null;
}

function ScanQueueStepper({ currentStep }) {
  const steps = [
    { number: 1, label: 'Queue' },
    { number: 2, label: 'Review request' },
    { number: 3, label: 'Accept to imaging' }
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step) => {
          const active = step.number === currentStep;
          const complete = step.number < currentStep;
          return (
            <div key={step.number} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${active ? 'bg-clinical-50 text-clinical-800' : 'bg-slate-50 text-slate-500'}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${active || complete ? 'bg-clinical-600 text-white' : 'bg-white text-slate-500'}`}>{step.number}</span>
              <span className="text-sm font-bold">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScanQueuePage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [scanFilter, setScanFilter] = useState('');
  const [selected, setSelected] = useState([]);
  const [workspace, setWorkspace] = useState(state.ui.activeScanAcceptOrderId ? 'review' : 'queue');
  const [activeOrderId, setActiveOrderId] = useState(state.ui.activeScanAcceptOrderId || '');

  const equipment = defaultEquipment(data);
  const [modality, setModality] = useState(equipment?.modality || 'X-ray');
  const [room, setRoom] = useState(equipment?.room || 'Imaging Room 1');
  const [machine, setMachine] = useState(equipment?.machine || 'Pending machine assignment');
  const [technicianNotes, setTechnicianNotes] = useState('');

  const scanOrders = useMemo(() => getScanOrders(data), [data]);
  const baseRows = useMemo(() => scanOrders
    .filter((order) => !status || order.status === status)
    .filter((order) => scanQueueMatches(order, query))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [scanOrders, query, status]);
  const rows = baseRows.filter((order) => !scanFilter || scanStateForOrder(data, order.id) === scanFilter);
  const activeOrder = scanOrders.find((order) => order.id === activeOrderId) || null;
  const acceptedScan = activeOrder ? acceptedScanForOrder(data, activeOrder.id) : null;

  const acceptedOrderIds = new Set((data.scanBookings || []).filter((booking) => booking.status === 'Accepted').map((booking) => booking.orderId));
  const awaiting = baseRows.filter((order) => !acceptedOrderIds.has(order.id));
  const urgent = baseRows.filter((order) => order.urgency === 'Urgent').length;
  const pendingReview = baseRows.filter((order) => order.result?.status === 'Pending Review').length;
  const selectableRows = rows.filter((order) => scanStateForOrder(data, order.id) !== 'Accepted');
  const allVisibleSelected = selectableRows.length > 0 && selectableRows.every((order) => selected.includes(order.id));

  const toggleRow = (orderId) => setSelected((current) => current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]);
  const toggleAll = () => setSelected(allVisibleSelected ? [] : selectableRows.map((order) => order.id));
  const batchAccept = () => {
    selected.forEach((orderId) => dispatch({ type: 'ACCEPT_SCAN_ORDER', orderId, payload: { modality, room, machine, technicianNotes } }));
    setSelected([]);
  };
  const openReviewWorkspace = (order) => {
    const accepted = acceptedScanForOrder(data, order.id);
    setActiveOrderId(order.id);
    setModality(accepted?.modality || equipment?.modality || 'X-ray');
    setRoom(accepted?.room || equipment?.room || 'Imaging Room 1');
    setMachine(accepted?.machine || equipment?.machine || 'Pending machine assignment');
    setTechnicianNotes(accepted?.technicianNotes || '');
    setWorkspace('review');
  };
  const goBackToQueue = () => {
    setWorkspace('queue');
    setActiveOrderId('');
  };
  const acceptActiveScan = () => {
    if (!activeOrder) return;
    dispatch({ type: 'ACCEPT_SCAN_ORDER', orderId: activeOrder.id, payload: { modality, room, machine, technicianNotes } });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Scan Unit · Requested Patients"
        title="Scan Queue"
        description="A focused queue workflow. Select one request, review it in this same page area, then accept it into the imaging workspace."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Scan Patients" value={baseRows.length} icon={Camera} tone="blue" />
        <MetricCard label="Awaiting Acceptance" value={awaiting.length} icon={CheckCircle2} tone="yellow" />
        <MetricCard label="Urgent" value={urgent} icon={CheckCircle2} tone="red" />
        <MetricCard label="Pending Review" value={pendingReview} icon={MonitorUp} tone="purple" />
      </div>

      {workspace === 'queue' && (
        <Card title="Requested scan patients" subtitle="Search and select a scan request. The review panel opens here instead of continuing further down the page.">
          <div className="space-y-4">
            <ScanQueueStepper currentStep={1} />

            <div className="grid gap-3 xl:grid-cols-[1fr_200px_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient name, patient ID, order ID, scan name..." />
              </div>
              <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All order statuses</option>
                <option>Submitted</option>
                <option>Confirmed</option>
                <option>In Progress</option>
                <option>Pending Review</option>
                <option>Final / Released</option>
              </select>
              <select className={inputClass} value={scanFilter} onChange={(event) => setScanFilter(event.target.value)}>
                <option value="">All scan states</option>
                <option>Awaiting Acceptance</option>
                <option>Accepted</option>
                <option>Booked</option>
                <option>Rejected</option>
                <option>Retake Requested</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-600"><span className="font-bold text-slate-900">{selected.length}</span> selected for imaging acceptance</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={toggleAll}>{allVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} {allVisibleSelected ? 'Clear visible' : 'Select visible'}</Button>
                <Button disabled={!selected.length} onClick={batchAccept}><CheckCircle2 className="h-4 w-4" /> Accept Selected</Button>
              </div>
            </div>

            <DataTable
              columns={[
                { key: 'select', label: '', render: (row) => <button type="button" disabled={scanStateForOrder(data, row.id) === 'Accepted'} onClick={() => toggleRow(row.id)} className="text-clinical-700 disabled:text-slate-300">{selected.includes(row.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}</button> },
                { key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName}</p><p className="text-xs text-slate-500">{row.patient?.id}</p></div> },
                { key: 'id', label: 'Order ID', render: (row) => <span className="font-bold text-slate-900">{row.id}</span> },
                { key: 'scans', label: 'Scans', render: (row) => <div className="max-w-full text-sm font-semibold text-slate-700">{describeScanItems(row.items)}</div> },
                { key: 'doctor', label: 'Clinician / Hospital', render: (row) => <div><p className="font-semibold">{row.doctor?.name}</p><p className="text-xs text-slate-500">{row.hospital?.name}</p></div> },
                { key: 'urgency', label: 'Urgency', render: (row) => <StatusBadge status={row.urgency} /> },
                { key: 'scanStatus', label: 'Scan State', render: (row) => <StatusBadge status={scanStateForOrder(data, row.id)} /> },
                { key: 'createdAt', label: 'Requested', render: (row) => formatDateTime(row.createdAt) },
                { key: 'actions', label: 'Action', render: (row) => <Button onClick={() => openReviewWorkspace(row)}><CheckCircle2 className="h-4 w-4" /> {scanStateForOrder(data, row.id) === 'Accepted' ? 'Open' : 'Review / Accept'}</Button> }
              ]}
              rows={rows}
              emptyMessage="No scan-routed patients match your search."
            />
          </div>
        </Card>
      )}

      {workspace === 'review' && (
        <Card title="Scan request workspace" subtitle="Review the request and accept it directly into imaging without scrolling to another section.">
          <div className="space-y-5">
            <ScanQueueStepper currentStep={activeOrder && acceptedScan ? 3 : 2} />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Button variant="secondary" onClick={goBackToQueue}><ArrowLeft className="h-4 w-4" /> Back to Queue</Button>
              {activeOrder && <div className="flex flex-wrap items-center gap-2"><StatusBadge status={activeOrder.urgency} /><StatusBadge status={scanStateForOrder(data, activeOrder.id)} /></div>}
            </div>

            {!activeOrder ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-bold text-slate-900">No scan request selected.</p>
                <p className="mt-2 text-sm text-slate-500">Go back to the queue and select a patient request.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p>
                    <p className="mt-1 font-bold text-slate-900">{activeOrder.patient?.fullName}</p>
                    <p className="text-sm text-slate-500">{activeOrder.patient?.id} · {activeOrder.patient?.phone}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Order ID</p>
                    <p className="mt-1 font-bold text-slate-900">{activeOrder.id}</p>
                    <p className="text-sm text-slate-500">{formatDateTime(activeOrder.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician</p>
                    <p className="mt-1 font-bold text-slate-900">{activeOrder.doctor?.name}</p>
                    <p className="text-sm text-slate-500">{activeOrder.hospital?.name}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Processing</p>
                    <p className="mt-1 font-bold text-slate-900">{activeOrder.status}</p>
                    <p className="text-sm text-slate-500">{activeOrder.items?.length || 0} requested scan(s)</p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Requested scans</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {activeOrder.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                          <span className="font-bold text-slate-900"><Camera className="mr-2 inline h-4 w-4 text-clinical-600" />{item.name}</span>
                          <StatusBadge status={item.modality || item.department || 'Imaging'} />
                        </div>
                      ))}
                      {activeOrder.items.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No scan item details found for this request.</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Imaging acceptance details</p>
                    <div className="mt-3 grid gap-3">
                      <input className={inputClass} value={modality} onChange={(event) => setModality(event.target.value)} placeholder="Modality, e.g. X-ray, CT, Ultrasound" disabled={Boolean(acceptedScan)} />
                      <input className={inputClass} value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Room" disabled={Boolean(acceptedScan)} />
                      <input className={inputClass} value={machine} onChange={(event) => setMachine(event.target.value)} placeholder="Machine" disabled={Boolean(acceptedScan)} />
                      <textarea className={`${inputClass} min-h-[96px]`} value={technicianNotes} onChange={(event) => setTechnicianNotes(event.target.value)} placeholder="Technician notes or preparation instructions" disabled={Boolean(acceptedScan)} />
                    </div>

                    {acceptedScan ? (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="font-bold text-emerald-800">Scan already accepted: {acceptedScan.id}</p>
                        <p className="mt-1 text-sm text-emerald-700">Accepted by {acceptedScan.acceptedBy} at {formatDateTime(acceptedScan.acceptedAt || acceptedScan.bookedAt)}</p>
                      </div>
                    ) : (
                      <Button onClick={acceptActiveScan}><CheckCircle2 className="h-4 w-4" /> Accept to Imaging</Button>
                    )}
                    {acceptedScan && <Button onClick={() => dispatch({ type: 'OPEN_ACCEPTED_SCAN', orderId: activeOrder.id })}><CalendarDays className="h-4 w-4" /> Open Accepted Scan Workspace</Button>}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinical notes</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{activeOrder.clinicalNotes || 'No clinical notes provided.'}</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
