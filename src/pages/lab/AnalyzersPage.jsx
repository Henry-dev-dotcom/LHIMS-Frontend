import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Cpu, KeyRound, Plus, Power, RefreshCcw, Search, Settings2, UploadCloud } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { ANALYZER_PROTOCOL_LABELS } from '../../api/normalizers';

/*
  Analyzers that send their own results, so the bench stops retyping them.

  Three things on this page matter more than the list itself: the key is shown
  exactly once, nothing a machine sends is released without a person, and a run
  can be brought in by uploading the file when no bridge is installed.
*/

const PROTOCOL_HELP = {
  HL7_V2: 'Most modern instruments and middleware. The bridge listens for the analyzer to connect, or watches a folder it writes to.',
  ASTM: 'Older instruments on a serial cable. The bridge reads the records and forwards them.',
  CSV: 'The analyzer (or its own software) exports a delimited file. Upload it here, or let the bridge watch the folder.',
  JSON: 'A custom or in-house integration that posts our own simple shape.'
};

/* The key exists in this one response and nowhere else. */
function IssuedKeyModal({ issued, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.apiKey);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the key is on screen to copy by hand.
      setCopied(false);
    }
  };

  return (
    <Modal
      open={Boolean(issued)}
      title={issued?.rotated ? 'New key issued' : 'Analyzer registered'}
      description={`Put this key in the bridge's configuration on the computer beside ${issued?.deviceName || 'the analyzer'}. It cannot be shown again.`}
      onClose={onClose}
      footer={<Button onClick={onClose}>I have copied it</Button>}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p className="text-sm font-semibold leading-6 text-amber-900">
            This is the only time you will see it. We keep only a one-way hash, so nobody — including us — can read it back. If it is lost, issue a new one.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-900 p-4">
          <p className="break-all font-mono text-sm leading-6 text-emerald-300">{issued?.apiKey}</p>
        </div>
        <Button variant={copied ? 'secondary' : 'primary'} onClick={copy}>
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy key</>}
        </Button>
        {issued?.rotated && (
          <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            The previous key stopped working the moment this one was issued. The analyzer cannot send again until the bridge has this key.
          </p>
        )}
      </div>
    </Modal>
  );
}

