import { useCallback, useEffect, useMemo, useState } from 'react';
import { Droplets, RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { apiClient } from '../../store/commands';
import { inpatientService } from '../../services/inpatientService';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { VitalsCard } from '../opd/EncounterWorkspace';
import { IP, dayLabel } from './wardUtils';
import { can } from '../opd/opdUtils';

/*
  Tab 1: vitals and the flowsheet.

  Observations are charted with the same form used everywhere else, then drawn as trends so a
  patient who is slowly getting worse is visible at a glance. Beneath them sits the fluid
  balance: what went in, what came out, and the difference, day by day.
*/

const SERIES = [
  { key: 'temperatureC', label: 'Temperature', unit: '°C', low: 36, high: 38 },
  { key: 'pulseBpm', label: 'Pulse', unit: 'bpm', low: 50, high: 110 },
  { key: 'systolicBp', label: 'Systolic BP', unit: 'mmHg', low: 90, high: 140 },
  { key: 'spo2', label: 'SpO₂', unit: '%', low: 94, high: 100 }
];

const W = 260;
const H = 90;
const PAD = 8;

function Trend({ series, points }) {
  const data = points.filter((p) => p.v != null);
  if (data.length === 0) return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <p className="text-xs font-semibold text-slate-600">{series.label}</p>
      <p className="mt-2 text-xs text-slate-400">No readings yet</p>
    </div>
  );
  const values = data.map((p) => p.v);
  const lo = Math.min(...values, series.low);
  const hi = Math.max(...values, series.high);
  const span = hi - lo || 1;
  const x = (i) => (data.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (data.length - 1));
  const y = (v) => H - PAD - ((v - lo) / span) * (H - 2 * PAD);
  const last = data[data.length - 1];
  const outside = last.v < series.low || last.v > series.high;
  const summary = `${series.label} over ${data.length} readings, latest ${last.v} ${series.unit}`;
  return (
    <figure className="rounded-2xl border border-slate-200 p-3" aria-label={summary}>
      <figcaption className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-700">{series.label}</span>
        <span className={`font-bold ${outside ? 'text-red-600' : 'text-slate-900'}`}>{last.v} <span className="font-normal text-slate-500">{series.unit}</span></span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={summary}>
        <rect x={PAD} y={y(series.high)} width={W - 2 * PAD} height={Math.max(y(series.low) - y(series.high), 1)} className="fill-emerald-50" />
        <polyline fill="none" strokeWidth="2" className="stroke-clinical-600" strokeLinejoin="round" points={data.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')} />
        {data.map((p, i) => <circle key={p.t} cx={x(i)} cy={y(p.v)} r="3" className={p.v < series.low || p.v > series.high ? 'fill-red-600' : 'fill-clinical-600'} />)}
      </svg>
    </figure>
  );
}

export function FlowsheetTab({ admission, encounter, auth, open, busy, act, toast, onChanged }) {
  const readings = useMemo(() => [...(encounter.vitalSigns || [])].reverse(), [encounter.vitalSigns]);
  return (
    <div className="space-y-4">
      <Card title="Trends" subtitle="Green band is the usual range. Red points are outside it.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SERIES.map((s) => (
            <Trend key={s.key} series={s} points={readings.map((r) => ({ t: r.id, v: r[s.key] == null ? null : Number(r[s.key]) }))} />
          ))}
        </div>
      </Card>
      <VitalsCard encounter={encounter} auth={auth} open={open} busy={busy} act={async (fn, msg) => { const ok = await act(fn, msg); if (ok) onChanged?.(); return ok; }} latest={encounter.vitalSigns?.[0]} />
      <FluidBalance admission={admission} auth={auth} toast={toast} onChanged={onChanged} />
    </div>
  );
}

const INTAKE_KINDS = ['Oral', 'IV fluid', 'Blood product', 'Tube feed', 'Other'];
const OUTPUT_KINDS = ['Urine', 'Vomit', 'Drain', 'Stool', 'Other'];

