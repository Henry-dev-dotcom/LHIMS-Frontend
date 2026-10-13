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
  Needs attention: patients waiting for a doctor and consultations in progress
  Awaiting results: visits sent for diagnostic tests
  Ready to review: all results are back and need clinician review

  Which list a patient is in is decided by the server from the state of their tests
  (see the backend's queueState), so a result being withdrawn puts the patient back
    under Pending Diagnosis without anything here having to notice.
*/

const REFRESH_MS = 30_000;

const TABS = [
  { id: 'needsAttention', label: 'Needs attention', empty: 'No patients are waiting and no consultations are in progress.' },
  { id: 'awaitingResults', label: 'Awaiting results', empty: 'No patients are waiting for diagnostic results.' },
  { id: 'reviewReady', label: 'Ready to review', empty: 'No results are waiting for your review.', alert: true }
];

const minutesSince = (value) => (value ? Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)) : 0);
const compactTestCount = (value) => {
  const count = Number(value) || 0;
  return count > 999 ? `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k` : String(count);
};

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
  const [tab, setTab] = useState('needsAttention');
  const [busyId, setBusyId] = useState('');
  const [pingingId, setPingingId] = useState('');
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

  const pingDiagnostics = useCallback(async (row) => {
    setPingingId(row.id);
    try {
      const result = await encounterService.pingDiagnostics(apiClient, row.id);
      toast('info', `Diagnostic status request sent to ${result.recipientCount} staff for ${result.orderCount} order${result.orderCount === 1 ? '' : 's'}.`);
    } catch (e) {
      toast('error', e?.message || 'The diagnostic status request could not be sent.');
    } finally {
      setPingingId('');
    }
  }, [toast]);

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
  const rows = tab === 'needsAttention'
    ? [...(queue?.new || []).map((row) => ({ ...row, _queueBucket: 'NEW' })), ...(queue?.inConsultation || []).map((row) => ({ ...row, _queueBucket: 'IN_CONSULTATION' }))]
    : queue?.[tab === 'awaitingResults' ? 'pendingLabs' : tab] || [];
  const active = TABS.find((item) => item.id === tab) || TABS[0];

  const diagnosticTable = tab === 'awaitingResults' || tab === 'reviewReady';

  const columns = [
    {
      key: 'patient',
      label: 'Patient',
      width: diagnosticTable ? '20%' : '26%',
      mobilePrimary: true,
      render: (row) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-slate-900" title={patientName(row.patient)}>{patientName(row.patient)}</span>
          <span className="block truncate text-xs text-slate-500">
            {[row.patient?.patientCode && `ID: ${row.patient.patientCode}`, [ageLabel(row.patient?.dateOfBirth), row.patient?.gender?.[0]].filter(Boolean).join(' ')].filter(Boolean).join(' • ')}
          </span>
        </span>
      )
    },
    {
      key: 'chiefComplaint',
      label: 'Complaint',
      width: diagnosticTable ? '24%' : '36%',
      render: (row) => (
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 max-w-full truncate text-sm text-slate-800" title={row.chiefComplaint || 'No complaint recorded'}>{row.chiefComplaint || 'No complaint recorded'}</span>
          <TriageDot level={row.triageLevel} />
          {tab === 'reviewReady' && <ResultPriorityBadge priority={row.resultPriority} />}
        </span>
      )
    }
  ];

  if (tab === 'awaitingResults' || tab === 'reviewReady') {
    columns.push({
      key: 'tests',
      label: 'Tests',
      width: '23%',
      render: (row) => (
        <span className="block min-w-0 text-sm">
          <span className="block truncate font-semibold text-slate-900" title={`${row.tests.ready} of ${row.tests.total} back`} aria-label={`${row.tests.ready} of ${row.tests.total} tests back`}>{compactTestCount(row.tests.ready)} of {compactTestCount(row.tests.total)} back</span>
          {row.tests.outstanding.length > 0 && <span className="block truncate text-xs text-slate-500" title={`Waiting on ${row.tests.outstanding.join(', ')}`}>Waiting on {row.tests.outstanding.slice(0, 2).join(', ')}{row.tests.outstanding.length > 2 ? '...' : ''}</span>}
        </span>
      )
    });
  }

  columns.push({
    key: 'wait',
    label: tab === 'needsAttention' ? 'Waiting / in care' : 'Sent for tests',
    width: diagnosticTable ? '14%' : '18%',
    render: (row) => {
      const bucket = row._queueBucket || row.queueState;
      const since = bucket === 'NEW' ? row.triagedAt || row.startedAt : bucket === 'IN_CONSULTATION' ? row.consultationStartedAt || row.startedAt : row.suspendedAt;
      const detail = bucket === 'NEW' ? `Waiting ${waitingSince(since)}` : bucket === 'IN_CONSULTATION' ? `In care ${waitingSince(since)}` : waitingSince(since);
      return <span className={`text-sm font-medium ${bucket === 'NEW' ? waitClass(minutesSince(since)) : 'text-slate-600'}`}>{detail}</span>;
    }
  });

  columns.push({
    key: 'action',
    label: 'Action',
    width: diagnosticTable ? '19%' : '20%',
    render: (row) => tab === 'awaitingResults' ? (
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={busyId === row.id || !canConsult}
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
          disabled={pingingId === row.id || !canConsult || !row.canPingDiagnostics}
          title={row.canPingDiagnostics ? 'Send an in-app status request to active laboratory and imaging staff.' : 'No outstanding diagnostic orders on this visit.'}
          onClick={() => pingDiagnostics(row)}
          aria-label={`Ping diagnostics for ${patientName(row.patient)}`}
        >
          {pingingId === row.id ? 'Sending…' : 'Ping diagnostics'}
        </Button>
      </div>
    ) : (
        <Button
          size="sm"
          variant={tab === 'reviewReady' ? 'primary' : 'secondary'}
          disabled={busyId === row.id || !canConsult}
          onClick={() => openVisit(row)}
          aria-label={`${tab === 'reviewReady' ? 'Review results' : (row._queueBucket || row.queueState) === 'NEW' ? 'Consult' : 'Continue consultation'} for ${patientName(row.patient)}`}
        >
          {busyId === row.id ? 'Opening…' : tab === 'reviewReady' ? 'Review results' : (row._queueBucket || row.queueState) === 'NEW' ? 'Consult' : 'Continue'}
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
            const count = item.id === 'needsAttention'
              ? (counts.new || 0) + (counts.inConsultation || 0)
              : counts[item.id === 'awaitingResults' ? 'pendingLabs' : item.id] || 0;
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
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{queue ? (item.id === 'needsAttention' ? (counts.new || 0) + (counts.inConsultation || 0) : counts[item.id === 'awaitingResults' ? 'pendingLabs' : item.id] || 0) : '–'}</span>
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

      {tab === 'awaitingResults' && <p role="note" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">These visits are waiting on laboratory or imaging work. Results must still be reviewed and signed off by a clinician.</p>}

      <div id="queue-panel" role="tabpanel" aria-labelledby={`queue-tab-${tab}`} aria-live="polite">
        <DataTable
          caption={active.label}
          rowBadge={(row) => row.encounterCode}
          emptyMessage={queue ? active.empty : 'Loading the queue…'}
        rows={rows}
        columns={columns}
        fixedLayout
      />
      </div>
    </div>
  );
}
