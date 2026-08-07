import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, MonitorCog, ScanLine } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { describeOrderItems, getScanCatalogItems, getScanOrders } from '../../utils/orderViews';

const DEFAULT_EQUIPMENT = [
  { id: 'EQ-XR-01', room: 'X-Ray Room 1', machine: 'Digital X-Ray DRX-1', modality: 'X-ray', status: 'Available' },
  { id: 'EQ-US-01', room: 'Ultrasound Room', machine: 'SonoAce X8', modality: 'Ultrasound', status: 'Available' },
  { id: 'EQ-CT-01', room: 'CT Suite', machine: 'Somatom Go.Now', modality: 'CT', status: 'In Use' },
  { id: 'EQ-MR-01', room: 'MRI Suite', machine: 'Magnetom 1.5T', modality: 'MRI', status: 'Maintenance' }
];

export function EquipmentBookingPage() {
  const { state, dispatch } = useAppStore();
  const equipment = state.data.scanEquipment || DEFAULT_EQUIPMENT;
  const scanOrders = useMemo(() => getScanOrders(state.data).filter((order) => ['Confirmed', 'In Progress', 'Pending Review'].includes(order.status)), [state.data]);
  const [form, setForm] = useState({ orderId: scanOrders[0]?.id || '', equipmentId: equipment[0]?.id || '', bookedAt: '', status: 'Booked', technicianNotes: '' });
  const [query, setQuery] = useState('');
  const selectedEquipment = equipment.find((item) => item.id === form.equipmentId) || equipment[0];
  const bookingRows = useMemo(() => (state.data.scanBookings || []).map((booking) => {
    const order = getScanOrders(state.data).find((item) => item.id === booking.orderId);
    return { ...booking, order };
  }).filter((booking) => {
    const search = `${booking.id} ${booking.orderId} ${booking.modality} ${booking.room} ${booking.machine} ${booking.order?.patient?.fullName || ''}`.toLowerCase();
    return !query || search.includes(query.toLowerCase());
  }), [state.data, query]);

  const bookingColumns = [
    { key: 'id', label: 'Booking ID' },
    { key: 'orderId', label: 'Order' },
    { key: 'patient', label: 'Patient', render: (row) => row.order?.patient?.fullName || '—' },
    { key: 'modality', label: 'Modality', render: (row) => <StatusBadge status={row.modality} /> },
    { key: 'machine', label: 'Machine' },
    { key: 'room', label: 'Room' },
    { key: 'bookedAt', label: 'Booked At', render: (row) => formatDateTime(row.bookedAt) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> }
  ];

  function saveBooking() {
    dispatch({
      type: 'ADD_SCAN_BOOKING',
      payload: {
        orderId: form.orderId,
        modality: selectedEquipment?.modality,
        room: selectedEquipment?.room,
        machine: selectedEquipment?.machine,
        bookedAt: form.bookedAt,
        status: form.status,
        technicianNotes: form.technicianNotes
      }
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Scan / Imaging Unit"
        title="Equipment and room booking"
        description="Assign scan orders to imaging equipment, rooms and time slots, and track current machine status."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Equipment" value={equipment.length} icon={MonitorCog} tone="purple" />
        <MetricCard label="Available" value={equipment.filter((item) => item.status === 'Available').length} icon={ScanLine} tone="green" />
        <MetricCard label="Bookings" value={(state.data.scanBookings || []).length} icon={CalendarDays} tone="blue" />
        <MetricCard label="Open Scan Orders" value={scanOrders.length} icon={Clock3} tone="yellow" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card title="Create equipment booking" subtitle="Book a machine and room for confirmed imaging work.">
          <div className="space-y-4">
            <FormField label="Scan order"><select className={inputClass} value={form.orderId} onChange={(event) => setForm((prev) => ({ ...prev, orderId: event.target.value }))}>
              <option value="">Select order</option>
              {scanOrders.map((order) => <option key={order.id} value={order.id}>{order.id} — {order.patient?.fullName} — {describeOrderItems(getScanCatalogItems(order, state.data.catalog || []))}</option>)}
            </select></FormField>
            <FormField label="Equipment"><select className={inputClass} value={form.equipmentId} onChange={(event) => setForm((prev) => ({ ...prev, equipmentId: event.target.value }))}>
              {equipment.map((item) => <option key={item.id} value={item.id}>{item.modality} — {item.machine} — {item.room}</option>)}
            </select></FormField>
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2">
              <Info label="Modality" value={selectedEquipment?.modality} />
              <Info label="Status" value={selectedEquipment?.status} />
              <Info label="Room" value={selectedEquipment?.room} />
              <Info label="Machine" value={selectedEquipment?.machine} />
            </div>
            <FormField label="Time slot"><input type="datetime-local" className={inputClass} value={form.bookedAt} onChange={(event) => setForm((prev) => ({ ...prev, bookedAt: event.target.value }))} /></FormField>
            <FormField label="Booking status"><select className={inputClass} value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}><option>Booked</option><option>In Use</option><option>Completed</option></select></FormField>
            <FormField label="Technician notes"><textarea rows="4" className={inputClass} value={form.technicianNotes} onChange={(event) => setForm((prev) => ({ ...prev, technicianNotes: event.target.value }))} /></FormField>
            <Button className="w-full" onClick={saveBooking}>Save equipment booking</Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Equipment list" subtitle="Imaging machines and room status for scheduling.">
            <div className="grid gap-3 md:grid-cols-2">
              {equipment.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-900">{item.machine}</p><StatusBadge status={item.status} /></div><p className="mt-1 text-sm font-semibold text-slate-500">{item.modality} · {item.room}</p></div>)}
            </div>
          </Card>
          <Card title="Today’s imaging board" subtitle="Calendar-like room view grouped by machine and time.">
            <div className="grid gap-3 md:grid-cols-2">
              {equipment.map((item) => {
                const machineBookings = bookingRows.filter((booking) => booking.machine === item.machine || booking.room === item.room);
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-900">{item.room}</p><StatusBadge status={item.status} /></div>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.machine} · {item.modality}</p>
                    <div className="mt-3 space-y-2">
                      {machineBookings.length === 0 ? <p className="text-xs font-semibold text-slate-500">No bookings on this machine.</p> : machineBookings.slice(0, 4).map((booking) => <div key={booking.id} className="rounded-xl bg-slate-50 p-2 text-xs"><span className="font-bold text-slate-900">{formatDateTime(booking.bookedAt)}</span><br />{booking.order?.patient?.fullName || booking.orderId}</div>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title="Booking records" subtitle="Search bookings by patient, order, room, modality or machine.">
            <input className={`${inputClass} mb-4`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bookings" aria-label="Search bookings" />
            <DataTable columns={bookingColumns} rows={bookingRows} emptyMessage="No imaging bookings recorded." />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900">{value || '—'}</p></div>;
}
