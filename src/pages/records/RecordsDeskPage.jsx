import { useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Search, UserRound, UsersRound } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { calculateAge, patientMatchesSearch } from '../../utils/patientUtils';

/*
  The records desk.

  Three things happen here, and nothing else: a patient is found, a new one is
  registered, or somebody is checked in for today's visit. The tabs are in that
  order because that is the order of the queue at the window - most people
  arriving are already registered.

  Membership details are captured at check-in as well as at registration,
  because that is when the card is actually in front of the clerk. Whether this
  visit goes on the scheme is asked separately from whether the patient has one:
  an insured patient still pays cash for what their scheme excludes.
*/

const VISIT_TYPES = ['Outpatient', 'Follow-up', 'Emergency', 'Review', 'Admission assessment'];

const BLANK_PATIENT = {
  fullName: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  nationalId: '',
  insuranceProvider: '',
  policyNumber: '',
  insuranceExpiresAt: '',
  insuranceVerified: false
};

const BLANK_CHECK_IN = {
  visitType: 'Outpatient',
  insuranceUsed: false,
  insuranceProvider: '',
  policyNumber: '',
  insuranceExpiresAt: '',
  insuranceVerified: false,
  reason: ''
};

/*
  Matching a patient at the window.

  The shared search covers name, hospital number, phone and the rest; the records
  desk also works from the membership card, which is often the only thing the
  patient is holding.
*/
function patientMatches(patient, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (patientMatchesSearch(patient, query)) return true;
  return [patient.policyNumber, patient.insuranceProvider]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition ${active ? 'bg-clinical-500 text-white shadow-lift' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" /> {children}
    </button>
  );
}