function DeviceFormModal({ open, device, departments, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    name: device?.name || '',
    protocol: device?.protocol || 'HL7_V2',
    make: device?.make || '',
    model: device?.model || '',
    serialNumber: device?.serialNumber || '',
    departmentId: device?.departmentId || '',
    autoSubmitForReview: device?.autoSubmitForReview || false,
    acceptUnmappedTests: device?.acceptUnmappedTests || false,
    notes: device?.notes || ''
  }));
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));
  const toggle = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.checked }));

  const submit = () => {
    if (form.name.trim().length < 2) return;
    setBusy(true);
    onSave({
      name: form.name.trim(),
      protocol: form.protocol,
      make: form.make.trim() || undefined,
      model: form.model.trim() || undefined,
      serialNumber: form.serialNumber.trim() || undefined,
      departmentId: form.departmentId || null,
      autoSubmitForReview: form.autoSubmitForReview,
      acceptUnmappedTests: form.acceptUnmappedTests,
      notes: form.notes.trim() || undefined
    });
    // Dispatch is fire-and-forget, so re-enable rather than wait on a promise.
    window.setTimeout(() => setBusy(false), 1500);
  };

  return (
    <Modal
      open={open}
      title={device ? `Settings for ${device.name}` : 'Register an analyzer'}
      description={device ? 'What this instrument is, and what happens to the results it sends.' : 'Tell us what the instrument is. A key is issued once you save, for the bridge beside it.'}
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || form.name.trim().length < 2}>{device ? 'Save settings' : 'Register and issue a key'}</Button></>}
    >
      <div className="space-y-4">
        <FormField label="Name staff will recognise" required help="What the bench calls it, e.g. “Haematology — BC-5000”.">
          <input className={inputClass} value={form.name} onChange={set('name')} placeholder="Haematology analyzer" />
        </FormField>

        <FormField label="How it sends results" required help={PROTOCOL_HELP[form.protocol]}>
          <select className={inputClass} value={form.protocol} onChange={set('protocol')}>
            {Object.entries(ANALYZER_PROTOCOL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Make"><input className={inputClass} value={form.make} onChange={set('make')} placeholder="Mindray" /></FormField>
          <FormField label="Model"><input className={inputClass} value={form.model} onChange={set('model')} placeholder="BC-5000" /></FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Serial number"><input className={inputClass} value={form.serialNumber} onChange={set('serialNumber')} /></FormField>
          {departments.length > 0 && (
            <FormField label="Department">
              <select className={inputClass} value={form.departmentId} onChange={set('departmentId')}>
                <option value="">Not set</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </FormField>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">What happens to what it sends</p>
          <label className="flex items-start gap-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={form.autoSubmitForReview} onChange={toggle('autoSubmitForReview')} />
            <span>
              Send straight to the review queue
              <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500">
                Instead of waiting as a draft on the bench. Either way a person still signs it off — an analyzer never releases a result to a clinician or a patient.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={form.acceptUnmappedTests} onChange={toggle('acceptUnmappedTests')} />
            <span>
              Store tests we have not mapped
              <span className="mt-0.5 block text-xs font-normal leading-5 text-slate-500">
                Off is safer. An unmapped value is stored under the analyzer's own name with no reference range, so it cannot be flagged high, low or critical. Leave this off and map the codes instead.
              </span>
            </span>
          </label>
        </div>

        <FormField label="Notes"><textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} placeholder="Where it sits, who maintains it, service contract…" /></FormField>
      </div>
    </Modal>
  );
}

/* Bringing a run in by hand, for a lab with no bridge installed. */
function UploadModal({ open, devices, lastUpload, onClose, onUpload }) {
  const [deviceId, setDeviceId] = useState(devices[0]?.id || '');
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setContent(await file.text());
  };

  const submit = () => {
    if (!deviceId || !content.trim()) return;
    setBusy(true);
    onUpload({ deviceId, filename: filename || undefined, content });
    window.setTimeout(() => setBusy(false), 1500);
  };

  return (
    <Modal
      open={open}
      title="Upload a run from an analyzer"
      description="Export the run from the instrument, then bring the file here. Same checks as a bridge: values land as a draft for you to look at."
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={submit} disabled={busy || !deviceId || !content.trim()}><UploadCloud className="h-4 w-4" /> Upload</Button></>}
    >
      <div className="space-y-4">
        <FormField label="Which analyzer did this come from?" required help="The file must be the kind this analyzer is set up for, or we will say so rather than guess.">
          <select className={inputClass} value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
            <option value="">Choose an analyzer</option>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.protocolLabel}</option>)}
          </select>
        </FormField>

        <FormField label="The file" required help="A result export, an HL7 message or an ASTM capture. Nothing is sent anywhere else.">
          <input ref={fileRef} type="file" accept=".csv,.txt,.hl7,.dat,.res,.json,.astm,text/*" className={inputClass} onChange={pick} />
        </FormField>

        {content && (
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">What we are about to send ({content.length.toLocaleString()} characters)</p>
            <pre className="max-h-40 overflow-auto rounded-2xl bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-200">{content.slice(0, 1200)}{content.length > 1200 ? '\n…' : ''}</pre>
          </div>
        )}

        {lastUpload && (
          <div className={`rounded-2xl border p-4 ${lastUpload.applied > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
            <p className="text-sm font-bold text-slate-900">{lastUpload.applied} stored · {lastUpload.skipped} need attention</p>
            {(lastUpload.notes || []).map((note, index) => (
              <p key={index} className="mt-1.5 text-sm leading-6 text-slate-700">{note}</p>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AnalyzersPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const devices = data.analyzerDevices || [];
  const messages = data.analyzerMessages || [];
  const unmapped = data.analyzerUnmappedCodes || [];
  const issued = data.analyzerIssuedKey;

  const [query, setQuery] = useState('');
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);

  const rows = useMemo(() => devices.filter((device) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [device.name, device.code, device.make, device.model, device.serialNumber, device.protocolLabel].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
  }), [devices, query]);

  const needingAttention = messages.filter((message) => ['UNMATCHED', 'PARTIAL', 'FAILED'].includes(message.rawStatus)).length;
  const active = devices.filter((device) => device.rawStatus === 'ACTIVE').length;

  const clearIssuedKey = () => dispatch({ type: 'SET_COLLECTIONS', collections: { analyzerIssuedKey: null } });
  const closeUpload = () => {
    setUploading(false);
    dispatch({ type: 'SET_COLLECTIONS', collections: { analyzerLastUpload: null } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laboratory · Analyzers"
        title="Analyzers"
        description="Let the instruments file their own results, so nobody retypes a number. Every value still waits for a person to check and sign off."
        actions={
          <>
            {devices.length > 0 && <Button variant="secondary" onClick={() => setUploading(true)}><UploadCloud className="h-4 w-4" /> Upload a run</Button>}
            <Button onClick={() => setRegistering(true)}><Plus className="h-4 w-4" /> Register an analyzer</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Analyzers" value={String(devices.length)} helper={`${active} switched on`} icon={Cpu} />
        <MetricCard label="Messages received" value={String(messages.length)} helper="In the recent log" icon={RefreshCcw} />
        <MetricCard label="Need attention" value={String(needingAttention)} helper="Could not be filed in full" icon={AlertTriangle} tone={needingAttention > 0 ? 'yellow' : 'blue'} />
        <MetricCard label="Codes to map" value={String(unmapped.length)} helper="Sent but not mapped to a test" icon={Settings2} tone={unmapped.length > 0 ? 'yellow' : 'blue'} />
      </div>

      {devices.length === 0 ? (
        <Card title="No analyzers yet" subtitle="What this does, and what it needs from you.">
          <div className="space-y-4 text-sm leading-6 text-slate-700">
            <p>
              Once an analyzer is registered, the numbers it measures appear on the right patient's result by themselves — the bench checks and signs off instead of typing.
            </p>
            <ol className="ml-5 list-decimal space-y-2 font-semibold">
              <li>Register the instrument here. We issue it a key, shown once.</li>
              <li>Put that key in the bridge on the computer beside it (<span className="font-mono text-xs">tools/analyzer-bridge</span>), or skip the bridge and upload the run's export file here.</li>
              <li>Run one sample. Whatever codes the instrument used appear under <span className="font-bold">Test mapping</span>, ready to point at your own test fields.</li>
            </ol>
            <p className="rounded-2xl bg-slate-50 p-4 font-semibold text-slate-600">
              The specimen id the analyzer is given must be the sample code on the tube, which is what ties a reading to a patient. Nothing is matched by name or by guesswork.
            </p>
          </div>
        </Card>
      ) : (
        <Card title="Registered analyzers" subtitle="Each has its own key. Disable one and it stops being able to send immediately.">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input aria-label="Search analyzers" className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, make, model or serial..." />
          </div>
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Analyzer',
                render: (row) => (
                  <div>
                    <p className="font-bold text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">{[row.code, row.make, row.model].filter(Boolean).join(' · ')}</p>
                  </div>
                )
              },
              { key: 'protocol', label: 'Sends as', render: (row) => <span className="text-sm font-semibold text-slate-700">{row.protocolLabel}</span> },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              {
                key: 'behaviour',
                label: 'On arrival',
                render: (row) => (
                  <div className="text-xs font-semibold text-slate-600">
                    <p>{row.autoSubmitForReview ? 'Goes to the review queue' : 'Waits as a draft on the bench'}</p>
                    {row.acceptUnmappedTests && <p className="text-amber-700">Stores unmapped tests</p>}
                  </div>
                )
              },
              { key: 'mapping', label: 'Mapped codes', render: (row) => <span className="text-sm font-semibold text-slate-700">{row.mappingCount}</span> },
              {
                key: 'lastHeard',
                label: 'Last heard from',
                render: (row) => (
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold">{row.lastMessageAt ? formatDateTime(row.lastMessageAt) : 'Never'}</p>
                    <p className="text-slate-400">key …{row.keyPrefix}</p>
                  </div>
                )
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setEditing(row)}><Settings2 className="h-4 w-4" /> Settings</Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!window.confirm(`Issue a new key for ${row.name}?\n\nThe key it uses now will stop working immediately, and it cannot send again until the bridge has the new one.`)) return;
                        dispatch({ type: 'ROTATE_ANALYZER_KEY', deviceId: row.id });
                      }}
                    >
                      <KeyRound className="h-4 w-4" /> New key
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => dispatch({ type: 'UPDATE_ANALYZER', deviceId: row.id, payload: { status: row.rawStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } })}
                    >
                      <Power className="h-4 w-4" /> {row.rawStatus === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                )
              }
            ]}
            rows={rows}
            emptyMessage="No analyzer matches that search."
          />
        </Card>
      )}

      {issued && <IssuedKeyModal issued={issued} onClose={clearIssuedKey} />}

      {registering && (
        <DeviceFormModal
          open
          departments={data.departments || []}
          onClose={() => setRegistering(false)}
          onSave={(payload) => {
            dispatch({ type: 'REGISTER_ANALYZER', payload });
            setRegistering(false);
          }}
        />
      )}

      {editing && (
        <DeviceFormModal
          open
          key={editing.id}
          device={editing}
          departments={data.departments || []}
          onClose={() => setEditing(null)}
          onSave={(payload) => {
            dispatch({ type: 'UPDATE_ANALYZER', deviceId: editing.id, payload });
            setEditing(null);
          }}
        />
      )}

      {uploading && (
        <UploadModal
          open
          devices={devices.filter((device) => device.rawStatus === 'ACTIVE')}
          lastUpload={data.analyzerLastUpload}
          onClose={closeUpload}
          onUpload={(payload) => dispatch({ type: 'UPLOAD_ANALYZER_FILE', payload })}
        />
      )}
    </div>
  );
}
