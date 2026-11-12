import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { labTestsService } from '../../services/labTestsService';

/*
  The laboratory's test menu: the procedures themselves, the parameters each one
  reports and the reference ranges behind the flags. Patients' results are not
  here. Billing still sets the price, so a test added without one stays switched
  off until it has been priced.
*/

const GENDERS = [['ALL', 'Everyone'], ['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other']];
const numberOrEmpty = (v) => (v === null || v === undefined ? '' : String(Number(v)));
const toNumber = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

const blankRange = () => ({ gender: 'ALL', ageMin: '0', ageMax: '200', low: '', high: '', criticalLow: '', criticalHigh: '', displayRange: '' });
const blankParameter = () => ({ key: `new-${Math.random().toString(36).slice(2)}`, name: '', unit: '', methodNote: '', ranges: [blankRange()] });

function toDraft(test) {
  return {
    name: test.name,
    sampleType: test.sampleType || '',
    expectedCompletionHours: String(test.expectedCompletionHours ?? 24),
    parameters: (test.parameters || []).map((p) => ({
      key: p.id,
      id: p.id,
      name: p.name,
      unit: p.unit || '',
      methodNote: p.methodNote || '',
      ranges: (p.ranges || []).map((r) => ({
        gender: r.gender, ageMin: String(r.ageMin), ageMax: String(r.ageMax),
        low: numberOrEmpty(r.low), high: numberOrEmpty(r.high), criticalLow: numberOrEmpty(r.criticalLow), criticalHigh: numberOrEmpty(r.criticalHigh),
        displayRange: r.displayRange || ''
      }))
    }))
  };
}

function AddTestModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', sampleType: '', expectedCompletionHours: '24' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm({ name: '', sampleType: '', expectedCompletionHours: '24' }); }, [open]);
  if (!open) return null;
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const ready = form.name.trim().length >= 2 && form.sampleType.trim().length >= 2;
  return (
    <Modal open title="Add a test" description="Create the test, then add its parameters and reference ranges." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready || busy} onClick={async () => { setBusy(true); await onSave({ name: form.name.trim(), sampleType: form.sampleType.trim(), expectedCompletionHours: Number(form.expectedCompletionHours) || 24 }); setBusy(false); }}>Add test</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Test name" required className="sm:col-span-2"><input className={inputClass} value={form.name} onChange={set('name')} maxLength={160} placeholder="e.g. Full blood count" /></FormField>
        <FormField label="Sample type" required><input className={inputClass} value={form.sampleType} onChange={set('sampleType')} maxLength={80} placeholder="Serum, EDTA blood, urine…" /></FormField>
        <FormField label="Turnaround (hours)"><input type="number" min="1" className={inputClass} value={form.expectedCompletionHours} onChange={set('expectedCompletionHours')} /></FormField>
      </div>
    </Modal>
  );
}

