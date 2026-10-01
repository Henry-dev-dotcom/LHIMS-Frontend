import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Link2, Plus, Search, Trash2, Wand2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { labService } from '../../services/labService';
import { apiClient } from '../../store/commands';

/*
  Pointing an analyzer's own test codes at our test fields.

  This is the step that cannot be skipped or guessed: "GLU" means nothing until
  somebody says it is the Blood Glucose field of the glucose test. The work is
  made small by not asking anyone to read a manual — run one sample, and the codes
  the instrument really used are listed here waiting to be pointed somewhere.
*/

function MappingFormModal({ open, seed, devices, labTests, onClose, onSave }) {
  const [deviceId, setDeviceId] = useState(seed?.deviceId || '');
  const [analyzerCode, setAnalyzerCode] = useState(seed?.analyzerCode || '');
  const [catalogItemId, setCatalogItemId] = useState(seed?.catalogItemId || '');
  const [referenceParameterId, setReferenceParameterId] = useState(seed?.referenceParameterId || '');
  const [factor, setFactor] = useState(seed?.factor || '');
  const [unitOverride, setUnitOverride] = useState(seed?.unitOverride || '');
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [busy, setBusy] = useState(false);

  // The fields of a test come from the catalog, so they are fetched when a test
  // is chosen rather than held for every test in the facility.
  useEffect(() => {
    if (!catalogItemId) {
      setFields([]);
      return;
    }
    let cancelled = false;
    setLoadingFields(true);
    labService
      .referenceRanges(apiClient, catalogItemId)
      .then((payload) => {
        if (cancelled) return;
        setFields(payload?.parameters ?? []);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFields(false);
      });
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  const submit = () => {
    if (!analyzerCode.trim() || !catalogItemId) return;
    setBusy(true);
    onSave({
      deviceId: deviceId || null,
      analyzerCode: analyzerCode.trim(),
      catalogItemId,
      referenceParameterId: referenceParameterId || null,
      factor: factor.trim() === '' ? null : factor.trim(),
      unitOverride: unitOverride.trim() || null
    });
    window.setTimeout(() => setBusy(false), 1500);
  };

  const chosenField = fields.find((field) => field.id === referenceParameterId);

  return (
    <Modal
      open={open}
      title="Map an analyzer code to a test field"
      description="Where the value with this code should be stored."
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !analyzerCode.trim() || !catalogItemId}>Save mapping</Button></>}
    >
      <div className="space-y-4">
        <FormField label="Which analyzer?" help="Leave as all analyzers when every instrument in the lab uses this code to mean the same thing.">
          <select className={inputClass} value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
            <option value="">All analyzers in this laboratory</option>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
          </select>
        </FormField>

        <FormField label="The code the analyzer sends" required help="Exactly as it appears in the message, e.g. “GLU” or “WBC”. Capitalisation does not matter.">
          <input className={inputClass} value={analyzerCode} onChange={(event) => setAnalyzerCode(event.target.value)} placeholder="GLU" />
        </FormField>

        <FormField label="Our test" required help="The test on your catalog this value belongs to.">
          <select
            className={inputClass}
            value={catalogItemId}
            onChange={(event) => {
              setCatalogItemId(event.target.value);
              setReferenceParameterId('');
            }}
          >
            <option value="">Choose a test</option>
            {labTests.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}
          </select>
        </FormField>

        <FormField
          label="Which field of that test"
          help={loadingFields ? 'Loading the fields of that test…' : 'Pick the field this value fills. Our reference range for it is what decides high, low or critical.'}
        >
          <select className={inputClass} value={referenceParameterId} onChange={(event) => setReferenceParameterId(event.target.value)} disabled={!catalogItemId || loadingFields}>
            <option value="">{catalogItemId ? 'Choose a field' : 'Choose a test first'}</option>
            {fields.map((field) => <option key={field.id} value={field.id}>{field.name}{field.unit ? ` (${field.unit})` : ''}</option>)}
          </select>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Unit conversion" help={chosenField?.unit ? `Multiply the analyzer's number by this to get ${chosenField.unit}. Leave empty when the units already match.` : "Multiply the analyzer's number by this. Leave empty when the units already match."}>
            <input className={inputClass} value={factor} onChange={(event) => setFactor(event.target.value)} placeholder="e.g. 0.0555" />
          </FormField>
          <FormField label="Unit to show" help="Only if it should differ from the field's own unit.">
            <input className={inputClass} value={unitOverride} onChange={(event) => setUnitOverride(event.target.value)} placeholder={chosenField?.unit || 'mmol/L'} />
          </FormField>
        </div>

        {factor.trim() !== '' && (
          <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            The reading the instrument sent is always kept alongside the converted value, so the conversion can be checked later.
          </p>
        )}
      </div>
    </Modal>
  );
}

