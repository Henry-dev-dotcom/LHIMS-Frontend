import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Plus, Search, Send, Star, Trash2, X } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { calculateAge, findDuplicatePatients, patientMatchesSearch } from '../../utils/patientUtils';
import { computeExpectedCompletion } from '../../workflow/workflowEngine';
import { formatDateTime } from '../../utils/formatters';

const newPatientBlank = {
  fullName: '', dateOfBirth: '', gender: 'Female', phone: '', email: '', address: '', nationalId: '', insuranceProvider: '', policyNumber: '', emergencyContact: '', allergies: ''
};

const COMMON_TEST_IDS = ['t1', 't3', 't4', 't5', 't6', 't7', 't17', 't19'];

function catalogMatches(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.id, item.name, item.type, item.department, item.modality, item.searchText]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function isSameDay(a, b = new Date()) {
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime())) return false;
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function CatalogSearchModal({ open, onClose, catalog, selectedItems, toggleItem, clearItems }) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  const departmentItems = catalog.filter((item) => !department || item.department === department);
  const dropdownMatches = query.trim()
    ? departmentItems.filter((item) => catalogMatches(item, query)).slice(0, 10)
    : [];
  const selectedCatalogItems = selectedItems.map((id) => catalog.find((item) => item.id === id)).filter(Boolean);

  function chooseFromDropdown(id) {
    toggleItem(id);
    setQuery('');
    setSearchActive(true);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add test or scan"
      description="Search by test/scan name, catalog ID, department, modality, or common abbreviation. Search results now open directly under the search bar. Prices remain hidden from clinicians."
      footer={(
        <>
          <div className="mr-auto text-sm font-bold text-slate-500">{selectedItems.length} selected</div>
          <Button type="button" variant="secondary" onClick={clearItems}>Clear</Button>
          <Button type="button" onClick={onClose}>Done — Save Selected Tests</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_190px]">
          <div className="relative z-30">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              className={`${inputClass} pl-9`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchActive(true)}
              onBlur={() => window.setTimeout(() => setSearchActive(false), 120)}
              placeholder="Search FBC, t1, LFT, ultrasound, scan..."
              autoFocus
            />

            {searchActive && query.trim() && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-80 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl">
                <div className="mb-2 flex items-center justify-between px-2 py-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Search results</p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">{dropdownMatches.length} shown</span>
                </div>

                {dropdownMatches.map((item) => {
                  const selected = selectedItems.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(event) => { event.preventDefault(); chooseFromDropdown(item.id); }}
                      className={`flex w-full flex-col gap-2 rounded-2xl px-3 py-3 text-left transition sm:flex-row sm:items-center sm:justify-between ${selected ? 'bg-clinical-50 ring-2 ring-clinical-200' : 'hover:bg-slate-50'}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold text-slate-900">{item.name}</p>
                          <StatusBadge status={item.type} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{item.id} · {item.department === 'Imaging' ? 'Radiology / Scan' : item.department}{item.modality ? ` · ${item.modality}` : ''} · ETA {item.expectedHours}h</p>
                      </div>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${selected ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{selected ? 'Added' : 'Add'}</span>
                    </button>
                  );
                })}

                {dropdownMatches.length === 0 && (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No tests or scans match your search.</p>
                )}
              </div>
            )}
          </div>

          <select className={inputClass} value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="">Both departments</option>
            <option value="Laboratory">Laboratory</option>
            <option value="Imaging">Scan / Radiology</option>
          </select>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quick common requests</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMMON_TEST_IDS.map((id) => catalog.find((item) => item.id === id)).filter(Boolean).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${selectedItems.includes(item.id) ? 'bg-clinical-600 text-white ring-clinical-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-clinical-50 hover:text-clinical-700'}`}
              >
                <Star className="h-3.5 w-3.5" /> {item.name}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Selected tests / scans</p>
              <p className="text-sm text-slate-500">Use the search bar above. Matching tests drop down immediately under it.</p>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{selectedCatalogItems.length} selected</span>
          </div>

          {selectedCatalogItems.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedCatalogItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="inline-flex items-center gap-2 rounded-full bg-clinical-50 px-3 py-1.5 text-xs font-bold text-clinical-700 ring-1 ring-clinical-200 hover:bg-red-50 hover:text-red-600 hover:ring-red-200"
                  title="Remove selected item"
                >
                  {item.id} · {item.name}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">No tests or scans selected yet.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ReviewOrderModal({ open, onClose, onConfirm, patient, newPatient, patientMode, doctor, hospital, items, urgency, clinicalNotes, expected, duplicateOrders }) {
  const patientName = patientMode === 'existing' ? patient?.fullName : newPatient.fullName;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review and submit order"
      description="Confirm the selected patient, tests/scans, urgency, and clinical notes before sending to reception."
      footer={<><Button variant="secondary" onClick={onClose}>Go Back</Button><Button onClick={onConfirm}><Send className="h-4 w-4" /> Submit to Reception</Button></>}
    >
      <div className="space-y-4">
        {duplicateOrders.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex gap-2 font-bold"><AlertTriangle className="h-5 w-5" /> Possible duplicate same-day order</div>
            <p className="mt-1">This patient already has {duplicateOrders.length} order(s) today containing one or more of the selected tests/scans.</p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p>
            <p className="mt-1 font-bold text-slate-900">{patientName || '—'}</p>
            <p className="text-sm text-slate-500">{patientMode === 'existing' ? patient?.id : 'New patient record will be created'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician / Hospital</p>
            <p className="mt-1 font-bold text-slate-900">{doctor?.name}</p>
            <p className="text-sm text-slate-500">{hospital?.name}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Urgency</p>
            <div className="mt-1"><StatusBadge status={urgency} /></div>
            <p className="mt-2 text-sm text-slate-500">Expected: {expected ? formatDateTime(expected) : '—'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Selected items</p>
            <p className="mt-1 font-bold text-slate-900">{items.length} test/scan item(s)</p>
            <p className="text-sm text-slate-500">Prices hidden from clinicians.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Tests / Scans</p>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{item.id} · {item.name}</span>)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinical notes</p>
          <p className="text-sm leading-6 text-slate-600">{clinicalNotes || 'No clinical notes entered.'}</p>
        </div>
      </div>
    </Modal>
  );
}

const WIZARD_STEPS = [
  { id: 1, label: 'Patient' },
  { id: 2, label: 'Investigations' },
  { id: 3, label: 'Clinical context' },
  { id: 4, label: 'Review & submit' }
];


function OrderHeaderProgress({ step, canReach, onStepChange }) {
  return (
    <nav className="w-full" aria-label="Order progress">
      <ol className="flex max-w-4xl items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm sm:gap-2">
        {WIZARD_STEPS.map((item, index) => {
          const isCurrent = step === item.id;
          const isDone = step > item.id;
          const reachable = canReach(item.id);
          return (
            <li key={item.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => onStepChange(item.id)}
                disabled={!reachable}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 transition ${reachable ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed'}`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${isCurrent ? 'bg-clinical-600 text-white' : isDone ? 'bg-clinical-100 text-clinical-700' : 'bg-slate-100 text-slate-500'}`}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : item.id}
                </span>
                <span className={`hidden truncate text-xs font-bold sm:block ${isCurrent ? 'text-clinical-700' : isDone ? 'text-slate-700' : 'text-slate-500'}`}>{item.label}</span>
              </button>
              {index < WIZARD_STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded ${step > item.id ? 'bg-clinical-300' : 'bg-slate-200'}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PatientModeHeaderSwitch({ patientMode, onChange }) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-2 sm:max-w-[28rem] gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('existing')}
        className={`rounded-xl px-3 py-2 text-left transition ${patientMode === 'existing' ? 'bg-clinical-50 text-clinical-800 ring-1 ring-clinical-200' : 'text-slate-600 hover:bg-slate-50'}`}
      >
        <span className="block text-xs font-bold leading-4">Existing Patient</span>
        <span className="block truncate text-[10px] font-semibold leading-4 text-slate-500">Search record</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('new')}
        className={`rounded-xl px-3 py-2 text-left transition ${patientMode === 'new' ? 'bg-clinical-50 text-clinical-800 ring-1 ring-clinical-200' : 'text-slate-600 hover:bg-slate-50'}`}
      >
        <span className="block text-xs font-bold leading-4">New Patient</span>
        <span className="block truncate text-[10px] font-semibold leading-4 text-slate-500">Create record</span>
      </button>
    </div>
  );
}

export function DoctorNewOrderPage() {
  const { state, dispatch } = useAppStore();
  const { data } = state;
  const doctor = data.doctors.find((item) => item.id === state.auth?.linkedDoctorId) || data.doctors[0];
  const hospital = data.hospitals.find((item) => item.id === doctor?.hospitalId) || data.hospitals[0];
  const [patientMode, setPatientMode] = useState('existing');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [newPatient, setNewPatient] = useState(newPatientBlank);
  const [selectedItems, setSelectedItems] = useState([]);
  const [urgency, setUrgency] = useState('Routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState('');

  const systemPatients = useMemo(() => data.patients || [], [data.patients]);
  const patientMatches = systemPatients.filter((patient) => patientMatchesSearch(patient, patientSearch));
  const duplicateCandidates = findDuplicatePatients(data.patients, newPatient);
  const chosenCatalogItems = selectedItems.map((id) => data.catalog.find((item) => item.id === id)).filter(Boolean);
  const expected = selectedItems.length ? computeExpectedCompletion(new Date().toISOString(), selectedItems, data.catalog, urgency) : '';
  const selectedPatient = data.patients.find((patient) => patient.id === selectedPatientId);
  const validationIssues = [
    patientMode === 'existing' && !selectedPatientId ? 'Select an existing patient.' : '',
    patientMode === 'new' && !newPatient.fullName.trim() ? 'Enter the new patient full name.' : '',
    selectedItems.length === 0 ? 'Add at least one test or scan.' : ''
  ].filter(Boolean);

  const sameDayDuplicates = useMemo(() => {
    const patientId = patientMode === 'existing' ? selectedPatientId : '';
    if (!patientId || selectedItems.length === 0) return [];
    return (data.orders || []).filter((order) => order.patientId === patientId && order.doctorId === doctor?.id && order.status !== 'Cancelled' && isSameDay(order.createdAt) && (order.itemIds || []).some((id) => selectedItems.includes(id)));
  }, [data.orders, doctor?.id, patientMode, selectedPatientId, selectedItems]);

  // Per-step gating: a step is only "passable" once its own requirement is met.
  const step1Valid = patientMode === 'existing' ? Boolean(selectedPatientId) : Boolean(newPatient.fullName.trim());
  const step2Valid = selectedItems.length > 0;
  const canReach = (target) => target <= 1 || (target === 2 ? step1Valid : step1Valid && step2Valid);

  function goToStep(target) {
    if (!canReach(target)) return;
    setStepError('');
    setStep(target);
  }

  function goNext() {
    if (step === 1 && !step1Valid) {
      setStepError(patientMode === 'existing' ? 'Select an existing patient to continue.' : 'Enter the new patient full name to continue.');
      return;
    }
    if (step === 2 && !step2Valid) {
      setStepError('Add at least one test or scan to continue.');
      return;
    }
    setStepError('');
    setStep((current) => Math.min(WIZARD_STEPS.length, current + 1));
  }

  function goBack() {
    setStepError('');
    setStep((current) => Math.max(1, current - 1));
  }

  function toggleItem(id) {
    setSelectedItems((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  function removeItem(id) {
    setSelectedItems((current) => current.filter((itemId) => itemId !== id));
  }

  function openReview(event) {
    event.preventDefault();
    setAttemptedSubmit(true);
    // If something is missing, jump back to the step that needs attention.
    if (!step1Valid) { setStep(1); return; }
    if (!step2Valid) { setStep(2); return; }
    if (validationIssues.length) return;
    setReviewOpen(true);
  }

  function confirmSubmitOrder() {
    dispatch({
      type: 'CREATE_DOCTOR_ORDER',
      payload: {
        patientMode,
        patientId: patientMode === 'existing' ? selectedPatientId : '',
        newPatient,
        doctorId: doctor.id,
        hospitalId: hospital.id,
        itemIds: selectedItems,
        urgency,
        clinicalNotes
      }
    });
    setReviewOpen(false);
  }

  const activeStep = WIZARD_STEPS.find((item) => item.id === step) || WIZARD_STEPS[0];
  const nextStep = WIZARD_STEPS.find((item) => item.id === step + 1);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <PageHeader
        eyebrow="Clinician Portal · New Order Form"
        title="Create Test / Scan Order"
        description={step === 1 ? <PatientModeHeaderSwitch patientMode={patientMode} onChange={setPatientMode} /> : null}
        actions={null}
      />

      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 p-3 shadow-soft backdrop-blur sm:p-5">
        <div className="mb-4">
          <OrderHeaderProgress step={step} canReach={canReach} onStepChange={goToStep} />
        </div>
        <form onSubmit={openReview} className="min-h-[520px] space-y-5">
        {stepError && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{stepError}</div>
        )}

        {step === 1 && (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            {patientMode === 'existing' ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input className={`${inputClass} pl-9`} value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Search patient name, ID, phone, email..." />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Matching existing patients</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500">{patientMatches.length} found</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                    {patientMatches.map((patient) => (
                      <button key={patient.id} type="button" onClick={() => setSelectedPatientId(patient.id)} className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 transition ${selectedPatientId === patient.id ? 'bg-clinical-50 ring-2 ring-inset ring-clinical-200' : 'hover:bg-slate-50'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-slate-900">{patient.fullName}</p>
                          <p className="truncate text-xs font-semibold text-slate-500">{patient.id} · {patient.gender} · {calculateAge(patient.dateOfBirth)} yrs</p>
                        </div>
                        <div className="hidden min-w-[190px] text-right text-xs font-semibold text-slate-500 sm:block">
                          <p className="truncate">{patient.phone || 'No phone'}</p>
                          <p className="truncate">{patient.email || 'No email'}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${selectedPatientId === patient.id ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{selectedPatientId === patient.id ? 'Selected' : 'Select'}</span>
                      </button>
                    ))}
                    {patientMatches.length === 0 && <p className="p-4 text-sm font-semibold text-slate-500">No matching patients found.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Full Name"><input className={inputClass} value={newPatient.fullName} onChange={(event) => setNewPatient({ ...newPatient, fullName: event.target.value })} /></FormField>
                <FormField label="Date of Birth"><input className={inputClass} type="date" value={newPatient.dateOfBirth} onChange={(event) => setNewPatient({ ...newPatient, dateOfBirth: event.target.value })} /></FormField>
                <FormField label="Gender"><select className={inputClass} value={newPatient.gender} onChange={(event) => setNewPatient({ ...newPatient, gender: event.target.value })}><option>Female</option><option>Male</option><option>Other</option></select></FormField>
                <FormField label="Phone"><input className={inputClass} value={newPatient.phone} onChange={(event) => setNewPatient({ ...newPatient, phone: event.target.value })} /></FormField>
                <FormField label="Email"><input className={inputClass} value={newPatient.email} onChange={(event) => setNewPatient({ ...newPatient, email: event.target.value })} /></FormField>
                <FormField label="National ID / Passport"><input className={inputClass} value={newPatient.nationalId} onChange={(event) => setNewPatient({ ...newPatient, nationalId: event.target.value })} /></FormField>
                <FormField label="Address"><input className={inputClass} value={newPatient.address} onChange={(event) => setNewPatient({ ...newPatient, address: event.target.value })} /></FormField>
                <FormField label="Emergency Contact"><input className={inputClass} value={newPatient.emergencyContact} onChange={(event) => setNewPatient({ ...newPatient, emergencyContact: event.target.value })} /></FormField>
                <FormField label="Known allergies / conditions" className="md:col-span-2"><textarea className={inputClass} rows={3} value={newPatient.allergies} onChange={(event) => setNewPatient({ ...newPatient, allergies: event.target.value })} /></FormField>
                {duplicateCandidates.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 md:col-span-2">Possible duplicate patient found: {duplicateCandidates.map((p) => p.fullName).join(', ')}</div>}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <Card title="Tests / Scans" subtitle="Add multiple lab tests and scans for one patient. Clinicians cannot see prices.">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-bold text-slate-900">Selected investigations</p>
                <p className="text-sm text-slate-500">{chosenCatalogItems.length} item(s) selected · Expected completion {expected ? formatDateTime(expected) : '—'}</p>
              </div>
              <Button type="button" onClick={() => setCatalogOpen(true)}><Plus className="h-4 w-4" /> Add Test / Scan</Button>
            </div>

            {sameDayDuplicates.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex gap-2 font-bold"><AlertTriangle className="h-5 w-5" /> Same-day duplicate warning</div>
                <p className="mt-1">This patient has already been ordered for one or more of these selected investigations today. Review before submitting.</p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {chosenCatalogItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{item.name}</p><StatusBadge status={item.type} /></div>
                    <p className="text-sm text-slate-500">{item.id} · {item.department === 'Imaging' ? 'Radiology / Scan' : item.department} · ETA {item.expectedHours}h</p>
                  </div>
                  <button type="button" onClick={() => removeItem(item.id)} className="self-end rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 sm:self-auto"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {chosenCatalogItems.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500">No tests or scans selected yet.</div>}
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card title="Clinical Context" subtitle="Add urgency and notes for the receiving departments.">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Urgency"><select className={inputClass} value={urgency} onChange={(event) => setUrgency(event.target.value)}><option>Routine</option><option>Urgent</option></select></FormField>
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Expected completion</p><p className="mt-1 font-bold text-slate-900">{expected ? formatDateTime(expected) : 'Select tests/scans first'}</p></div>
              <FormField label="Clinical Notes" className="md:col-span-2"><textarea className={inputClass} rows={4} value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} placeholder="Clinical indication, patient history, and special instructions..." /></FormField>
            </div>
          </Card>
        )}

        {step === 4 && (
          <div className="space-y-5">
            {attemptedSubmit && validationIssues.length > 0 && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <p className="font-bold">Complete the order before review:</p>
                <ul className="mt-2 list-disc pl-5">
                  {validationIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}

            <Card title="Review & Submit" subtitle="Confirm the order details before sending to reception.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p>
                  <p className="mt-1 font-bold text-slate-900">{patientMode === 'existing' ? selectedPatient?.fullName || 'None selected' : newPatient.fullName || 'New patient'}</p>
                  <p className="text-sm text-slate-500">{patientMode === 'existing' ? (selectedPatient?.id || '—') : 'New patient record will be created'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinician / Hospital</p>
                  <p className="mt-1 font-bold text-slate-900">{doctor?.name}</p>
                  <p className="text-sm text-slate-500">{hospital?.name}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Urgency</p>
                  <div className="mt-1"><StatusBadge status={urgency} /></div>
                  <p className="mt-2 text-sm text-slate-500">Expected: {expected ? formatDateTime(expected) : '—'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Items</p>
                  <p className="mt-1 font-bold text-slate-900">{chosenCatalogItems.length} test/scan item(s)</p>
                  <p className="text-sm text-slate-500">Prices hidden from clinicians.</p>
                </div>
              </div>

              {chosenCatalogItems.length > 0 && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Tests / Scans</p>
                  <div className="flex flex-wrap gap-2">{chosenCatalogItems.map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{item.id} · {item.name}</span>)}</div>
                </div>
              )}

              {clinicalNotes.trim() && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Clinical notes</p>
                  <p className="text-sm leading-6 text-slate-600">{clinicalNotes}</p>
                </div>
              )}
            </Card>

            <Card title="What happens next" subtitle="Submission routes to reception and the required departments." compact>
              <ol className="space-y-2 text-sm font-semibold text-slate-600">
                <li>1. Reception confirms the order</li>
                <li>2. Routes to the lab / scan departments</li>
                <li>3. Results return to you</li>
              </ol>
              <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Price privacy: clinicians cannot view lab or scan prices. Pricing is visible only to Finance and Reception.</p>
            </Card>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <Button type="button" variant="secondary" onClick={goBack} disabled={step === 1}><ArrowLeft className="h-4 w-4" /> Back</Button>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:block">{activeStep.label}</p>
          {step < WIZARD_STEPS.length ? (
            <Button type="button" onClick={goNext}>Continue to {nextStep?.label || 'Review'} <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button type="submit"><ClipboardList className="h-4 w-4" /> Review Order</Button>
          )}
        </div>
        </form>
      </section>

      <CatalogSearchModal open={catalogOpen} onClose={() => setCatalogOpen(false)} catalog={data.catalog || []} selectedItems={selectedItems} toggleItem={toggleItem} clearItems={() => setSelectedItems([])} />
      <ReviewOrderModal open={reviewOpen} onClose={() => setReviewOpen(false)} onConfirm={confirmSubmitOrder} patient={selectedPatient} newPatient={newPatient} patientMode={patientMode} doctor={doctor} hospital={hospital} items={chosenCatalogItems} urgency={urgency} clinicalNotes={clinicalNotes} expected={expected} duplicateOrders={sameDayDuplicates} />
    </div>
  );
}