function RangeRow({ range, onChange, onRemove }) {
  const set = (key) => (e) => onChange({ ...range, [key]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 sm:grid-cols-4 lg:grid-cols-[7rem_4.5rem_4.5rem_1fr_1fr_1fr_1fr_auto]">
      <select aria-label="Applies to" className={inputClass} value={range.gender} onChange={set('gender')}>{GENDERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input aria-label="Age from" type="number" min="0" className={inputClass} value={range.ageMin} onChange={set('ageMin')} placeholder="Age from" />
      <input aria-label="Age to" type="number" min="0" className={inputClass} value={range.ageMax} onChange={set('ageMax')} placeholder="Age to" />
      <input aria-label="Low" type="number" step="any" className={inputClass} value={range.low} onChange={set('low')} placeholder="Low" />
      <input aria-label="High" type="number" step="any" className={inputClass} value={range.high} onChange={set('high')} placeholder="High" />
      <input aria-label="Critical low" type="number" step="any" className={inputClass} value={range.criticalLow} onChange={set('criticalLow')} placeholder="Critical low" />
      <input aria-label="Critical high" type="number" step="any" className={inputClass} value={range.criticalHigh} onChange={set('criticalHigh')} placeholder="Critical high" />
      <Button size="sm" variant="secondary" aria-label="Remove range" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
      <input aria-label="Text shown on the report" className={`${inputClass} col-span-2 sm:col-span-4 lg:col-span-8`} value={range.displayRange} onChange={set('displayRange')} maxLength={120} placeholder="Optional text shown on the report, e.g. Negative or 4.0 - 11.0" />
    </div>
  );
}

function TestEditor({ test, onBack, onChanged, toast }) {
  const [draft, setDraft] = useState(() => toDraft(test));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(toDraft(test)); }, [test]);

  const setParam = (index, patch) => setDraft((d) => ({ ...d, parameters: d.parameters.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));
  const used = test._count?.orderItems > 0 || test._count?.invoiceItems > 0 || test._count?.analyzerMaps > 0;

  async function save() {
    if (draft.parameters.some((p) => !p.name.trim())) { toast('error', 'Every parameter needs a name.'); return; }
    setSaving(true);
    try {
      await labTestsService.update(apiClient, test.id, { name: draft.name.trim(), sampleType: draft.sampleType.trim(), expectedCompletionHours: Number(draft.expectedCompletionHours) || 24 });
      const saved = await labTestsService.saveParameters(apiClient, test.id, {
        parameters: draft.parameters.map((p) => ({
          ...(p.id ? { id: p.id } : {}),
          name: p.name.trim(), unit: p.unit.trim() || null, methodNote: p.methodNote.trim() || null,
          ranges: p.ranges.map((r) => ({
            gender: r.gender, ageMin: Number(r.ageMin) || 0, ageMax: r.ageMax === '' ? 200 : Number(r.ageMax),
            low: toNumber(r.low), high: toNumber(r.high), criticalLow: toNumber(r.criticalLow), criticalHigh: toNumber(r.criticalHigh),
            displayRange: r.displayRange.trim() || null
          }))
        }))
      });
      toast('success', 'Test saved.');
      onChanged(saved);
    } catch (e) {
      toast('error', e?.message || 'The test could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    try {
      onChanged(await labTestsService.update(apiClient, test.id, { isActive: !test.isActive }));
      toast('success', test.isActive ? 'Test switched off. It can no longer be ordered.' : 'Test switched on.');
    } catch (e) {
      toast('error', e?.message || 'That did not work.');
    }
  }

  async function remove() {
    const message = used
      ? `"${test.name}" has been ordered or reported before, so it will be switched off instead of deleted. Continue?`
      : `Delete "${test.name}" with its parameters and ranges? This cannot be undone.`;
    if (!window.confirm(message)) return;
    try {
      const result = await labTestsService.remove(apiClient, test.id);
      toast('success', result.removed ? 'Test deleted.' : 'Test switched off.');
      if (result.removed) onBack(); else onChanged(result.test);
    } catch (e) {
      toast('error', e?.message || 'That did not work.');
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="secondary" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back to tests</Button>
      <Card
        title={test.name}
        subtitle={`${test.catalogCode}${test.isActive ? '' : ' · switched off'}`}
        actions={(
          <>
            <Button variant="secondary" onClick={toggleActive}>{test.isActive ? 'Switch off' : 'Switch on'}</Button>
            <Button variant="danger" onClick={remove}><Trash2 className="h-4 w-4" /> {used ? 'Retire' : 'Delete'}</Button>
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}</Button>
          </>
        )}
      >
        {test.priced === false || Number(test.price) === 0 ? (
          <p className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">This test has no price yet. Ask billing to set it in the price catalog before it can be ordered.</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Test name" required><input className={inputClass} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} maxLength={160} /></FormField>
          <FormField label="Sample type" required><input className={inputClass} value={draft.sampleType} onChange={(e) => setDraft((d) => ({ ...d, sampleType: e.target.value }))} maxLength={80} /></FormField>
          <FormField label="Turnaround (hours)"><input type="number" min="1" className={inputClass} value={draft.expectedCompletionHours} onChange={(e) => setDraft((d) => ({ ...d, expectedCompletionHours: e.target.value }))} /></FormField>
        </div>
      </Card>

      <Card title="Parameters and reference ranges" subtitle="What this test reports, and the limits that decide whether a value is flagged." actions={<Button variant="secondary" onClick={() => setDraft((d) => ({ ...d, parameters: [...d.parameters, blankParameter()] }))}><Plus className="h-4 w-4" /> Add parameter</Button>}>
        {draft.parameters.length === 0 && <p className="text-sm text-slate-500">No parameters yet. Add one for each value this test reports.</p>}
        <div className="space-y-4">
          {draft.parameters.map((parameter, index) => (
            <section key={parameter.key} aria-label={parameter.name || 'New parameter'} className="rounded-3xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem_1fr_auto]">
                <FormField label="Parameter" required><input className={inputClass} value={parameter.name} onChange={(e) => setParam(index, { name: e.target.value })} maxLength={120} placeholder="e.g. Haemoglobin" /></FormField>
                <FormField label="Unit"><input className={inputClass} value={parameter.unit} onChange={(e) => setParam(index, { unit: e.target.value })} maxLength={40} placeholder="g/dL" /></FormField>
                <FormField label="Method note"><input className={inputClass} value={parameter.methodNote} onChange={(e) => setParam(index, { methodNote: e.target.value })} maxLength={250} /></FormField>
                <div className="flex items-end"><Button variant="secondary" aria-label={`Remove ${parameter.name || 'parameter'}`} onClick={() => setDraft((d) => ({ ...d, parameters: d.parameters.filter((_, i) => i !== index) }))}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Reference ranges</p>
                {parameter.ranges.map((range, rangeIndex) => (
                  <RangeRow key={rangeIndex} range={range}
                    onChange={(next) => setParam(index, { ranges: parameter.ranges.map((r, i) => (i === rangeIndex ? next : r)) })}
                    onRemove={() => setParam(index, { ranges: parameter.ranges.filter((_, i) => i !== rangeIndex) })} />
                ))}
                <Button size="sm" variant="secondary" onClick={() => setParam(index, { ranges: [...parameter.ranges, blankRange()] })}><Plus className="h-3.5 w-3.5" /> Add range</Button>
              </div>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function LabTestsPage() {
  const { dispatch } = useAppStore();
  const [tests, setTests] = useState([]);
  const [search, setSearch] = useState('');
  const [showOff, setShowOff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState('');
  const [adding, setAdding] = useState(false);
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTests(listItems(await labTestsService.list(apiClient, { includeInactive: showOff ? 'true' : 'false' })));
    } catch (e) {
      toast('error', e?.message || 'The tests could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [showOff, toast]);
  useEffect(() => { load(); }, [load]);

  const replace = (updated) => setTests((list) => (list.some((t) => t.id === updated.id) ? list.map((t) => (t.id === updated.id ? updated : t)) : [...list, updated]));
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests.filter((t) => !q || t.name.toLowerCase().includes(q) || t.catalogCode.toLowerCase().includes(q));
  }, [tests, search]);
  const open = tests.find((t) => t.id === openId);

  if (open) {
    return <TestEditor test={open} onBack={() => { setOpenId(''); load(); }} onChanged={replace} toast={toast} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Laboratory" title="Test menu" description="Add, edit or remove the tests this laboratory runs, with the parameters each reports and their reference ranges. Patients’ results are not changed here." />
      <Card
        title="Tests"
        subtitle={loading ? 'Loading…' : `${visible.length} test${visible.length === 1 ? '' : 's'}`}
        actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add test</Button>}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative block min-w-56 flex-1">
            <span className="sr-only">Search tests</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input className={`${inputClass} pl-9`} placeholder="Search by name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" className="h-4 w-4" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> Show switched-off tests</label>
        </div>
        <ul className="divide-y divide-slate-100">
          {visible.map((test) => (
            <li key={test.id}>
              <button type="button" onClick={() => setOpenId(test.id)} className="flex w-full items-center justify-between gap-3 px-2 py-3 text-left hover:bg-slate-50">
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{test.name}</span>
                  <span className="block text-xs text-slate-500">{test.catalogCode} · {test.sampleType || 'No sample type'} · {test.parameters?.length || 0} parameter{test.parameters?.length === 1 ? '' : 's'}</span>
                </span>
                {!test.isActive && <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold uppercase text-slate-600">Off</span>}
              </button>
            </li>
          ))}
          {!loading && visible.length === 0 && <li className="px-2 py-6 text-sm text-slate-500">No tests found.</li>}
        </ul>
      </Card>
      <AddTestModal open={adding} onClose={() => setAdding(false)} onSave={async (payload) => {
        try {
          const created = await labTestsService.create(apiClient, payload);
          replace(created);
          setAdding(false);
          setOpenId(created.id);
          toast('success', 'Test added. Add its parameters and reference ranges.');
        } catch (e) {
          toast('error', e?.message || 'The test could not be added.');
        }
      }} />
    </div>
  );
}
