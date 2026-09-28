import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw, Search, Stethoscope } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';
import { isProcedureItem } from '../../services/theatreService';
import { listItems } from '../../api/normalizers';
import { EncounterWorkspace } from './EncounterWorkspace';
import { P, QUEUE_TABS, STATUS, TRIAGE, ageLabel, can, patientName, todayIso, waitingSince } from './opdUtils';

function TriageBadge({ level }) {
  if (!level) return <span className="text-xs text-slate-500">Not triaged</span>;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${TRIAGE[level]?.className}`}>{TRIAGE[level]?.short}</span>;
}

/** The emergency department board: the same visit workflow, emergency visits only. */
export function EmergencyBoardPage() {
  return <OpdQueuePage mode="EMERGENCY" />;
}

export function OpdQueuePage({ mode = 'OPD' }) {
  const emergency = mode === 'EMERGENCY';
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  // In the ED everyone starts at triage, where new arrivals land.
  const [tab, setTab] = useState(() => (!emergency && can(auth, P.CONSULT) ? 'WAITING_DOCTOR' : 'WAITING_TRIAGE'));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab === 'COMPLETED' ? { status: 'COMPLETED', date: todayIso() } : { status: tab };
      setRows(listItems(await encounterService.list(apiClient, { ...params, type: mode })));
    } catch (error) {
      toast('error', error?.message || 'Visits could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [tab, toast, mode]);

  useEffect(() => {
    if (!openId) load();
  }, [load, openId]);

  if (openId) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => setOpenId('')}><ArrowLeft className="h-4 w-4" /> Back to visits</Button>
        <EncounterWorkspace encounterId={openId} onChanged={() => {}} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={emergency ? 'Emergency' : 'Outpatient'}
        title={emergency ? 'Emergency board' : 'OPD visits'}
        description={emergency ? 'Emergency arrivals by triage colour: red first, then longest waiting.' : 'Patients waiting for triage, waiting for the doctor, and in consultation.'}
      />

      <Card
        title="Visit queue"
        subtitle="Most urgent first, then longest waiting."
        actions={(
          <>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            {can(auth, P.CREATE) && <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> {emergency ? 'Emergency arrival' : 'New visit'}</Button>}
          </>
        )}
      >
        <div role="tablist" aria-label="Visit stage" className="mb-4 flex flex-wrap gap-2">
          {QUEUE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === item.id ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <DataTable
          caption="Visits"
          emptyMessage={loading ? 'Loading visits…' : 'No patients at this stage.'}
          rows={rows}
          columns={[
            { key: 'patient', label: 'Patient', mobilePrimary: true, render: (row) => (
              <span>
                <span className="font-semibold text-slate-900">{patientName(row.patient)}</span>
                <span className="block text-xs text-slate-500">{row.patient?.patientCode} {ageLabel(row.patient?.dateOfBirth) && `· ${ageLabel(row.patient.dateOfBirth)}`} {row.patient?.gender && `· ${row.patient.gender}`}</span>
              </span>
            ) },
            { key: 'triageLevel', label: 'Triage', render: (row) => <TriageBadge level={row.triageLevel} /> },
            { key: 'chiefComplaint', label: 'Complaint', render: (row) => row.chiefComplaint || '—' },
            { key: 'status', label: 'Stage', render: (row) => STATUS[row.status] || row.status },
            { key: 'startedAt', label: tab === 'COMPLETED' ? 'Arrived' : 'Waiting', render: (row) => (tab === 'COMPLETED' ? new Date(row.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : waitingSince(row.startedAt)) },
            { key: 'attending', label: 'Clinician', render: (row) => row.attending?.name || '—' },
            { key: 'actions', label: 'Actions', render: (row) => <Button size="sm" onClick={() => setOpenId(row.id)}><Stethoscope className="h-3.5 w-3.5" /> Open</Button> }
          ]}
        />
      </Card>

      <NewVisitModal
        mode={mode}
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onStarted={(encounter) => {
          setNewOpen(false);
          toast('success', `${encounter.encounterCode} started for ${patientName(encounter.patient)}.`);
          setTab('WAITING_TRIAGE');
          load();
        }}
      />
    </div>
  );
}

function NewVisitModal({ mode = 'OPD', open, onClose, onStarted }) {
  const emergency = mode === 'EMERGENCY';
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [unidentified, setUnidentified] = useState(false);
  const [quick, setQuick] = useState({ firstName: '', lastName: '', gender: 'UNKNOWN', estimatedAgeYears: '', triageLevel: '' });
  const [complaint, setComplaint] = useState('');
  const [fees, setFees] = useState([]);
  const [feeItemId, setFeeItemId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setResults([]);
    setPatient(null);
    setUnidentified(false);
    setQuick({ firstName: '', lastName: '', gender: 'UNKNOWN', estimatedAgeYears: '', triageLevel: '' });
    setComplaint('');
    setError('');
    encounterService.catalog(apiClient)
      .then((data) => {
        const services = listItems(data).filter((item) => item.type === 'SERVICE' && item.isActive !== false && !isProcedureItem(item));
        setFees(services);
        // Emergency care is not held up for payment; the fee can be added later.
        setFeeItemId(emergency ? '' : services.find((s) => /consult/i.test(s.catalogCode || s.name))?.id || '');
      })
      .catch(() => setFees([]));
  }, [open, emergency]);

  async function find(event) {
    event.preventDefault();
    if (search.trim().length < 2) return;
    try {
      setResults(listItems(await encounterService.searchPatients(apiClient, search.trim())));
    } catch (e) {
      setError(e?.message || 'Search failed.');
    }
  }

  async function start() {
    setSaving(true);
    setError('');
    try {
      const encounter = unidentified
        ? await encounterService.registerEmergency(apiClient, {
            firstName: quick.firstName.trim() || undefined,
            lastName: quick.lastName.trim() || undefined,
            gender: quick.gender,
            estimatedAgeYears: quick.estimatedAgeYears === '' ? undefined : Number(quick.estimatedAgeYears),
            chiefComplaint: complaint.trim(),
            triageLevel: quick.triageLevel || undefined,
            feeItemId: feeItemId || undefined
          })
        : await encounterService.start(apiClient, {
            patientId: patient.id,
            type: mode,
            chiefComplaint: complaint.trim() || undefined,
            feeItemId: feeItemId || undefined
          });
      onStarted(encounter);
    } catch (e) {
      setError(e?.message || 'The visit could not be started.');
    } finally {
      setSaving(false);
    }
  }

  const ready = unidentified ? complaint.trim().length >= 2 : Boolean(patient);
  const setQ = (key) => (e) => setQuick((c) => ({ ...c, [key]: e.target.value }));

  return (
    <Modal
      open={open}
      title={emergency ? 'Emergency arrival' : 'New outpatient visit'}
      description={emergency
        ? 'Find the patient, or register them now if they cannot be identified; correct the record later.'
        : 'Find the patient, then send them to triage. Register new patients at Walk-In Registration first.'}
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={start} disabled={!ready || saving}>{saving ? 'Starting…' : emergency ? 'Add to board' : 'Send to triage'}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        {emergency && (
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" className="h-4 w-4 accent-clinical-600" checked={unidentified} onChange={(e) => { setUnidentified(e.target.checked); setPatient(null); }} />
            Patient cannot be identified or is not registered
          </label>
        )}

        {unidentified ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="First name (if known)"><input className={inputClass} value={quick.firstName} onChange={setQ('firstName')} maxLength={80} /></FormField>
            <FormField label="Surname (if known)"><input className={inputClass} value={quick.lastName} onChange={setQ('lastName')} maxLength={80} /></FormField>
            <FormField label="Sex">
              <select className={inputClass} value={quick.gender} onChange={setQ('gender')}>
                <option value="UNKNOWN">Unknown</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>
            <FormField label="Estimated age (years)"><input type="number" min="0" max="120" className={inputClass} value={quick.estimatedAgeYears} onChange={setQ('estimatedAgeYears')} /></FormField>
            <FormField label="Triage on arrival" className="sm:col-span-2">
              <select className={inputClass} value={quick.triageLevel} onChange={setQ('triageLevel')}>
                <option value="">Triage later</option>
                {Object.entries(TRIAGE).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
              </select>
            </FormField>
          </div>
        ) : (
          <>
            <form onSubmit={find} className="flex gap-2">
              <label className="sr-only" htmlFor="opd-patient-search">Search patients</label>
              <input id="opd-patient-search" className={inputClass} placeholder="Name, patient number or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button type="submit" variant="secondary"><Search className="h-4 w-4" /> Find</Button>
            </form>
            {results.length > 0 && !patient && (
              <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200">
                {results.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="w-full px-4 py-3 text-left hover:bg-slate-50" onClick={() => setPatient(p)}>
                      <span className="font-semibold text-slate-900">{patientName(p)}</span>
                      <span className="block text-xs text-slate-500">{p.patientCode} {p.phone && `· ${p.phone}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {patient && (
              <div className="flex items-center justify-between rounded-2xl bg-clinical-50 px-4 py-3">
                <span>
                  <span className="font-semibold text-slate-900">{patientName(patient)}</span>
                  <span className="block text-xs text-slate-600">{patient.patientCode}</span>
                </span>
                <button type="button" className="text-sm font-semibold text-clinical-700 hover:underline" onClick={() => setPatient(null)}>Change</button>
              </div>
            )}
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={emergency ? 'Reason for attending' : 'Main complaint'} required={unidentified} className="sm:col-span-2">
            <input className={inputClass} maxLength={500} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder={emergency ? 'e.g. Road traffic accident, head injury' : 'e.g. Fever and headache for 3 days'} />
          </FormField>
          <FormField label="Consultation fee" help={fees.length ? undefined : 'No service items in the catalog; no fee will be charged.'}>
            <select className={inputClass} value={feeItemId} onChange={(e) => setFeeItemId(e.target.value)}>
              <option value="">No fee</option>
              {fees.map((fee) => <option key={fee.id} value={fee.id}>{fee.name} — {Number(fee.price).toFixed(2)}</option>)}
            </select>
          </FormField>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
