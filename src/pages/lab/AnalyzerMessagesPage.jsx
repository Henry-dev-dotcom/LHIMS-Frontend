import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, RotateCcw, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { analyzerService } from '../../services/analyzerService';
import { apiClient } from '../../store/commands';

/*
  Everything the analyzers have sent, kept exactly as it arrived.

  A payload that could not be read, matched or mapped is here, not gone. That is
  the whole point of the page: a run on a sample that cannot be taken again is
  recoverable, and somebody can see why it did not land the first time.
*/

const FILTERS = [
  { id: 'attention', label: 'Need attention', statuses: ['UNMATCHED', 'PARTIAL', 'FAILED'] },
  { id: 'all', label: 'Everything', statuses: null },
  { id: 'applied', label: 'Filed', statuses: ['APPLIED'] },
  { id: 'discarded', label: 'Discarded', statuses: ['DISCARDED'] }
];

/* What CurataMed made of a message, and the payload itself. */
function MessageModal({ message, onClose, onReplay, onDiscard }) {
  const [raw, setRaw] = useState(message.rawPayload || '');
  const [loadingRaw, setLoadingRaw] = useState(!message.rawPayload);
  const [discarding, setDiscarding] = useState(false);
  const [reason, setReason] = useState('');

  // The list leaves the payload out, because it can be large; fetch it on demand.
  useEffect(() => {
    if (message.rawPayload) return;
    let cancelled = false;
    analyzerService
      .message(apiClient, message.id)
      .then((payload) => {
        if (!cancelled) setRaw(payload?.rawPayload || '');
      })
      .catch(() => {
        if (!cancelled) setRaw('');
      })
      .finally(() => {
        if (!cancelled) setLoadingRaw(false);
      });
    return () => {
      cancelled = true;
    };
  }, [message.id, message.rawPayload]);

  const canDiscard = message.applied === 0 && message.rawStatus !== 'DISCARDED';

  return (
    <Modal
      open
      title={`From ${message.deviceName}`}
      description={`Received ${formatDateTime(message.receivedAt)}${message.analyzerSampleId ? ` for specimen ${message.analyzerSampleId}` : ''}.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {canDiscard && !discarding && <Button variant="secondary" onClick={() => setDiscarding(true)}><Trash2 className="h-4 w-4" /> Discard</Button>}
          {message.rawStatus !== 'DISCARDED' && <Button onClick={() => onReplay(message)}><RotateCcw className="h-4 w-4" /> Try again</Button>}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={message.status} />
          <p className="text-sm font-bold text-slate-900">{message.applied} stored · {message.skipped} not stored</p>
          {message.resultCode && <p className="text-sm font-semibold text-slate-600">→ {message.resultCode} ({message.resultStatus})</p>}
        </div>

        {(message.sampleCode || message.patientName) && (
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">{message.patientName || 'Unknown patient'}</p>
            <p className="text-xs text-slate-500">{[message.patientCode, message.sampleCode].filter(Boolean).join(' · ')}</p>
          </div>
        )}

        {message.reason && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <p className="text-sm font-semibold leading-6 text-amber-900">{message.reason}</p>
          </div>
        )}

        {message.rawStatus === 'DISCARDED' && (
          <div className="rounded-2xl bg-slate-100 p-4">
            <p className="text-sm font-bold text-slate-900">Discarded by {message.resolvedBy || 'a member of staff'} · {formatDateTime(message.resolvedAt)}</p>
            <p className="mt-1 text-sm text-slate-700">{message.resolutionNote}</p>
          </div>
        )}

        {discarding && (
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <FormField label="Why should this message not be applied?" required help="Kept with the message, so the decision can be understood later.">
              <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Quality control run, not a patient sample" />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDiscarding(false)}>Cancel</Button>
              <Button onClick={() => onDiscard(message, reason)} disabled={reason.trim().length < 3}>Discard this message</Button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">What the analyzer sent, exactly as it arrived</p>
          <pre className="max-h-64 overflow-auto rounded-2xl bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-200">
            {loadingRaw ? 'Loading…' : raw || 'The payload could not be loaded.'}
          </pre>
        </div>
      </div>
    </Modal>
  );
}

export function AnalyzerMessagesPage() {
  const { state, dispatch } = useAppStore();
  const messages = state.data.analyzerMessages || [];
  const [filter, setFilter] = useState('attention');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);

  const active = FILTERS.find((item) => item.id === filter) || FILTERS[1];

  const rows = useMemo(() => messages
    .filter((message) => (active.statuses ? active.statuses.includes(message.rawStatus) : true))
    .filter((message) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [message.deviceName, message.analyzerSampleId, message.sampleCode, message.patientName, message.patientCode, message.resultCode, message.reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    }), [messages, active, query]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((item) => [
    item.id,
    item.statuses ? messages.filter((message) => item.statuses.includes(message.rawStatus)).length : messages.length
  ])), [messages]);

  const replay = (message) => {
    dispatch({ type: 'REPLAY_ANALYZER_MESSAGE', messageId: message.id });
    setOpen(null);
  };
  const discard = (message, reason) => {
    dispatch({ type: 'DISCARD_ANALYZER_MESSAGE', messageId: message.id, payload: { reason } });
    setOpen(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laboratory · Analyzers"
        title="Analyzer log"
        description="Everything the instruments sent, kept exactly as it arrived. Nothing is ever dropped — fix what was wrong and try the message again."
      />

      <Card title="What the analyzers sent" subtitle="Start with what needs attention: a message here is a run that did not reach a patient's result.">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <Button key={item.id} variant={filter === item.id ? 'primary' : 'secondary'} onClick={() => setFilter(item.id)}>
              {item.label} ({counts[item.id] ?? 0})
            </Button>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input aria-label="Search analyzer messages" className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by analyzer, specimen, patient or reason..." />
        </div>

        <DataTable
          columns={[
            { key: 'received', label: 'Received', render: (row) => <span className="text-xs font-semibold text-slate-700">{formatDateTime(row.receivedAt)}</span> },
            { key: 'device', label: 'Analyzer', render: (row) => <span className="text-sm font-semibold text-slate-700">{row.deviceName}</span> },
            {
              key: 'specimen',
              label: 'Specimen',
              render: (row) => (
                <div>
                  <p className="font-mono text-sm font-bold text-slate-900">{row.sampleCode || row.analyzerSampleId || '—'}</p>
                  {row.patientName && <p className="text-xs text-slate-500">{row.patientName}</p>}
                </div>
              )
            },
            { key: 'status', label: 'Outcome', render: (row) => <StatusBadge status={row.status} /> },
            {
              key: 'counts',
              label: 'Values',
              render: (row) => (
                <span className="text-sm font-semibold text-slate-700">
                  {row.applied > 0 && <span className="text-emerald-700">{row.applied} stored</span>}
                  {row.applied > 0 && row.skipped > 0 && ' · '}
                  {row.skipped > 0 && <span className="text-amber-700">{row.skipped} not</span>}
                  {row.applied === 0 && row.skipped === 0 && '—'}
                </span>
              )
            },
            {
              key: 'reason',
              label: 'Why',
              render: (row) => (
                row.reason
                  ? <p className="max-w-md text-xs leading-5 text-slate-600">{row.reason}</p>
                  : <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Filed in full</span>
              )
            },
            { key: 'actions', label: 'Action', render: (row) => <Button variant="secondary" onClick={() => setOpen(row)}><Eye className="h-4 w-4" /> Open</Button> }
          ]}
          rows={rows}
          emptyMessage={
            filter === 'attention'
              ? 'Nothing needs attention. Every message the analyzers sent was filed in full.'
              : 'No message matches that search.'
          }
        />
      </Card>

      {open && <MessageModal key={open.id} message={open} onClose={() => setOpen(null)} onReplay={replay} onDiscard={discard} />}
    </div>
  );
}
