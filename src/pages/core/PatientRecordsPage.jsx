import { useMemo, useState } from 'react';
import { Edit3, Eye, Plus, Search, ShieldAlert, UserRoundCheck } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { formatDateTime } from '../../utils/formatters';
import { buildPatientOrderHistory, calculateAge, findDuplicatePatients, patientMatchesSearch } from '../../utils/patientUtils';
import { ClippedList } from '../../components/ui/ClippedList';

const blankPatient = {
  fullName: '',
  dateOfBirth: '',
  gender: 'Female',
  phone: '',
  email: '',
  address: '',
  nationalId: '',
  referringHospitalId: '',
  referringDoctorId: '',
  insuranceProvider: '',
  policyNumber: '',
  emergencyContact: '',
  allergies: ''
};

function PatientForm({ value, onChange, hospitals, doctors }) {
  function setField(field, nextValue) {
    onChange({ ...value, [field]: nextValue });
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <FormField label="Full Name">
        <input className={inputClass} value={value.fullName} onChange={(event) => setField('fullName', event.target.value)} placeholder="Patient legal name" />
      </FormField>
      <FormField label="Date of Birth">
        <input type="date" className={inputClass} value={value.dateOfBirth} onChange={(event) => setField('dateOfBirth', event.target.value)} />
      </FormField>
      <FormField label="Gender">
        <select className={inputClass} value={value.gender} onChange={(event) => setField('gender', event.target.value)}>
          <option>Female</option>
          <option>Male</option>
          <option>Other</option>
        </select>
      </FormField>
      <FormField label="Phone Number">
        <input className={inputClass} value={value.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="Primary contact" />
      </FormField>
      <FormField label="Email Address">
        <input type="email" className={inputClass} value={value.email} onChange={(event) => setField('email', event.target.value)} placeholder="Optional email" />
      </FormField>
      <FormField label="National ID / Passport No.">
        <input className={inputClass} value={value.nationalId} onChange={(event) => setField('nationalId', event.target.value)} placeholder="Identity verification" />
      </FormField>
      <FormField label="Referring Hospital">
        <select className={inputClass} value={value.referringHospitalId} onChange={(event) => setField('referringHospitalId', event.target.value)}>
          <option value="">Select hospital</option>
          {hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}
        </select>
      </FormField>
      <FormField label="Referring Doctor">
        <select className={inputClass} value={value.referringDoctorId} onChange={(event) => setField('referringDoctorId', event.target.value)}>
          <option value="">Select doctor</option>
          {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} — {doctor.specialty}</option>)}
        </select>
      </FormField>
      <FormField label="Insurance Provider">
        <input className={inputClass} value={value.insuranceProvider} onChange={(event) => setField('insuranceProvider', event.target.value)} placeholder="Optional" />
      </FormField>
      <FormField label="Policy Number">
        <input className={inputClass} value={value.policyNumber} onChange={(event) => setField('policyNumber', event.target.value)} placeholder="Optional" />
      </FormField>
      <div className="lg:col-span-2">
        <FormField label="Address">
          <input className={inputClass} value={value.address} onChange={(event) => setField('address', event.target.value)} placeholder="Residential address" />
        </FormField>
      </div>
      <div className="lg:col-span-2">
        <FormField label="Emergency Contact">
          <input className={inputClass} value={value.emergencyContact} onChange={(event) => setField('emergencyContact', event.target.value)} placeholder="Name and phone number" />
        </FormField>
      </div>
      <div className="lg:col-span-2">
        <FormField label="Allergy / Known Conditions Notes">
          <textarea className={`${inputClass} min-h-24`} value={value.allergies} onChange={(event) => setField('allergies', event.target.value)} placeholder="Clinical flags relevant to lab/scan staff" />
        </FormField>
      </div>
    </div>
  );
}

