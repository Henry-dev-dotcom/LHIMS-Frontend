import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, ClipboardList, CreditCard, FileSearch, FlaskConical, PlusCircle, Search, Send, ScanLine, UserPlus, UsersRound, X } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricCard } from '../../components/ui/MetricCard';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, getById, money } from '../../utils/formatters';
import { getOrderItems } from '../../utils/orderViews';
import { ReceptionPageTabs } from './ReceptionPageTabs';
import { ClippedList } from '../../components/ui/ClippedList';

const blankPatient = { fullName: '', dateOfBirth: '', gender: 'Female', phone: '', email: '', address: '', nationalId: '', insuranceProvider: '', policyNumber: '', emergencyContact: '', allergies: '' };
const COMMON_WALK_IN_ITEMS = ['t1', 't6', 't7', 't12', 't13', 't17', 't19'];
const REQUEST_STEPS = [
  { id: 1, label: 'Walk-in patient' },
  { id: 2, label: 'Tests / scans' },
  { id: 3, label: 'Review & submit' }
];

function catalogMatches(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.id, item.name, item.type, item.department, item.modality, item.searchText]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function isWalkInVisit(visit) {
  return visit?.walkIn || visit?.visitType === 'Walk-in' || visit?.status === 'Walk-in Registered' || (!visit?.orderId && String(visit?.notes || '').toLowerCase().includes('walk-in'));
}