function FluidBalance({ admission, auth, toast, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ direction: 'INTAKE', kind: 'Oral', volumeMl: '', note: '' });
  const [saving, setSaving] = useState(false);
  const open = admission.status === 'ADMITTED';
  const mayRecord = open && can(auth, IP.ADMINISTER);

  const load = useCallback(async () => {
    try {
      setData(await inpatientService.fluids(apiClient, admission.id, 3));
      setError('');
    } catch (e) {
      setError(e?.message || 'The fluid balance could not be loaded.');
    }
  }, [admission.id]);
  useEffect(() => {
    load();
  }, [load]);

  const kinds = form.direction === 'INTAKE' ? INTAKE_KINDS : OUTPUT_KINDS;
  const today = data?.totals?.[0]?.day;

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await inpatientService.recordFluid(apiClient, admission.id, { direction: form.direction, kind: form.kind, volumeMl: Number(form.volumeMl), note: form.note.trim() || undefined });
      toast('success', `${form.direction === 'INTAKE' ? 'Intake' : 'Output'} of ${form.volumeMl} mL recorded.`);
      setForm((c) => ({ ...c, volumeMl: '', note: '' }));
      await load();
      onChanged?.();
    } catch (e) {
      toast('error', e?.message || 'That could not be recorded.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Fluid balance" subtitle="Intake and output, in millilitres." actions={<Button size="sm" variant="ghost" aria-label="Refresh fluid balance" onClick={load}><RefreshCw className="h-4 w-4" /></Button>}>
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      {mayRecord && (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-5">
          <FormField label="Type">
            <select className={inputClass} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value, kind: e.target.value === 'INTAKE' ? INTAKE_KINDS[0] : OUTPUT_KINDS[0] })}>
              <option value="INTAKE">Intake (in)</option>
              <option value="OUTPUT">Output (out)</option>
            </select>
          </FormField>
          <FormField label="Kind">
            <select className={inputClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </FormField>
          <FormField label="Volume (mL)" required><input type="number" inputMode="numeric" min="1" max="10000" className={inputClass} value={form.volumeMl} onChange={(e) => setForm({ ...form, volumeMl: e.target.value })} /></FormField>
          <FormField label="Note"><input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={240} /></FormField>
          <div className="flex items-end"><Button type="submit" variant="secondary" disabled={saving || !(Number(form.volumeMl) > 0)}><Droplets className="h-4 w-4" /> Add</Button></div>
        </form>
      )}
      {data && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-[0.06em] text-slate-500"><th scope="col" className="py-1 pr-3">Day</th><th scope="col" className="py-1 pr-3">In</th><th scope="col" className="py-1 pr-3">Out</th><th scope="col" className="py-1">Balance</th></tr></thead>
              <tbody>
                {data.totals.map((t) => (
                  <tr key={t.day} className="border-t border-slate-100">
                    <th scope="row" className="py-1.5 pr-3 text-left font-semibold text-slate-800">{dayLabel(t.day, today)}</th>
                    <td className="py-1.5 pr-3">{t.intake} mL</td>
                    <td className="py-1.5 pr-3">{t.output} mL</td>
                    <td className={`py-1.5 font-bold ${t.balance < 0 ? 'text-amber-700' : 'text-slate-900'}`}>{t.balance > 0 ? '+' : ''}{t.balance} mL</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 max-h-48 space-y-0.5 overflow-y-auto text-xs text-slate-600" aria-label="Recent entries">
            {listItems(data).length === 0 && <li>Nothing recorded in the last three days.</li>}
            {listItems(data).map((e) => (
              <li key={e.id}>{formatDateTime(e.recordedAt)} · {e.direction === 'INTAKE' ? 'In' : 'Out'} · {e.kind} · {e.volumeMl} mL{e.note ? ` · ${e.note}` : ''}{e.recordedBy ? ` · ${e.recordedBy.name}` : ''}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
