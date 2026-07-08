import { useMemo, useState } from 'react';
import { ClipboardCheck, FileSearch, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricCard } from '../../components/ui/MetricCard';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, getById } from '../../utils/formatters';
import { findDuplicatePatients } from '../../utils/patientUtils';
import { ReceptionPageTabs } from './ReceptionPageTabs';

export function PatientCheckInPage() {
  const { state, dispatch } = useAppStore();
  const [section, setSection] = useState('search');
  const [query, setQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [identityVerified, setIdentityVerified] = useState(true);
  const [notes, setNotes] = useState('Identity and order details verified at front desk.');

  const patients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.data.patients.slice(0, 8);
    return state.data.patients.filter((patient) => [patient.id, patient.fullName, patient.phone, patient.email, patient.nationalId].join(' ').toLowerCase().includes(q));
  }, [state.data.patients, query]);

  const selectedPatient = getById(state.data.patients, selectedPatientId);
  const patientOrders = state.data.orders.filter((order) => order.patientId === selectedPatientId && !['Final / Released', 'Cancelled'].includes(order.status));
  const duplicateCandidates = selectedPatient ? findDuplicatePatients(state.data.patients, selectedPatient) : [];
  const todaysVisits = state.data.dailyVisits || [];
  const checkedInToday = todaysVisits.filter((visit) => visit.status === 'Checked In').length;
  const unverifiedVisits = todaysVisits.filter((visit) => !visit.identityVerified).length;
  const linkedOrderVisits = todaysVisits.filter((visit) => visit.orderId).length;

  const pageSections = [
    { id: 'summary', label: 'Summary', helper: 'Arrival counts', icon: ClipboardCheck, tone: 'blue', count: todaysVisits.length },
    { id: 'search', label: 'Search & Check-In', helper: 'Find patient', icon: Search, tone: 'emerald', count: patients.length },
    { id: 'orders', label: 'Link Order', helper: 'Attach active order', icon: ShieldCheck, tone: 'purple', count: patientOrders.length },
    { id: 'visits', label: 'Today’s Visits', helper: 'Checked-in list', icon: UsersRound, tone: 'slate', count: todaysVisits.length },
    { id: 'duplicates', label: 'Duplicates', helper: 'Review matches', icon: FileSearch, tone: 'amber', count: duplicateCandidates.length }
  ];

  function checkIn({ requestTests = false } = {}) {
    dispatch({ type: 'CHECK_IN_PATIENT', payload: { patientId: selectedPatientId, orderId: selectedOrderId, identityVerified, notes, nextAction: requestTests ? 'request-tests' : '' } });
    setSection('visits');
  }

  const checkInForm = (
    <Card title="Patient search and check-in" subtitle="Use this section only for arrivals. Walk-in registration remains on the Walk-Ins page." compact>
      <div className="space-y-4">
        <FormField label="Search master patient index">
          <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, Patient ID, phone, email, National ID" />
        </FormField>
        <FormField label="Select patient">
          <select className={inputClass} value={selectedPatientId} onChange={(event) => { setSelectedPatientId(event.target.value); setSelectedOrderId(''); }}>
            <option value="">Choose patient</option>
            {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName} — {patient.id}</option>)}
          </select>
        </FormField>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={identityVerified} onChange={(event) => setIdentityVerified(event.target.checked)} /> Identity verified
        </label>
        <FormField label="Check-in notes">
          <textarea className={inputClass} rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </FormField>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => checkIn()} disabled={!selectedPatientId}>Check In Patient</Button>
          <Button variant="secondary" onClick={() => checkIn({ requestTests: true })} disabled={!selectedPatientId}>Check In & Request Tests</Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Reception" title="Patient Check-In" description="Patient arrival, identity verification, order linking, and daily visit registration." />
      <ReceptionPageTabs label="Check-in sections" sections={pageSections} active={section} onChange={setSection} />

      {section === 'summary' && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Patient records" value={state.data.patients.length} icon={UsersRound} tone="blue" />
        <MetricCard label="Checked in" value={checkedInToday} icon={ClipboardCheck} tone="green" />
        <MetricCard label="Linked orders" value={linkedOrderVisits} icon={ShieldCheck} tone="purple" />
        <MetricCard label="Needs verification" value={unverifiedVisits} icon={Search} tone="yellow" />
      </div>}

      {section === 'search' && checkInForm}

      {section === 'orders' && <Card title="Link active order" subtitle="Choose a patient first, then attach the correct active order before check-in." compact>
        <div className="space-y-4">
          {!selectedPatient && <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Select a patient from Search & Check-In first.</div>}
          <FormField label="Selected patient"><input className={inputClass} readOnly value={selectedPatient ? `${selectedPatient.fullName} — ${selectedPatient.id}` : 'No patient selected'} /></FormField>
          <FormField label="Link active order">
            <select className={inputClass} value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)} disabled={!selectedPatientId}>
              <option value="">No linked order / standalone visit</option>
              {patientOrders.map((order) => <option key={order.id} value={order.id}>{order.id} — {order.status}</option>)}
            </select>
          </FormField>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => checkIn()} disabled={!selectedPatientId}>Check In With Selected Order</Button>
            <Button variant="secondary" onClick={() => checkIn({ requestTests: true })} disabled={!selectedPatientId || Boolean(selectedOrderId)}>Standalone Check-In & Request Tests</Button>
          </div>
        </div>
      </Card>}

      {section === 'visits' && <Card title="Today’s checked-in patients" subtitle="A compact view of patients already added to the reception shift register." compact>
        <DataTable
          columns={[
            { key: 'id', label: 'Visit ID' },
            { key: 'patient', label: 'Patient', render: (row) => getById(state.data.patients, row.patientId)?.fullName || '—' },
            { key: 'orderId', label: 'Order', render: (row) => row.orderId || 'Standalone' },
            { key: 'identityVerified', label: 'Identity', render: (row) => <StatusBadge status={row.identityVerified ? 'Verified' : 'Not verified'} /> },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'checkedInAt', label: 'Checked In', render: (row) => formatDateTime(row.checkedInAt) },
            { key: 'actions', label: 'Action', render: (row) => !row.orderId ? <Button variant="secondary" onClick={() => dispatch({ type: 'START_WALK_IN_TEST_REQUEST', payload: { patientId: row.patientId, visitId: row.id } })}>Request Tests</Button> : <span className="text-xs font-bold text-slate-500">Linked</span> }
          ]}
          rows={todaysVisits.slice(0, 12)}
          emptyMessage="No checked-in patients yet."
        />
      </Card>}

      {section === 'duplicates' && <Card title="Possible duplicate records" subtitle="Review duplicate matches after selecting a patient." compact>
        {selectedPatient && duplicateCandidates.length > 0 ? <div className="space-y-3">
          {duplicateCandidates.map((patient) => (
            <div key={patient.id} className="flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <div><p className="font-bold text-slate-900">{patient.fullName}</p><p className="text-sm text-slate-500">{patient.id} · {patient.phone || 'No phone'}</p></div>
              <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => dispatch({ type: 'FLAG_DUPLICATE_PATIENT', payload: { patientId: selectedPatient.id, possibleDuplicateId: patient.id } })}>Flag duplicate</Button>
            </div>
          ))}
        </div> : <p className="text-sm font-semibold text-slate-500">Select a patient with possible matches to review duplicate records.</p>}
      </Card>}
    </div>
  );
}