export function ReceptionWalkInsPage() {
  const { state, dispatch } = useAppStore();
  const [section, setSection] = useState('register');
  const [walkIn, setWalkIn] = useState(blankPatient);
  const [query, setQuery] = useState('');
  const [requestPatientId, setRequestPatientId] = useState(state.ui.activeWalkInPatientId || '');
  const [requestVisitId, setRequestVisitId] = useState(state.ui.activeWalkInVisitId || '');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogSearchActive, setCatalogSearchActive] = useState(false);
  const [department, setDepartment] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [urgency, setUrgency] = useState('Routine');
  const [hospitalId, setHospitalId] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('Walk-in patient requested tests directly at reception.');
  const [requestStep, setRequestStep] = useState(1);
  const [requestStepError, setRequestStepError] = useState('');

  useEffect(() => {
    if (state.ui.activeWalkInPatientId) setRequestPatientId(state.ui.activeWalkInPatientId);
    if (state.ui.activeWalkInVisitId) setRequestVisitId(state.ui.activeWalkInVisitId);
    if (state.ui.activeWalkInPatientId || state.ui.activeWalkInVisitId) setSection('request');
  }, [state.ui.activeWalkInPatientId, state.ui.activeWalkInVisitId]);

  const walkInVisits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state.data.dailyVisits || [])
      .filter(isWalkInVisit)
      .map((visit) => ({ ...visit, patient: getById(state.data.patients, visit.patientId), order: getById(state.data.orders, visit.orderId) }))
      .filter((visit) => !q || [visit.id, visit.patient?.fullName, visit.patient?.phone, visit.patient?.id, visit.orderId, visit.status].filter(Boolean).join(' ').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));
  }, [state.data, query]);

  const walkInOrders = useMemo(() => {
    const walkInVisitIds = new Set((state.data.dailyVisits || []).filter(isWalkInVisit).map((visit) => visit.id));
    return (state.data.orders || [])
      .filter((order) => order.walkInRequest || walkInVisitIds.has(order.visitId))
      .map((order) => ({
        ...order,
        patient: getById(state.data.patients, order.patientId),
        items: getOrderItems(order, state.data.catalog),
        invoice: (state.data.invoices || []).find((invoice) => invoice.orderId === order.id)
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [state.data]);

  const activeVisit = walkInVisits.find((visit) => visit.id === requestVisitId) || walkInVisits.find((visit) => visit.patientId === requestPatientId);
  const selectedPatient = getById(state.data.patients, requestPatientId || activeVisit?.patientId);
  const chosenItems = selectedItems.map((id) => getById(state.data.catalog, id)).filter(Boolean);
  const totalAmount = chosenItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const labCount = chosenItems.filter((item) => item.department === 'Laboratory').length;
  const scanCount = chosenItems.filter((item) => item.department === 'Imaging').length;

  const departmentItems = useMemo(() => (state.data.catalog || [])
    .filter((item) => !department || item.department === department)
    .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name)), [state.data.catalog, department]);
  const dropdownMatches = catalogQuery.trim() ? departmentItems.filter((item) => catalogMatches(item, catalogQuery)).slice(0, 10) : [];

  const requestStep1Valid = Boolean(selectedPatient);
  const requestStep2Valid = selectedItems.length > 0;
  const activeRequestStep = REQUEST_STEPS.find((item) => item.id === requestStep) || REQUEST_STEPS[0];
  const nextRequestStep = REQUEST_STEPS.find((item) => item.id === requestStep + 1);
  const canReachRequestStep = (target) => target <= 1 || (target === 2 ? requestStep1Valid : requestStep1Valid && requestStep2Valid);

  const pageSections = [
    { id: 'summary', label: 'Summary', helper: 'Walk-in counts', icon: ClipboardCheck, tone: 'blue', count: walkInVisits.length },
    { id: 'register', label: 'Register', helper: 'New patient intake', icon: UserPlus, tone: 'purple', count: 'New' },
    { id: 'request', label: 'Request Tests', helper: 'Step-by-step order', icon: ClipboardList, tone: 'blue', count: selectedItems.length || walkInOrders.length },
    { id: 'walkins', label: 'Walk-in List', helper: 'Today’s records', icon: UsersRound, tone: 'emerald', count: walkInVisits.length },
    { id: 'duplicates', label: 'Duplicates', helper: 'Flagged matches', icon: FileSearch, tone: 'amber', count: (state.data.duplicateFlags || []).length }
  ];

  function goToRequestStep(target) {
    if (!canReachRequestStep(target)) return;
    setRequestStepError('');
    setRequestStep(target);
  }

  function goRequestNext() {
    if (requestStep === 1 && !requestStep1Valid) {
      setRequestStepError('Select a checked-in walk-in patient before choosing tests.');
      return;
    }
    if (requestStep === 2 && !requestStep2Valid) {
      setRequestStepError('Add at least one test or scan to continue.');
      return;
    }
    setRequestStepError('');
    setRequestStep((current) => Math.min(REQUEST_STEPS.length, current + 1));
  }

  function goRequestBack() {
    setRequestStepError('');
    setRequestStep((current) => Math.max(1, current - 1));
  }

  function registerWalkIn(event) {
    event.preventDefault();
    dispatch({ type: 'CREATE_WALK_IN_PATIENT', payload: walkIn });
    setWalkIn(blankPatient);
    setSelectedItems([]);
    setClinicalNotes('Walk-in patient requested tests directly at reception.');
    setRequestStep(2);
    setRequestStepError('');
    setSection('request');
  }

  function toggleItem(id) {
    setSelectedItems((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  function chooseFromDropdown(id) {
    toggleItem(id);
    setCatalogQuery('');
    setCatalogSearchActive(true);
  }

  function loadVisitForRequest(visit) {
    setRequestPatientId(visit.patientId);
    setRequestVisitId(visit.id);
    setSelectedItems([]);
    setClinicalNotes(`Walk-in request for ${visit.patient?.fullName || 'patient'} created at reception.`);
    setRequestStep(2);
    setRequestStepError('');
    setSection('request');
    dispatch({ type: 'START_WALK_IN_TEST_REQUEST', payload: { patientId: visit.patientId, visitId: visit.id } });
  }

  function submitWalkInRequest(event) {
    event.preventDefault();
    if (!requestStep1Valid) {
      setRequestStep(1);
      setRequestStepError('Select a checked-in walk-in patient before creating the request.');
      return;
    }
    if (!requestStep2Valid) {
      setRequestStep(2);
      setRequestStepError('Add at least one test or scan before creating the request.');
      return;
    }
    dispatch({
      type: 'CREATE_RECEPTION_WALK_IN_ORDER',
      payload: {
        patientId: selectedPatient?.id || requestPatientId,
        visitId: requestVisitId,
        hospitalId,
        itemIds: selectedItems,
        urgency,
        clinicalNotes
      }
    });
    if (selectedPatient && selectedItems.length > 0) {
      setSelectedItems([]);
      setCatalogQuery('');
      setDepartment('');
      setRequestStep(1);
      setSection('walkins');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Reception" title="Walk-In Registration" description="Dedicated walk-in intake page for new patient registration, direct test requests, visit creation and duplicate review." />
      <ReceptionPageTabs label="Walk-in sections" sections={pageSections} active={section} onChange={setSection} />

      {section === 'summary' && <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Walk-in visits" value={walkInVisits.length} icon={UserPlus} tone="purple" />
          <MetricCard label="Direct requests" value={walkInOrders.length} icon={ClipboardList} tone="blue" />
          <MetricCard label="Pending payment" value={walkInOrders.filter((order) => order.invoice?.status !== 'Paid').length} icon={CreditCard} tone="yellow" />
          <MetricCard label="Duplicate flags" value={(state.data.duplicateFlags || []).length} icon={Search} tone="green" />
        </div>
        <Card title="Walk-in flow" subtitle="Reception registers the patient and creates the request; lab-routed work goes straight to the diagnostic department queue without another receptionist acceptance step." compact>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['1', 'Register / check in', 'Capture demographics and create the visit record.'],
              ['2', 'Request tests', 'Choose multiple lab tests or scans from the dropdown search.'],
              ['3', 'Diagnostics + clinician return', 'Requests route directly to Lab/Scan, and final results return directly to the clinician.']
            ].map(([step, title, text]) => (
              <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-clinical-600 text-sm font-bold text-white">{step}</div>
                <p className="font-bold text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </Card>
      </>}

      {section === 'register' && <Card title="Walk-in registration form" subtitle="Create a new patient record and continue straight to direct test request in the same walk-in section." compact>
        <form onSubmit={registerWalkIn} className="grid gap-4 md:grid-cols-2">
          <FormField label="Full name"><input className={inputClass} required value={walkIn.fullName} onChange={(e) => setWalkIn({ ...walkIn, fullName: e.target.value })} /></FormField>
          <FormField label="Date of birth"><input type="date" className={inputClass} value={walkIn.dateOfBirth} onChange={(e) => setWalkIn({ ...walkIn, dateOfBirth: e.target.value })} /></FormField>
          <FormField label="Gender"><select className={inputClass} value={walkIn.gender} onChange={(e) => setWalkIn({ ...walkIn, gender: e.target.value })}><option>Female</option><option>Male</option><option>Other</option></select></FormField>
          <FormField label="Phone"><input className={inputClass} value={walkIn.phone} onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })} /></FormField>
          <FormField label="Email"><input className={inputClass} value={walkIn.email} onChange={(e) => setWalkIn({ ...walkIn, email: e.target.value })} /></FormField>
          <FormField label="National ID / Passport"><input className={inputClass} value={walkIn.nationalId} onChange={(e) => setWalkIn({ ...walkIn, nationalId: e.target.value })} /></FormField>
          <FormField label="Insurance Provider"><input className={inputClass} value={walkIn.insuranceProvider} onChange={(e) => setWalkIn({ ...walkIn, insuranceProvider: e.target.value })} /></FormField>
          <FormField label="Policy No."><input className={inputClass} value={walkIn.policyNumber} onChange={(e) => setWalkIn({ ...walkIn, policyNumber: e.target.value })} /></FormField>
          <div className="md:col-span-2"><FormField label="Address"><input className={inputClass} value={walkIn.address} onChange={(e) => setWalkIn({ ...walkIn, address: e.target.value })} /></FormField></div>
          <div className="md:col-span-2"><FormField label="Allergy / known conditions notes"><textarea className={inputClass} rows="3" value={walkIn.allergies} onChange={(e) => setWalkIn({ ...walkIn, allergies: e.target.value })} /></FormField></div>
          <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row">
            <Button type="submit"><UserPlus className="h-4 w-4" /> Register Walk-in & Request Tests</Button>
            <Button type="button" variant="secondary" onClick={() => { setRequestStep(1); setSection('request'); }}><ClipboardList className="h-4 w-4" /> Request for Existing Walk-in</Button>
          </div>
        </form>
      </Card>}

      {section === 'request' && <form onSubmit={submitWalkInRequest} className="mx-auto w-full max-w-5xl space-y-5">
        <section className="overflow-visible rounded-[2rem] border border-slate-200/80 bg-white/80 p-3 shadow-soft backdrop-blur sm:p-5">
          <div className="mb-4 flex flex-col gap-3 rounded-[1.5rem] bg-clinical-25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-clinical-600">Walk-in request workspace</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{activeRequestStep.label}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Only one request window is shown at a time. Continue moves the receptionist through the same Walk-in Request section without stacking all forms on the screen.</p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">Step {requestStep} of {REQUEST_STEPS.length}</span>
          </div>

          <nav aria-label="Walk-in request progress">
            <ol className="flex items-center gap-1 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm sm:gap-2 sm:p-3">
              {REQUEST_STEPS.map((item, index) => {
                const isCurrent = requestStep === item.id;
                const isDone = requestStep > item.id;
                const reachable = canReachRequestStep(item.id);
                return (
                  <li key={item.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => goToRequestStep(item.id)}
                      disabled={!reachable}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`flex min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 transition sm:px-3 ${reachable ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed'}`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${isCurrent ? 'bg-clinical-600 text-white' : isDone ? 'bg-clinical-100 text-clinical-700' : 'bg-slate-100 text-slate-500'}`}>
                        {isDone ? <CheckCircle2 className="h-5 w-5" /> : item.id}
                      </span>
                      <span className={`hidden truncate text-sm font-bold sm:block ${isCurrent ? 'text-clinical-700' : isDone ? 'text-slate-700' : 'text-slate-500'}`}>{item.label}</span>
                    </button>
                    {index < REQUEST_STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded ${requestStep > item.id ? 'bg-clinical-300' : 'bg-slate-200'}`} />}
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="mt-5 min-h-[460px] space-y-5">
            {requestStepError && <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{requestStepError}</div>}

            {requestStep === 1 && <Card title="Select checked-in walk-in patient" subtitle="After registration, this form automatically loads the new patient. You can also choose another walk-in visit from today." compact>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Walk-in visit">
                  <select className={inputClass} value={requestVisitId} onChange={(event) => {
                    const visit = walkInVisits.find((item) => item.id === event.target.value);
                    setRequestVisitId(event.target.value);
                    setRequestPatientId(visit?.patientId || '');
                    setRequestStepError('');
                  }}>
                    <option value="">Choose checked-in walk-in visit</option>
                    {walkInVisits.map((visit) => <option key={visit.id} value={visit.id}>{visit.id} — {visit.patient?.fullName || visit.patientId}{visit.orderId ? ` · ${visit.orderId}` : ''}</option>)}
                  </select>
                </FormField>
                <FormField label="Selected patient"><input className={inputClass} readOnly value={selectedPatient ? `${selectedPatient.fullName} — ${selectedPatient.id}` : 'No walk-in selected'} /></FormField>
                <FormField label="Urgency"><select className={inputClass} value={urgency} onChange={(event) => setUrgency(event.target.value)}><option>Routine</option><option>Urgent</option></select></FormField>
                <FormField label="Partner / referring hospital (optional)"><select className={inputClass} value={hospitalId} onChange={(event) => setHospitalId(event.target.value)}><option value="">Direct walk-in / no partner</option>{(state.data.hospitals || []).map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}</select></FormField>
              </div>
            </Card>}

            {requestStep === 2 && <Card title="Select requested lab tests or scans" subtitle="Search results drop directly under the search bar. Selected requests appear as removable chips below." compact>
              <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
                <div className="relative z-30">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    className={`${inputClass} pl-9`}
                    value={catalogQuery}
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    onFocus={() => setCatalogSearchActive(true)}
                    onBlur={() => window.setTimeout(() => setCatalogSearchActive(false), 120)}
                    placeholder="Search FBC, glucose, ultrasound, X-ray..."
                    aria-label="Search test and scan catalog"
                  />

                  {catalogSearchActive && catalogQuery.trim() && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-80 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl">
                      <div className="mb-2 flex items-center justify-between px-2 py-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Search results</p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">{dropdownMatches.length} shown</span>
                      </div>

                      {dropdownMatches.map((item) => {
                        const selected = selectedItems.includes(item.id);
                        const DepartmentIcon = item.department === 'Imaging' ? ScanLine : FlaskConical;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(event) => { event.preventDefault(); chooseFromDropdown(item.id); }}
                            className={`flex w-full flex-col gap-2 rounded-2xl px-3 py-3 text-left transition sm:flex-row sm:items-center sm:justify-between ${selected ? 'bg-clinical-50 ring-2 ring-clinical-200' : 'hover:bg-slate-50'}`}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <DepartmentIcon className={`h-4 w-4 ${selected ? 'text-clinical-700' : 'text-slate-500'}`} />
                                <p className="truncate font-bold text-slate-900">{item.name}</p>
                                <StatusBadge status={item.type} />
                              </div>
                              <p className="mt-1 text-xs font-semibold text-slate-500">{item.id} · {item.department === 'Imaging' ? item.modality || 'Imaging' : 'Laboratory'} · ETA {item.expectedHours}h · {money(item.price)}</p>
                            </div>
                            <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${selected ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{selected ? 'Added' : 'Add'}</span>
                          </button>
                        );
                      })}

                      {dropdownMatches.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No catalog item matches your search.</p>}
                    </div>
                  )}
                </div>
                <select className={inputClass} value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter catalog by department">
                  <option value="">Lab and Scan</option>
                  <option value="Laboratory">Laboratory only</option>
                  <option value="Imaging">Scan / Imaging only</option>
                </select>
              </div>

              <div className="mb-4 rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Common walk-in requests</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COMMON_WALK_IN_ITEMS.map((id) => getById(state.data.catalog, id)).filter(Boolean).map((item) => (
                    <button key={item.id} type="button" onClick={() => toggleItem(item.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${selectedItems.includes(item.id) ? 'bg-clinical-600 text-white ring-clinical-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-clinical-50 hover:text-clinical-700'}`}>
                      {selectedItems.includes(item.id) ? 'Added · ' : ''}{item.name}
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
                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{chosenItems.length} selected</span>
                </div>

                {chosenItems.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {chosenItems.map((item) => (
                      <button key={item.id} type="button" onClick={() => toggleItem(item.id)} className="inline-flex items-center gap-2 rounded-full bg-clinical-50 px-3 py-1.5 text-xs font-bold text-clinical-700 ring-1 ring-clinical-200 hover:bg-red-50 hover:text-red-600 hover:ring-red-200" title="Remove selected item">
                        {item.id} · {item.name} · {money(item.price)}
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                ) : <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">No tests or scans selected yet.</p>}
              </div>
            </Card>}

            {requestStep === 3 && <div className="space-y-5">
              <Card title="Request summary" subtitle="Confirm the selected items before creating the walk-in order and invoice." compact>
                <div className="space-y-4">
                  {!selectedPatient && <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-800">Select or register a walk-in patient first.</div>}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-lg font-bold text-slate-900">{chosenItems.length}</p><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Items</p></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-lg font-bold text-slate-900">{labCount}</p><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Lab</p></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-lg font-bold text-slate-900">{scanCount}</p><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Scan</p></div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="mt-1 font-bold text-slate-900">{selectedPatient?.fullName || '—'}</p><p className="text-sm text-slate-500">{selectedPatient?.id || 'No walk-in selected'}</p></div>
                    <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Estimated invoice total</p><p className="mt-1 text-2xl font-bold text-slate-900">{money(totalAmount)}</p></div>
                  </div>
                  <div className="space-y-2">
                    {chosenItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3"><div><p className="text-sm font-bold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.department} · {money(item.price)}</p></div><button type="button" onClick={() => toggleItem(item.id)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-100">Remove</button></div>)}
                    {chosenItems.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No tests selected yet.</p>}
                  </div>
                  <FormField label="Clinical / reception notes"><textarea className={inputClass} rows="4" value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} /></FormField>
                  <p className="rounded-2xl bg-clinical-50 p-3 text-xs font-semibold leading-5 text-clinical-800">After submission, lab items appear in the diagnostic department queue immediately. Final results are released directly to the clinician/result dashboard without reception needing to push them.</p>
                </div>
              </Card>
            </div>}

            <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <Button type="button" variant="secondary" onClick={goRequestBack} disabled={requestStep === 1}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <p className="hidden text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:block">{activeRequestStep.label}</p>
              {requestStep < REQUEST_STEPS.length ? (
                <Button type="button" onClick={goRequestNext}>Continue to {nextRequestStep?.label || 'Review'} <ArrowRight className="h-4 w-4" /></Button>
              ) : (
                <Button type="submit" disabled={!selectedPatient || selectedItems.length === 0}><Send className="h-4 w-4" /> Create Walk-in Test Request</Button>
              )}
            </div>
          </div>
        </section>
      </form>}

      {section === 'walkins' && <div className="space-y-5">
        <Card title="Registered walk-ins" subtitle="Walk-ins are separated from normal check-in so reception can continue directly to test requests." compact actions={<input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search walk-in patient or visit ID" aria-label="Search registered walk-ins" />}>
          <DataTable
            columns={[
              { key: 'id', label: 'Visit ID', render: (row) => <span className="font-bold text-slate-900">{row.id}</span> },
              { key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName || '—'}</p><p className="text-xs text-slate-500">{row.patient?.id} · {row.patient?.phone || 'No phone'}</p></div> },
              { key: 'orderId', label: 'Request', render: (row) => row.orderId ? <div><span className="font-bold text-slate-900">{row.orderId}</span>{row.orderIds?.length > 1 && <p className="text-xs font-bold text-slate-500">+{row.orderIds.length - 1} more request(s)</p>}</div> : <span className="text-sm font-bold text-slate-500">Not requested</span> },
              { key: 'identityVerified', label: 'Identity', render: (row) => <StatusBadge status={row.identityVerified ? 'Verified' : 'Not verified'} /> },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'checkedInAt', label: 'Registered', render: (row) => formatDateTime(row.checkedInAt) },
              { key: 'actions', label: 'Action', render: (row) => <Button variant={row.orderId ? 'secondary' : 'primary'} onClick={() => loadVisitForRequest(row)}><PlusCircle className="h-4 w-4" /> {row.orderId ? 'Add More Tests' : 'Request Tests'}</Button> }
            ]}
            rows={walkInVisits}
            emptyMessage="No walk-ins match this filter."
          />
        </Card>

        <Card title="Walk-in test requests" subtitle="Direct requests created by reception from the walk-in section and routed to diagnostics." compact>
          <DataTable
            columns={[
              { key: 'id', label: 'Order', render: (row) => <span className="font-bold text-slate-900">{row.id}</span> },
              { key: 'patient', label: 'Patient', render: (row) => <div><p className="font-bold text-slate-900">{row.patient?.fullName || '—'}</p><p className="text-xs text-slate-500">{row.patient?.id}</p></div> },
              { key: 'items', label: 'Requested Items', render: (row) => <ClippedList items={row.items} /> },
              { key: 'status', label: 'Order Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'billing', label: 'Billing', render: (row) => <StatusBadge status={row.invoice?.status || row.billingStatus || 'Pending'} /> },
              { key: 'amount', label: 'Amount', render: (row) => money(row.invoice?.amount || row.invoice?.total || 0) },
              { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) }
            ]}
            rows={walkInOrders}
            emptyMessage="No walk-in test requests have been created yet."
          />
        </Card>
      </div>}

      {section === 'duplicates' && <Card title="Duplicate resolution queue" subtitle="Flagged records remain visible here for reception and admin review." compact>
        <DataTable
          columns={[
            { key: 'id', label: 'Flag' },
            { key: 'patientId', label: 'Patient' },
            { key: 'possibleDuplicateId', label: 'Possible Duplicate' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) }
          ]}
          rows={state.data.duplicateFlags || []}
          emptyMessage="No duplicate flags yet."
        />
      </Card>}
    </div>
  );
}