function PatientDetail({ patient, data }) {
  const orders = buildPatientOrderHistory(patient.id, data.orders, data);
  const doctor = data.doctors.find((item) => item.id === patient.referringDoctorId);
  const hospital = data.hospitals.find((item) => item.id === patient.referringHospitalId);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Identity</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{patient.fullName}</p>
          <p className="text-sm text-slate-500">{patient.id} · {patient.gender} · {calculateAge(patient.dateOfBirth)} yrs</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contact</p>
          <p className="mt-2 font-bold text-slate-800">{patient.phone || '—'}</p>
          <p className="text-sm text-slate-500">{patient.email || 'No email'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Referral</p>
          <p className="mt-2 font-bold text-slate-800">{hospital?.name || '—'}</p>
          <p className="text-sm text-slate-500">{doctor?.name || '—'}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Clinical Flags" subtitle="Allergy and known-condition notes visible to clinical staff.">
          <p className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">{patient.allergies || 'No allergy or known-condition notes recorded.'}</p>
        </Card>
        <Card title="Billing / Insurance Reference">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Provider</dt><dd className="font-bold text-slate-800">{patient.insuranceProvider || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Policy No.</dt><dd className="font-bold text-slate-800">{patient.policyNumber || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Emergency Contact</dt><dd className="font-bold text-slate-800">{patient.emergencyContact || '—'}</dd></div>
          </dl>
        </Card>
      </div>
      <Card title="Order History" subtitle="All orders linked to this master Patient ID.">
        <DataTable
          columns={[
            { key: 'id', label: 'Order ID', render: (order) => <span className="font-bold text-slate-900">{order.id}</span> },
            { key: 'items', label: 'Tests / Scans', render: (order) => <ClippedList items={order.items} /> },
            { key: 'status', label: 'Status', render: (order) => <StatusBadge status={order.status} /> },
            { key: 'billingStatus', label: 'Billing', render: (order) => <StatusBadge status={order.billingStatus} /> },
            { key: 'createdAt', label: 'Date', render: (order) => formatDateTime(order.createdAt) }
          ]}
          rows={orders}
          emptyMessage="No order history is linked to this patient yet."
        />
      </Card>
      <p className="text-xs font-semibold text-slate-500">Created {formatDateTime(patient.createdAt)} · Last updated {formatDateTime(patient.updatedAt)}</p>
    </div>
  );
}

export function PatientRecordsPage() {
  const { state, dispatch } = useAppStore();
  const { data } = state;
  const [search, setSearch] = useState('');
  const [viewPatient, setViewPatient] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);
  const [form, setForm] = useState(blankPatient);

  const filteredPatients = useMemo(() => {
    return (data.patients || [])
      .filter((patient) => patientMatchesSearch(patient, search))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }, [data.patients, search]);

  const duplicateCandidates = useMemo(() => findDuplicatePatients(data.patients, form, editingPatient?.id), [data.patients, form, editingPatient]);

  function openCreate() {
    setEditingPatient(null);
    setForm({ ...blankPatient, referringDoctorId: state.auth?.linkedDoctorId || '', referringHospitalId: state.auth?.hospitalId || '' });
  }

  function openEdit(patient) {
    setEditingPatient(patient);
    setForm({ ...blankPatient, ...patient });
  }

  function closeForm() {
    setEditingPatient(null);
    setForm(blankPatient);
  }

  function submitPatient(event) {
    event.preventDefault();
    if (editingPatient) {
      dispatch({ type: 'UPDATE_PATIENT', patientId: editingPatient.id, payload: form });
    } else {
      dispatch({ type: 'CREATE_PATIENT', payload: form });
    }
    closeForm();
  }

  const metrics = [
    { label: 'Total Patients', value: data.patients.length },
    { label: 'With Insurance', value: data.patients.filter((patient) => patient.insuranceProvider).length },
    { label: 'Doctor-Referred', value: data.patients.filter((patient) => patient.referringDoctorId).length },
    { label: 'Known Clinical Flags', value: data.patients.filter((patient) => patient.allergies).length }
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Patient Records"
        title="Patient Records"
        description="Master patient records referenced by doctor orders, reception check-in, lab/scan processing, results, invoices, and full patient history."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Patient</Button>}
      />

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xl font-bold text-slate-900">{metric.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{metric.label}</p>
          </div>
        ))}
      </div>

      <Card
        title="Master Patient Index"
        subtitle="Search, verify, update, and open patient profiles with linked order history."
        actions={
          <div className="relative w-full min-w-[260px] sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, phone, email..." aria-label="Search patients by name, ID, phone, or email" />
          </div>
        }
      >
        <DataTable
          columns={[
            { key: 'id', label: 'Patient ID', render: (patient) => <span className="font-bold text-slate-900">{patient.id}</span> },
            { key: 'fullName', label: 'Patient', render: (patient) => <div><p className="font-bold text-slate-900">{patient.fullName}</p><p className="text-xs text-slate-500">{patient.gender} · {calculateAge(patient.dateOfBirth)} yrs</p></div> },
            { key: 'contact', label: 'Contact', render: (patient) => <div><p>{patient.phone || '—'}</p><p className="text-xs text-slate-500">{patient.email || 'No email'}</p></div> },
            { key: 'referral', label: 'Referral', render: (patient) => {
              const hospital = data.hospitals.find((item) => item.id === patient.referringHospitalId);
              const doctor = data.doctors.find((item) => item.id === patient.referringDoctorId);
              return <div><p className="font-semibold">{hospital?.name || '—'}</p><p className="text-xs text-slate-500">{doctor?.name || '—'}</p></div>;
            }},
            { key: 'insurance', label: 'Insurance', render: (patient) => patient.insuranceProvider ? <StatusBadge status="Insurance" /> : <span className="text-slate-500">Self-pay / none</span> },
            { key: 'updatedAt', label: 'Updated', render: (patient) => formatDateTime(patient.updatedAt) },
            { key: 'actions', label: 'Actions', render: (patient) => <div className="flex gap-2"><Button variant="secondary" className="px-3" onClick={() => setViewPatient(patient)}><Eye className="h-4 w-4" /> View</Button><Button variant="subtle" className="px-3" onClick={() => openEdit(patient)}><Edit3 className="h-4 w-4" /> Edit</Button></div> }
          ]}
          rows={filteredPatients}
          emptyMessage="No patients match your search."
        />
      </Card>

      <Modal
        open={Boolean(viewPatient)}
        title={viewPatient ? `${viewPatient.fullName} · ${viewPatient.id}` : ''}
        description="Patient profile, identity details, clinical flags, and order history."
        onClose={() => setViewPatient(null)}
        footer={<Button variant="secondary" onClick={() => setViewPatient(null)}>Close</Button>}
      >
        {viewPatient && <PatientDetail patient={viewPatient} data={data} />}
      </Modal>

      <Modal
        open={Boolean(editingPatient) || form !== blankPatient}
        title={editingPatient ? `Edit ${editingPatient.fullName}` : 'Add Patient Record'}
        description="Capture complete patient record fields used by orders, billing, lab, scan, and reporting modules."
        onClose={closeForm}
        footer={<><Button variant="secondary" type="button" onClick={closeForm}>Cancel</Button><Button type="submit" form="patient-form"><UserRoundCheck className="h-4 w-4" /> Save Patient</Button></>}
      >
        {duplicateCandidates.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4" /> Possible duplicate patient record</div>
            <p className="mt-1">Review before saving. Matches: {duplicateCandidates.map((patient) => `${patient.fullName} (${patient.id})`).join(', ')}</p>
          </div>
        )}
        <form id="patient-form" onSubmit={submitPatient}>
          <PatientForm value={form} onChange={setForm} hospitals={data.hospitals} doctors={data.doctors} />
        </form>
      </Modal>
    </div>
  );
}
