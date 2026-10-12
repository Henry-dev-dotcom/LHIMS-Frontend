import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPlus, Gauge, RefreshCcw, ServerCog, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';

const BAD_STATUSES = ['UNMATCHED', 'PARTIAL', 'FAILED'];
const asNumber = (value) => (value === '' || value == null ? null : Number(value));
const pct = (value) => `${Math.round(value)}%`;

export function AnalyzerPerformancePage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const devices = data.analyzerDevices || [];
  const messages = data.analyzerMessages || [];
  const qcRuns = data.qualityControlRuns || [];
  const catalog = (data.catalog || []).filter((item) => item.type === 'Lab' || item.rawType === 'LAB' || item.department === 'Laboratory');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ deviceId: '', catalogItemId: '', parameterName: '', controlLevel: 'Level 1', value: '', expectedMean: '', standardDeviation: '', result: 'PASS', notes: '' });
  const [saving, setSaving] = useState(false);

  const attentionMessages = messages.filter((message) => BAD_STATUSES.includes(message.rawStatus || message.status));
  const appliedMessages = messages.reduce((sum, message) => sum + Number(message.appliedCount || 0), 0);
  const skippedMessages = messages.reduce((sum, message) => sum + Number(message.skippedCount || 0), 0);
  const totalValues = appliedMessages + skippedMessages;
  const passRuns = qcRuns.filter((run) => String(run.result).toUpperCase() === 'PASS').length;
  const qcRate = qcRuns.length ? (passRuns / qcRuns.length) * 100 : 0;

  const deviceRows = useMemo(() => devices
    .filter((device) => !query.trim() || [device.name, device.make, device.model, device.code].filter(Boolean).some((v) => String(v).toLowerCase().includes(query.trim().toLowerCase())))
    .map((device) => {
      const own = messages.filter((message) => message.deviceId === device.apiId || message.deviceId === device.id);
      const exceptions = own.filter((message) => BAD_STATUSES.includes(message.rawStatus || message.status)).length;
      const values = own.reduce((sum, message) => sum + Number(message.appliedCount || 0) + Number(message.skippedCount || 0), 0);
      return { ...device, messageCount: own.length, exceptions, values, reliability: own.length ? ((own.length - exceptions) / own.length) * 100 : null };
    }), [devices, messages, query]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.parameterName.trim()) return;
    setSaving(true);
    dispatch({ type: 'CREATE_ANALYZER_QC_RUN', payload: {
      catalogItemId: form.catalogItemId || undefined,
      parameterName: form.parameterName.trim(),
      controlLevel: form.controlLevel.trim() || undefined,
      value: asNumber(form.value),
      expectedMean: asNumber(form.expectedMean),
      standardDeviation: asNumber(form.standardDeviation),
      result: form.result,
      notes: form.notes.trim() || undefined
    } });
    window.setTimeout(() => setSaving(false), 1200);
    setForm((current) => ({ ...current, parameterName: '', value: '', notes: '' }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laboratory · Analyzers"
        title="Analyzer Performance & QC"
        description="Collect the run, quality-control and exception data that shows whether each analyzer is reliable, accurate and ready for patient work."
        actions={<Button variant="secondary" onClick={() => dispatch({ type: 'REFRESH_COLLECTIONS', names: ['analyzerDevices', 'analyzerMessages', 'analyzerUnmappedCodes', 'qualityControlRuns'] })}><RefreshCcw className="h-4 w-4" /> Refresh data</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active analyzers" value={String(devices.filter((d) => d.rawStatus === 'ACTIVE').length)} helper={`${devices.length} registered`} icon={ServerCog} />
        <MetricCard label="Value capture rate" value={totalValues ? pct((appliedMessages / totalValues) * 100) : '—'} helper={`${appliedMessages} stored · ${skippedMessages} skipped`} icon={Gauge} tone={totalValues && appliedMessages / totalValues < 0.95 ? 'yellow' : 'blue'} />
        <MetricCard label="Message exceptions" value={String(attentionMessages.length)} helper="Unmatched, partial or failed" icon={AlertTriangle} tone={attentionMessages.length ? 'yellow' : 'blue'} />
        <MetricCard label="QC pass rate" value={qcRuns.length ? pct(qcRate) : '—'} helper={`${qcRuns.length} QC observations recorded`} icon={ShieldCheck} tone={qcRuns.length && qcRate < 90 ? 'yellow' : 'blue'} />
      </div>

      <Card title="How this improves analyzer performance" subtitle="Use the data together: message reliability finds connection and mapping problems; QC observations show drift against an expected mean."
        className="border-clinical-200 bg-clinical-50/50">
        <div className="grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-3">
          <div><p className="font-bold text-slate-900">1. Watch reliability</p><p>Compare received messages, stored values and exceptions per device.</p></div>
          <div><p className="font-bold text-slate-900">2. Record QC</p><p>Capture control level, measured value, expected mean, SD and pass/fail outcome.</p></div>
          <div><p className="font-bold text-slate-900">3. Act early</p><p>Investigate repeated failures or bias before releasing patient results.</p></div>
        </div>
      </Card>

      <Card title="Analyzer reliability" subtitle="A message is considered reliable when it is received without unmatched, partial or failed processing.">
        <div className="mb-4 flex items-center gap-3">
          <input aria-label="Search analyzers" className={`${inputClass} max-w-md`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search analyzer, make or model..." />
        </div>
        <DataTable
          caption="Device-level performance summary"
          rows={deviceRows}
          emptyMessage="No analyzers match this search."
          columns={[
            { key: 'name', label: 'Analyzer', mobilePrimary: true, render: (row) => <div><p className="font-bold text-slate-900">{row.name}</p><p className="text-xs text-slate-500">{[row.make, row.model].filter(Boolean).join(' · ') || 'Make/model not recorded'}</p></div> },
            { key: 'messageCount', label: 'Messages', render: (row) => <span className="font-semibold">{row.messageCount}</span> },
            { key: 'values', label: 'Values received', render: (row) => <span>{row.values}</span> },
            { key: 'exceptions', label: 'Exceptions', render: (row) => <span className={row.exceptions ? 'font-bold text-amber-700' : 'text-emerald-700'}>{row.exceptions}</span> },
            { key: 'reliability', label: 'Reliability', render: (row) => row.reliability == null ? 'No runs yet' : <span className="font-bold">{pct(row.reliability)}</span> },
            { key: 'lastMessageAt', label: 'Last seen', render: (row) => row.lastMessageAt ? formatDateTime(row.lastMessageAt) : 'No message yet' }
          ]}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card title="Record analyzer QC" subtitle="Enter one control observation after a QC run. These observations are not patient results and never release to clinicians.">
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Analyzer">
                <select className={inputClass} value={form.deviceId} onChange={set('deviceId')}><option value="">Not specified</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select>
              </FormField>
              <FormField label="Laboratory test">
                <select className={inputClass} value={form.catalogItemId} onChange={set('catalogItemId')}><option value="">Not specified</option>{catalog.map((item) => <option key={item.id} value={item.apiId || item.id}>{item.name}</option>)}</select>
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Parameter name" required><input className={inputClass} value={form.parameterName} onChange={set('parameterName')} placeholder="e.g. Glucose" required /></FormField>
              <FormField label="Control level"><input className={inputClass} value={form.controlLevel} onChange={set('controlLevel')} placeholder="Level 1" /></FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Measured value"><input className={inputClass} type="number" step="any" value={form.value} onChange={set('value')} /></FormField>
              <FormField label="Expected mean"><input className={inputClass} type="number" step="any" value={form.expectedMean} onChange={set('expectedMean')} /></FormField>
              <FormField label="Standard deviation"><input className={inputClass} type="number" step="any" min="0" value={form.standardDeviation} onChange={set('standardDeviation')} /></FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="QC outcome" help="Use Warning when the run needs monitoring but is not yet a failure."><select className={inputClass} value={form.result} onChange={set('result')}><option value="PASS">Pass</option><option value="WARNING">Warning</option><option value="FAIL">Fail</option></select></FormField>
              <FormField label="Notes"><input className={inputClass} value={form.notes} onChange={set('notes')} placeholder="Reagent lot, calibration or action taken..." /></FormField>
            </div>
            <Button type="submit" disabled={saving || !form.parameterName.trim()}><ClipboardPlus className="h-4 w-4" /> {saving ? 'Saving...' : 'Record QC run'}</Button>
          </form>
        </Card>

        <Card title="Recent quality-control observations" subtitle="A simple audit trail for drift, repeatability discussions and corrective action.">
          <DataTable
            caption="Newest first"
            rows={qcRuns.slice(0, 20)}
            emptyMessage="No QC observations recorded yet."
            columns={[
              { key: 'parameterName', label: 'Parameter', mobilePrimary: true, render: (row) => <div><p className="font-bold text-slate-900">{row.parameterName}</p><p className="text-xs text-slate-500">{row.controlLevel || 'Control level not set'}</p></div> },
              { key: 'value', label: 'Measured', render: (row) => row.value == null ? '—' : String(row.value) },
              { key: 'expectedMean', label: 'Expected mean', render: (row) => row.expectedMean == null ? '—' : String(row.expectedMean) },
              { key: 'result', label: 'Outcome', render: (row) => <StatusBadge status={row.result} /> },
              { key: 'createdAt', label: 'Recorded', render: (row) => formatDateTime(row.createdAt) }
            ]}
          />
        </Card>
      </div>

      <Card title="Exceptions to investigate" subtitle="Do not ignore these records: repeated exceptions may indicate a mapping, interface, reagent or device problem.">
        {attentionMessages.length === 0 ? <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> No analyzer message exceptions in the loaded log.</div> : <DataTable rows={attentionMessages.slice(0, 20)} emptyMessage="No exceptions found." columns={[{ key: 'deviceName', label: 'Analyzer', mobilePrimary: true }, { key: 'sampleCode', label: 'Specimen', render: (row) => row.sampleCode || row.analyzerSampleId || '—' }, { key: 'status', label: 'Status', render: (row) => row.status || row.rawStatus }, { key: 'error', label: 'Reason', render: (row) => row.error || row.reason || 'Review message details' }, { key: 'receivedAt', label: 'Received', render: (row) => formatDateTime(row.receivedAt) }]} />}
      </Card>
    </div>
  );
}
