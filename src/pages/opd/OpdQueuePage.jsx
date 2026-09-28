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
import { listItems } from '../../api/normalizers';
import { EncounterWorkspace } from './EncounterWorkspace';
import { P, QUEUE_TABS, STATUS, TRIAGE, ageLabel, can, patientName, todayIso, waitingSince } from './opdUtils';

function TriageBadge({ level }) {
  if (!level) return <span className="text-xs text-slate-500">Not triaged</span>;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${TRIAGE[level]?.className}`}>{TRIAGE[level]?.short}</span>;
}

export function OpdQueuePage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [tab, setTab] = useState(() => (can(auth, P.CONSULT) ? 'WAITING_DOCTOR' : 'WAITING_TRIAGE'));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab === 'COMPLETED' ? { status: 'COMPLETED', date: todayIso() } : { status: tab };
      setRows(listItems(await encounterService.list(apiClient, params)));
    } catch (error) {
      toast('error', error?.message || 'Visits could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

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
      <PageHeader eyebrow="Outpatient" title="OPD visits" description="Patients waiting for triage, waiting for the doctor, and in consultation." />

      <Card
        title="Visit queue"
        subtitle="Most urgent first, then longest waiting."
        actions={(
          <>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            {can(auth, P.CREATE) && <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New visit</Button>}
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

function NewVisitModal({ open, onClose, onStarted }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [complaint, setComplaint] = useState('');
  const [type, setType] = useState('OPD');
  const [fees, setFees] = useState([]);
  const [feeItemId, setFeeItemId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setResults([]);
    setPatient(null);
    setComplaint('');
    setType('OPD');
    setError('');
    encounterService.catalog(apiClient)
      .then((data) => {
        const services = listItems(data).filter((item) => item.type === 'SERVICE' && item.isActive !== false);
        setFees(services);
        setFeeItemId(services.find((s) => /consult/i.test(s.catalogCode || s.name))?.id || '');
      })
      .catch(() => setFees([]));
  }, [open]);

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
      const encounter = await encounterService.start(apiClient, {
        patientId: patient.id,
        type,
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

  return (
    <Modal
      open={open}
      title="New outpatient visit"
      description="Find the patient, then send them to triage. Register new patients at Walk-In Registration first."
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={start} disabled={!patient || saving}>{saving ? 'Starting…' : 'Send to triage'}</Button>
        </>
      )}
    >
      <div className="space-y-4">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Visit type">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="OPD">Outpatient</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </FormField>
          <FormField label="Consultation fee" help={fees.length ? undefined : 'No service items in the catalog; no fee will be charged.'}>
            <select className={inputClass} value={feeItemId} onChange={(e) => setFeeItemId(e.target.value)}>
              <option value="">No fee</option>
              {fees.map((fee) => <option key={fee.id} value={fee.id}>{fee.name} — {Number(fee.price).toFixed(2)}</option>)}
            </select>
          </FormField>
          <FormField label="Main complaint" className="sm:col-span-2">
            <input className={inputClass} maxLength={500} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Fever and headache for 3 days" />
          </FormField>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
