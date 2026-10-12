import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BedDouble, Plus, Search } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { directoryService } from '../../services/directoryService';
import { canAccessPage } from '../../utils/permissions';
import { ageLabel, patientName } from '../opd/opdUtils';
import { COHORTS, PURPOSES, day } from './profileUtils';
import { PatientProfile } from './PatientProfile';

/*
  The Master Patient Index: every registered patient, for finding someone, following them
  up, or reviewing their history outside an active visit.

  Finding a patient shows only who they are and when they were last seen. What is in their
  record is one step further, and that step asks why and is logged - the facility can always
  show who opened a record and for what reason.
*/

const SEARCH_DELAY_MS = 300;

export function PatientsDirectoryPage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [search, setSearch] = useState('');
  const [typed, setTyped] = useState('');
  const [cohort, setCohort] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(null);
  const [opened, setOpened] = useState(null);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);
  const canRegister = canAccessPage(auth?.role, 'patients', auth?.modules, auth);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(typed.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [typed]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    directoryService.list(apiClient, { search: search || undefined, cohort: cohort || undefined, page, limit: 15 })
      .then((res) => {
        if (!live) return;
        setData(res);
        setError('');
      })
      .catch((e) => live && setError(e?.message || 'The directory could not be loaded.'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [search, cohort, page]);

  async function openRecord({ purpose, note }) {
    const row = asking;
    try {
      const chart = await directoryService.chart(apiClient, row.id, purpose, note);
      setAsking(null);
      setOpened({ row, chart, purpose, note });
    } catch (e) {
      toast('error', e?.message || 'That record could not be opened.');
    }
  }

  if (opened) {
    return <PatientProfile key={opened.row.id} row={opened.row} chart={opened.chart} purpose={opened.purpose} onClose={() => setOpened(null)} />;
  }

  const rows = data?.items || [];

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Medical records" title="Patients Directory" description="Every registered patient. Find someone, then open their record." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            className={`${inputClass} pl-10`}
            aria-label="Search patients"
            placeholder="Name, phone, date of birth, Ghana Card or NHIS number"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        {canRegister && (
          <Button variant="secondary" onClick={() => dispatch({ type: 'NAVIGATE', pageId: 'patients' })}><Plus className="h-4 w-4" /> Register new patient</Button>
        )}
      </div>

      <div role="group" aria-label="Patient groups" className="flex flex-wrap gap-2">
        {COHORTS.map((item) => (
          <button
            key={item.id || 'all'}
            type="button"
            aria-pressed={cohort === item.id}
            onClick={() => {
              setCohort(item.id);
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${cohort === item.id ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <Card><p role="alert" className="text-sm font-semibold text-red-600">{error}</p></Card>}

      <DataTable
        caption="Patients"
        rowBadge={(row) => row.patientCode}
        emptyMessage={loading ? 'Searching…' : search || cohort ? 'No patient matches that.' : 'No patients are registered yet.'}
        rows={rows}
        columns={[
          {
            key: 'patient',
            label: 'Patient details',
            mobilePrimary: true,
            render: (row) => (
              <span>
                <span className="font-semibold text-slate-900">{patientName(row)}</span>
                <span className="block text-xs text-slate-500">
                  {[row.patientCode && `ID: ${row.patientCode}`, [ageLabel(row.dateOfBirth), row.gender?.[0]].filter(Boolean).join(' ')].filter(Boolean).join(' • ')}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {row.admittedTo && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900"><BedDouble className="h-3 w-3" aria-hidden="true" /> {row.admittedTo}</span>}
                  {row.allergyCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800"><AlertTriangle className="h-3 w-3" aria-hidden="true" /> {row.allergyCount} {row.allergyCount === 1 ? 'allergy' : 'allergies'}</span>}
                  {row.chronicConditions.map((c) => <span key={c} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{c}</span>)}
                </span>
              </span>
            )
          },
          { key: 'phone', label: 'Contact', render: (row) => <span className="text-sm text-slate-700">{row.phone || '—'}</span> },
          { key: 'lastVisitAt', label: 'Last visit', render: (row) => <span className="text-sm text-slate-700">{row.lastVisitAt ? day(row.lastVisitAt) : 'No visits yet'}</span> },
          {
            key: 'action',
            label: 'Action',
            render: (row) => <Button size="sm" variant="secondary" onClick={() => setAsking(row)} aria-label={`View profile ${patientName(row)}`}>View profile</Button>
          }
        ]}
      />
      <Pagination meta={data?.meta} loading={loading} onPageChange={setPage} />

      <OpenRecordDialog row={asking} onClose={() => setAsking(null)} onOpen={openRecord} />
    </div>
  );
}

/** Opening a record is logged with its reason. This is where the reason is given. */
function OpenRecordDialog({ row, onClose, onOpen }) {
  const [purpose, setPurpose] = useState('TREATMENT');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (row) {
      setPurpose('TREATMENT');
      setNote('');
      setBusy(false);
    }
  }, [row]);
  const needsNote = purpose === 'OTHER' && note.trim().length < 3;
  return (
    <Modal
      open={Boolean(row)}
      title="Open this record"
      description={row ? `${patientName(row)} · ${row.patientCode}` : ''}
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || needsNote}
            onClick={async () => {
              setBusy(true);
              await onOpen({ purpose, note: note.trim() || undefined });
              setBusy(false);
            }}
          >
            Open record
          </Button>
        </>
      )}
    >
      <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-950">Opening a record is logged with your name and the reason you give. The patient&apos;s care team and the administrator can see who has looked.</p>
      <div className="mt-4 space-y-4">
        <FormField label="Why are you opening it?">
          <select className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {Object.entries(PURPOSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        {purpose !== 'TREATMENT' && (
          <FormField label={purpose === 'OTHER' ? 'Say why' : 'Note (optional)'} required={purpose === 'OTHER'}>
            <input className={inputClass} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        )}
      </div>
    </Modal>
  );
}