export function AnalyzerMappingPage() {
  const { state, dispatch } = useAppStore();
  const data = state.data;
  const devices = data.analyzerDevices || [];
  const maps = data.analyzerTestMaps || [];
  const unmapped = data.analyzerUnmappedCodes || [];
  const labTests = useMemo(() => (data.catalog || []).filter((item) => item.type === 'Lab'), [data.catalog]);

  const [query, setQuery] = useState('');
  const [form, setForm] = useState(null);

  const rows = useMemo(() => maps.filter((map) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [map.analyzerCode, map.testName, map.fieldName, map.deviceName].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
  }), [maps, query]);

  const save = (payload) => {
    dispatch({ type: 'SAVE_ANALYZER_TEST_MAP', payload });
    setForm(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laboratory · Analyzers"
        title="Test mapping"
        description="What each analyzer's own test codes mean here. A code nothing maps is set aside rather than stored in the wrong place."
        actions={<Button onClick={() => setForm({})}><Plus className="h-4 w-4" /> Add a mapping</Button>}
      />

      {unmapped.length > 0 && (
        <Card
          title={`${unmapped.length} code${unmapped.length === 1 ? '' : 's'} waiting to be mapped`}
          subtitle="Codes the analyzers have actually sent that nothing maps yet. Their values were not stored — map a code and replay the message to bring them in."
        >
          <DataTable
            columns={[
              {
                key: 'code',
                label: 'Code sent',
                render: (row) => (
                  <div>
                    <p className="font-mono font-bold text-slate-900">{row.analyzerCode}</p>
                    {row.label && <p className="text-xs text-slate-500">{row.label}</p>}
                  </div>
                )
              },
              { key: 'device', label: 'From', render: (row) => <span className="text-sm font-semibold text-slate-700">{row.deviceName}</span> },
              {
                key: 'example',
                label: 'Example value',
                render: (row) => <span className="text-sm text-slate-600">{row.exampleValue || '—'}{row.unit ? ` ${row.unit}` : ''}</span>
              },
              { key: 'seen', label: 'Last sent', render: (row) => <span className="text-xs text-slate-600">{formatDateTime(row.lastSeenAt)}</span> },
              {
                key: 'actions',
                label: 'Action',
                render: (row) => (
                  <Button onClick={() => setForm({ deviceId: row.deviceId, analyzerCode: row.analyzerCode })}>
                    <Wand2 className="h-4 w-4" /> Map this
                  </Button>
                )
              }
            ]}
            rows={unmapped}
            emptyMessage="Nothing waiting."
          />
        </Card>
      )}

      <Card title="Mappings" subtitle="An analyzer's own mapping is used before a facility-wide one, so one instrument can differ from the rest.">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input aria-label="Search mappings" className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by code, test, field or analyzer..." />
        </div>
        <DataTable
          columns={[
            {
              key: 'mapping',
              label: 'Mapping',
              render: (row) => (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-xs font-bold text-emerald-300">{row.analyzerCode}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <p className="font-bold text-slate-900">{row.fieldName || 'the whole test'}</p>
                    <p className="text-xs text-slate-500">{row.testName}</p>
                  </div>
                </div>
              )
            },
            { key: 'device', label: 'Applies to', render: (row) => <span className="text-sm font-semibold text-slate-700">{row.deviceName}</span> },
            {
              key: 'conversion',
              label: 'Conversion',
              render: (row) => (
                <span className="text-sm text-slate-600">
                  {row.factor ? <>× {row.factor}</> : 'None'}
                  {row.unitOverride ? <span className="text-xs text-slate-500"> → {row.unitOverride}</span> : null}
                </span>
              )
            },
            { key: 'active', label: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'Active' : 'Inactive'} /> },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setForm(row)}><Link2 className="h-4 w-4" /> Edit</Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!window.confirm(`Remove the mapping for "${row.analyzerCode}"?\n\nValues sent with that code will stop being stored until it is mapped again.`)) return;
                      dispatch({ type: 'DELETE_ANALYZER_TEST_MAP', mapId: row.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>
              )
            }
          ]}
          rows={rows}
          emptyMessage={maps.length === 0 ? 'No mappings yet. Many instruments need none at all: a code that already matches one of your field names is recognised on its own.' : 'No mapping matches that search.'}
        />
      </Card>

      {form && (
        <MappingFormModal
          open
          key={form.id || `${form.deviceId || 'all'}:${form.analyzerCode || 'new'}`}
          seed={form}
          devices={devices}
          labTests={labTests}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