export function RecordsDeskPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const [tab, setTab] = useState('check-in');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [newPatient, setNewPatient] = useState(BLANK_PATIENT);
  const [checkIn, setCheckIn] = useState(BLANK_CHECK_IN);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const patients = useMemo(() => data.patients || [], [data.patients]);
  const matches = useMemo(() => patients.filter((patient) => patientMatches(patient, query)).slice(0, 25), [patients, query]);
  const patient = patients.find((candidate) => candidate.id === selectedId) || null;

  // Newest first, which is the order the desk reads them back in.
  const recent = useMemo(() => [...(data.dailyVisits || [])]
    .sort((a, b) => String(b.checkedInAt || '').localeCompare(String(a.checkedInAt || '')))
    .slice(0, 50), [data.dailyVisits]);

  function choosePatient(candidate) {
    setSelectedId(candidate.id);
    setError('');
    // Start from what is already on record, so the clerk corrects rather than retypes.
    setCheckIn({
      ...BLANK_CHECK_IN,
      insuranceProvider: candidate.insuranceProvider || '',
      policyNumber: candidate.policyNumber || '',
      insuranceUsed: Boolean(candidate.policyNumber)
    });
  }

  function submitCheckIn(event) {
    event.preventDefault();
    if (!patient) {
      setError('Select a patient first.');
      return;
    }
    if (checkIn.insuranceUsed && !checkIn.policyNumber.trim()) {
      setError('Enter the membership number to check in on insurance.');
      return;
    }
    setError('');
    setBusy(true);
    dispatch({
      type: 'RECORDS_CHECK_IN',
      payload: { ...checkIn, patientId: patient.id, patientName: patient.fullName }
    });
    window.setTimeout(() => {
      setBusy(false);
      setCheckIn(BLANK_CHECK_IN);
      setSelectedId('');
      setQuery('');
    }, 1500);
  }

  function submitRegistration(event) {
    event.preventDefault();
    if (!newPatient.fullName.trim()) {
      setError('Enter the patient’s full name.');
      return;
    }
    if (!newPatient.phone.trim() && !newPatient.nationalId.trim()) {
      setError('Enter a phone number or a national ID, so the patient can be found again.');
      return;
    }
    setError('');
    setBusy(true);
    dispatch({ type: 'REGISTER_PATIENT', payload: newPatient });
    window.setTimeout(() => {
      setBusy(false);
      setNewPatient(BLANK_PATIENT);
    }, 1500);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Records"
        title="Registration &amp; check-in"
        description="Find a patient, register a new one, or check somebody in for today's visit."
      />

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'check-in'} onClick={() => { setTab('check-in'); setError(''); }} icon={ClipboardCheck}>Check in</TabButton>
        <TabButton active={tab === 'register'} onClick={() => { setTab('register'); setError(''); }} icon={Plus}>Add new patient</TabButton>
        <TabButton active={tab === 'recent'} onClick={() => { setTab('recent'); setError(''); }} icon={UsersRound}>Recent check-ins</TabButton>
      </div>

      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

      {tab === 'check-in' && (
        <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
          <Card title="Find the patient" subtitle="By name, hospital number, phone or membership number.">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
              <input
                className={`${inputClass} pl-9`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patient..."
                aria-label="Search patient by name, hospital number, phone or membership number"
              />
            </div>
            <div className="mt-3 max-h-[26rem] space-y-1.5 overflow-y-auto">
              {matches.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => choosePatient(candidate)}
                  className={`block w-full rounded-2xl border p-3 text-left transition ${candidate.id === selectedId ? 'border-clinical-400 bg-clinical-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <span className="block truncate font-bold text-slate-900">{candidate.fullName}</span>
                  <span className="block truncate text-xs font-semibold text-slate-500">
                    {candidate.id} · {candidate.phone || 'No phone'}
                    {candidate.policyNumber ? ` · ${candidate.insuranceProvider || 'Insured'} ${candidate.policyNumber}` : ''}
                  </span>
                </button>
              ))}
              {matches.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                  <p className="text-sm font-bold text-slate-900">No patient found.</p>
                  <p className="mt-1 text-xs text-slate-500">Use &ldquo;Add new patient&rdquo; to register one.</p>
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Today's visit"
            subtitle={patient ? `Checking in ${patient.fullName}` : 'Select a patient on the left to continue.'}
          >
            {!patient ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                <UserRound className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
                <p className="mt-2 font-bold text-slate-900">Nobody selected</p>
                <p className="mt-1 text-sm text-slate-500">Find the patient first; the form opens with what is already on record.</p>
              </div>
            ) : (
              <form onSubmit={submitCheckIn} className="space-y-4">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-bold text-slate-900">{patient.fullName}</p>
                  <p className="text-sm text-slate-600">
                    {patient.id} · {patient.gender || 'Gender not recorded'}
                    {patient.dateOfBirth ? ` · ${calculateAge(patient.dateOfBirth)} yrs` : ''}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Visit type">
                    <select className={inputClass} value={checkIn.visitType} onChange={(event) => setCheckIn({ ...checkIn, visitType: event.target.value })}>
                      {VISIT_TYPES.map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </FormField>
                  <FormField label="How this visit is paid">
                    <select
                      className={inputClass}
                      value={checkIn.insuranceUsed ? 'insurance' : 'self'}
                      onChange={(event) => setCheckIn({ ...checkIn, insuranceUsed: event.target.value === 'insurance' })}
                    >
                      <option value="self">Paying directly</option>
                      <option value="insurance">On the patient&rsquo;s scheme (NHIS)</option>
                    </select>
                  </FormField>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Membership</p>
                  <div className="mt-2 grid gap-4 sm:grid-cols-3">
                    <FormField label={`Membership number${checkIn.insuranceUsed ? ' (required)' : ''}`}>
                      <input
                        className={inputClass}
                        value={checkIn.policyNumber}
                        onChange={(event) => setCheckIn({ ...checkIn, policyNumber: event.target.value })}
                        placeholder="As printed on the card"
                      />
                    </FormField>
                    <FormField label="Scheme or provider">
                      <input
                        className={inputClass}
                        value={checkIn.insuranceProvider}
                        onChange={(event) => setCheckIn({ ...checkIn, insuranceProvider: event.target.value })}
                        placeholder="NHIS"
                      />
                    </FormField>
                    <FormField label="Expires">
                      <input type="date" className={inputClass} value={checkIn.insuranceExpiresAt} onChange={(event) => setCheckIn({ ...checkIn, insuranceExpiresAt: event.target.value })} />
                    </FormField>
                  </div>
                  <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checkIn.insuranceVerified}
                      onChange={(event) => setCheckIn({ ...checkIn, insuranceVerified: event.target.checked })}
                    />
                    <span>I checked these details against the member&rsquo;s own card.</span>
                  </label>
                </div>

                <FormField label="Reason for the visit (optional)">
                  <textarea
                    className={`${inputClass} min-h-[80px]`}
                    value={checkIn.reason}
                    onChange={(event) => setCheckIn({ ...checkIn, reason: event.target.value })}
                    placeholder="What the patient has come in for today."
                  />
                </FormField>

                <Button type="submit" disabled={busy}>{busy ? 'Checking in…' : 'Check in patient'}</Button>
              </form>
            )}
          </Card>
        </div>
      )}

      {tab === 'register' && (
        <Card title="Register a new patient" subtitle="The hospital number is issued automatically.">
          <form onSubmit={submitRegistration} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name">
                <input className={inputClass} value={newPatient.fullName} onChange={(event) => setNewPatient({ ...newPatient, fullName: event.target.value })} placeholder="Patient's full name" />
              </FormField>
              <FormField label="Phone">
                <input className={inputClass} value={newPatient.phone} onChange={(event) => setNewPatient({ ...newPatient, phone: event.target.value })} placeholder="Phone number" />
              </FormField>
              <FormField label="Date of birth">
                <input type="date" className={inputClass} value={newPatient.dateOfBirth} onChange={(event) => setNewPatient({ ...newPatient, dateOfBirth: event.target.value })} />
              </FormField>
              <FormField label="Gender">
                <select className={inputClass} value={newPatient.gender} onChange={(event) => setNewPatient({ ...newPatient, gender: event.target.value })}>
                  <option value="">Not recorded</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </FormField>
              <FormField label="National ID">
                <input className={inputClass} value={newPatient.nationalId} onChange={(event) => setNewPatient({ ...newPatient, nationalId: event.target.value })} placeholder="Ghana Card or other ID" />
              </FormField>
              <FormField label="Address">
                <input className={inputClass} value={newPatient.address} onChange={(event) => setNewPatient({ ...newPatient, address: event.target.value })} />
              </FormField>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Membership (optional)</p>
              <div className="mt-2 grid gap-4 sm:grid-cols-3">
                <FormField label="Membership number">
                  <input className={inputClass} value={newPatient.policyNumber} onChange={(event) => setNewPatient({ ...newPatient, policyNumber: event.target.value })} placeholder="As printed on the card" />
                </FormField>
                <FormField label="Scheme or provider">
                  <input className={inputClass} value={newPatient.insuranceProvider} onChange={(event) => setNewPatient({ ...newPatient, insuranceProvider: event.target.value })} placeholder="NHIS" />
                </FormField>
                <FormField label="Expires">
                  <input type="date" className={inputClass} value={newPatient.insuranceExpiresAt} onChange={(event) => setNewPatient({ ...newPatient, insuranceExpiresAt: event.target.value })} />
                </FormField>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={newPatient.insuranceVerified}
                  onChange={(event) => setNewPatient({ ...newPatient, insuranceVerified: event.target.checked })}
                />
                <span>I checked these details against the member&rsquo;s own card.</span>
              </label>
            </div>

            <Button type="submit" disabled={busy}>{busy ? 'Registering…' : 'Register patient'}</Button>
          </form>
        </Card>
      )}

      {tab === 'recent' && (
        <Card title="Recent check-ins" subtitle="The latest patients taken in at this desk.">
          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="font-bold text-slate-900">No check-ins recorded yet.</p>
              <p className="mt-1 text-sm text-slate-500">They appear here as soon as somebody is checked in.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <th className="py-2 pr-3">Check-in</th>
                    <th className="py-2 pr-3">Patient</th>
                    <th className="py-2 pr-3">Visit type</th>
                    <th className="py-2 pr-3">Paid by</th>
                    <th className="py-2 pr-3">Checked in</th>
                    <th className="py-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((visit) => {
                    const named = patients.find((candidate) => candidate.id === visit.patientId);
                    return (
                      <tr key={visit.id} className="border-b border-slate-100 align-top last:border-b-0">
                        <td className="py-3 pr-3 font-bold text-slate-900">{visit.id}</td>
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-slate-900">{named?.fullName || visit.patientName || 'Unknown patient'}</p>
                          <p className="text-xs font-semibold text-slate-500">{visit.patientId}</p>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">{visit.visitType || '—'}</td>
                        <td className="py-3 pr-3">
                          <StatusBadge status={visit.insuranceUsed ? 'Insured' : 'Paying directly'} />
                        </td>
                        <td className="py-3 pr-3 text-slate-600">{visit.checkedInAt ? formatDateTime(visit.checkedInAt) : '—'}</td>
                        <td className="py-3 text-slate-600">{visit.checkedInBy || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
