import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';
import { ClinicianWorkspace } from './ClinicianWorkspace';
import { P, TRIAGE, ageLabel, can, patientName, waitingSince } from '../opd/opdUtils';

/*
  The clinician's queue.

  Patients do not vanish when they are sent for tests: they move between lists.
    New Patients     triaged and waiting for a doctor
    Pending Labs     sent for tests; still in the building, not yet back
    Review Ready     every test is back - the doctor can finish the visit
    My Consultations seen by this doctor and not paused

  Which list a patient is in is decided by the server from the state of their tests
  (see the backend's queueState), so a result being withdrawn puts the patient back
  under Pending Labs without anything here having to notice.
*/

const REFRESH_MS = 30_000;

const TABS = [
  { id: 'new', label: 'New Patients', empty: 'No patients are waiting for a doctor.' },
  { id: 'pendingLabs', label: 'Pending Labs', empty: 'No patients are out for tests.' },
  { id: 'reviewReady', label: 'Review Ready', empty: 'No results are waiting for your review.', alert: true },
  { id: 'inConsultation', label: 'My Consultations', empty: 'You have no consultations open.' }
];

const minutesSince = (value) => (value ? Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)) : 0);

/** The longer someone has waited, the louder the number: it is a queue, and the oldest should be seen. */
function waitClass(minutes) {
  if (minutes >= 45) return 'text-red-600';
  if (minutes >= 20) return 'text-amber-600';
  return 'text-slate-600';
}

function TriageDot({ level }) {
  if (!level) return null;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${TRIAGE[level]?.className}`}>{TRIAGE[level]?.short}</span>;
}

function ResultPriorityBadge({ priority }) {
  const options = {
    CRITICAL: { label: 'Critical result', className: 'bg-red-700 text-white motion-safe:animate-pulse' },
    ABNORMAL: { label: 'Abnormal result', className: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' },
    NORMAL: { label: 'Normal results', className: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300' },
    UNCLASSIFIED: { label: 'Result severity unavailable', className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300' }
  };
  const option = options[priority];
  if (!option) return null;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${option.className}`}>{option.label}</span>;
}

export function ClinicianQueuePage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const canConsult = can(auth, P.CONSULT);
  const canOrder = can(auth, P.ORDER);
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('new');
  const [busyId, setBusyId] = useState('');
  const [open, setOpen] = useState(null);
  const readyIds = useRef(null);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const data = await encounterService.queue(apiClient);
      setQueue(data);
      setError('');
      // Tell the doctor when results come back while they are busy with someone else.
      const nowReady = new Set((data.reviewReady || []).map((row) => row.id));
      if (readyIds.current) {
        const fresh = (data.reviewReady || []).filter((row) => !readyIds.current.has(row.id));
        for (const row of fresh) toast('info', `Results are back for ${patientName(row.patient)}.`);
      }
      readyIds.current = nowReady;
    } catch (e) {
      if (!quiet) setError(e?.message || 'The queue could not be loaded.');
    }
  }, [toast]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !open) load({ quiet: true });
    }, REFRESH_MS);
    const onFocus = () => !open && load({ quiet: true });
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load, open]);

  /** Opens a patient's visit, first starting the consultation or taking a paused visit back where that applies. */
  const openVisit = useCallback(async (row, { initialTab, forceResume = false } = {}) => {
    setBusyId(row.id);
    try {
      if (row.queueState === 'NEW') await encounterService.startConsultation(apiClient, row.id);
      if (row.queueState === 'REVIEW_READY') await encounterService.resume(apiClient, row.id);
      if (row.queueState === 'PENDING_LABS' && forceResume) await encounterService.resume(apiClient, row.id);
      // Results are what a Review Ready doctor came for, so that is the first thing they see.
      setOpen({ id: row.id, tab: initialTab || (row.queueState === 'REVIEW_READY' ? 'investigations' : 'consultation') });
    } catch (e) {
      toast('error', e?.message || 'That visit could not be opened.');
      load({ quiet: true });
    } finally {
      setBusyId('');
    }
  }, [load, toast]);

  if (open) {
    return (
      <ClinicianWorkspace
        key={open.id}
        encounterId={open.id}
        initialTab={open.tab}
        onClose={() => {
          setOpen(null);
          load({ quiet: true });
        }}
      />
    );
  }

  const counts = queue?.counts || {};
  const rows = queue?.[tab] || [];
  const active = TABS.find((item) => item.id === tab);

  const actionLabel = { new: 'Consult', pendingLabs: 'Open', reviewReady: 'Review results', inConsultation: 'Continue' }[tab];

  const columns = [
    {
      key: 'patient',
      label: 'Patient',
      mobilePrimary: true,
      render: (row) => (
        <span>
          <span className="font-semibold text-slate-900">{patientName(row.patient)}</span>
          <span className="block text-xs text-slate-500">
            {[row.patient?.patientCode && `ID: ${row.patient.patientCode}`, [ageLabel(row.patient?.dateOfBirth), row.patient?.gender?.[0]].filter(Boolean).join(' ')].filter(Boolean).join(' • ')}
          </span>
        </span>
      )
    },
    {
      key: 'chiefComplaint',
      label: 'Complaint',
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-800">{row.chiefComplaint || 'No complaint recorded'}</span>
          <TriageDot level={row.triageLevel} />
          {tab === 'reviewReady' && <ResultPriorityBadge priority={row.resultPriority} />}
        </span>
      )
    }
  ];

  if (tab === 'pendingLabs' || tab === 'reviewReady') {
    columns.push({
      key: 'tests',
      label: 'Tests',
      render: (row) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{row.tests.ready} of {row.tests.total} back</span>
          {row.tests.outstanding.length > 0 && <span className="block text-xs text-slate-500">Waiting on {row.tests.outstanding.slice(0, 2).join(', ')}{row.tests.outstanding.length > 2 ? ` +${row.tests.outstanding.length - 2} more` : ''}</span>}
        </span>
      )
    });
  }

  columns.push({
    key: 'wait',
    label: tab === 'new' ? 'Wait time' : tab === 'inConsultation' ? 'Seen for' : 'Sent for tests',
    render: (row) => {
      const since = tab === 'new' ? row.triagedAt || row.startedAt : tab === 'inConsultation' ? row.consultationStartedAt || row.startedAt : row.suspendedAt;
      return <span className={`text-sm font-medium ${tab === 'new' ? waitClass(minutesSince(since)) : 'text-slate-600'}`}>{waitingSince(since)}</span>;
    }
  });

  columns.push({
    key: 'action',
    label: 'Action',
    render: (row) => tab === 'pendingLabs' ? (
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={busyId === row.id || (!canConsult && tab !== 'pendingLabs')}
          onClick={() => openVisit(row)}
          aria-label={`Open ${patientName(row.patient)}`}
        >
          Open
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busyId === row.id || !canOrder}
          onClick={() => openVisit(row, { initialTab: 'investigations' })}
          aria-label={`Add tests for ${patientName(row.patient)}`}
        >
          Add tests
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busyId === row.id || !canConsult}
          onClick={() => openVisit(row, { forceResume: true })}
          aria-label={`Force resume ${patientName(row.patient)}`}
        >
          Force resume
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled
          title="Lab messaging requires a backend endpoint that is not available yet."
          aria-label={`Ping lab ${patientName(row.patient)} (not connected)`}
        >
          Ping lab
        </Button>
      </div>
    ) : (
      <Button
        size="sm"
        variant={tab === 'reviewReady' ? 'primary' : 'secondary'}
        disabled={busyId === row.id || (!canConsult && tab !== 'pendingLabs')}
        onClick={() => openVisit(row)}
        aria-label={`${actionLabel} ${patientName(row.patient)}`}
      >
        {busyId === row.id ? 'Opening…' : actionLabel}
      </Button>
    )
  });

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Clinician" title="Clinician Queue" description="Patients waiting for you, out for tests, or ready for you to review." />

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200">
        <div role="tablist" aria-label="Queue" className="-mb-px flex flex-wrap gap-x-2">
          {TABS.map((item) => {
            const selected = tab === item.id;
            const count = counts[item.id] ?? 0;
            const glowing = item.alert && count > 0;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`queue-tab-${item.id}`}
                aria-selected={selected}
                aria-controls="queue-panel"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${selected ? 'border-clinical-500 text-clinical-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {item.label}
                {glowing ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-300 px-2 py-0.5 text-xs font-bold text-yellow-950 shadow-[0_0_0_3px_rgba(250,204,21,0.35)] motion-safe:animate-pulse">
                    <BellRing className="h-3 w-3" aria-hidden="true" />
                    <span aria-label={`${count} ready for review`}>{count}</span>
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{queue ? count : '–'}</span>
                )}
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="sm" onClick={() => load()} aria-label="Refresh the queue" className="mb-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
        </Button>
      </div>

      {error && <Card><p role="alert" className="text-sm font-semibold text-red-600">{error}</p></Card>}

      {tab === 'pendingLabs' && <p role="note" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">You can add tests or resume a visit using the existing workflows. Lab messaging is not connected yet.</p>}

      <div id="queue-panel" role="tabpanel" aria-labelledby={`queue-tab-${tab}`} aria-live="polite">
        <DataTable
          caption={active.label}
          rowBadge={(row) => row.encounterCode}
          emptyMessage={queue ? active.empty : 'Loading the queue…'}
          rows={rows}
          columns={columns}
        />
      </div>
    </div>
  );
}
