import { useEffect, useState } from 'react';
import { ClipboardPlus, History } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { can } from '../opd/opdUtils';
import { CLINICS, FORMS, PERMANENT_TEETH, PRIMARY_TEETH, TOOTH_CONDITIONS, formsFor } from './clinicConfig';

/** Structured specialty forms on a visit: what has been recorded, and buttons to record more. */
export function ClinicalFormsCard({ encounter, auth, open, busy, act }) {
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  const modules = auth?.modules;
  const clinician = can(auth, 'encounters:consult');
  const offered = formsFor(encounter.clinic, modules).filter((type) => clinician || !FORMS[type].clinicianOnly);
  const forms = encounter.forms || [];
  // The clinic's main form, whose earlier versions matter most (e.g. the last dental chart).
  const primary = (CLINICS[encounter.clinic]?.forms || []).find((type) => offered.includes(type));
  // Only show the card where it is relevant: specialty visits, or visits that already have forms.
  if (encounter.clinic === 'GENERAL' && forms.length === 0 && !offered.length) return null;

  return (
    <Card
      title="Specialty forms"
      subtitle={forms.length ? `${forms.length} recorded on this visit` : 'Structured findings for this clinic.'}
      actions={primary && (
        <Button size="sm" variant="ghost" onClick={() => setHistory(primary)}><History className="h-3.5 w-3.5" /> Earlier {FORMS[primary].label.toLowerCase()}s</Button>
      )}
    >
      <div className="space-y-3">
        {forms.map((form) => (
          <article key={form.id} className="rounded-2xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
              {FORMS[form.type]?.label || form.type} · {form.author?.name || 'Unknown'} · {formatDateTime(form.createdAt)}{form.amendsId ? ' · correction' : ''}
            </p>
            <FormSummary type={form.type} data={form.data} />
            {open && (clinician || !FORMS[form.type]?.clinicianOnly) && (
              <button type="button" className="mt-2 text-xs font-semibold text-clinical-700 hover:underline" onClick={() => setEditing({ type: form.type, amends: form })}>Correct</button>
            )}
          </article>
        ))}
        {open && offered.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {offered.map((type) => (
              <Button key={type} size="sm" variant="secondary" disabled={busy} onClick={() => setEditing({ type })}><ClipboardPlus className="h-3.5 w-3.5" /> {FORMS[type].label}</Button>
            ))}
          </div>
        )}
      </div>
      <FormModal
        editing={editing}
        busy={busy}
        onClose={() => setEditing(null)}
        onSave={async (data) => {
          const ok = await act(() => encounterService.addForm(apiClient, encounter.id, { type: editing.type, data, amendsId: editing.amends?.id }), `${FORMS[editing.type].label} recorded.`);
          if (ok) setEditing(null);
        }}
      />
      <HistoryModal type={history} patientId={encounter.patient.id} onClose={() => setHistory(null)} />
    </Card>
  );
}

function HistoryModal({ type, patientId, onClose }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (!type) return;
    setItems(null);
    encounterService.patientForms(apiClient, patientId, { type }).then((data) => setItems(listItems(data))).catch(() => setItems([]));
  }, [type, patientId]);
  return (
    <Modal open={Boolean(type)} title={`Earlier ${FORMS[type]?.label.toLowerCase() || 'form'}s`} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {!items ? <p className="text-sm text-slate-500">Loading…</p> : items.length === 0 ? <p className="text-sm text-slate-500">None recorded before.</p> : (
        <div className="space-y-3">
          {items.map((form) => (
            <article key={form.id} className="rounded-2xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{form.encounter?.encounterCode} · {form.author?.name || 'Unknown'} · {formatDateTime(form.createdAt)}</p>
              <FormSummary type={form.type} data={form.data} />
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------ read views */

function Line({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return <p className="text-sm text-slate-800"><span className="font-semibold">{label}:</span> {value}</p>;
}

function FormSummary({ type, data }) {
  if (!data) return null;
  if (type === 'DENTAL_CHART') {
    return (
      <div className="mt-2 space-y-1">
        {data.teeth?.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {data.teeth.map((t) => (
              <li key={t.tooth} className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${TOOTH_CONDITIONS[t.condition]?.className}`}>
                {t.tooth} {TOOTH_CONDITIONS[t.condition]?.label}{t.surfaces?.length ? ` (${t.surfaces.join('')})` : ''}
              </li>
            ))}
          </ul>
        )}
        <Line label="Oral hygiene" value={data.oralHygiene?.toLowerCase()} />
        <Line label="Gums" value={data.gums} />
        <Line label="Done today" value={data.treatmentsDone?.map((t) => `${t.tooth ? `${t.tooth}: ` : ''}${t.procedure}`).join('; ')} />
        <Line label="Plan" value={data.treatmentPlan} />
        <Line label="Notes" value={data.notes} />
      </div>
    );
  }
  if (type === 'EYE_EXAM') {
    const row = (side) => [side?.unaided && `VA ${side.unaided}`, side?.pinhole && `PH ${side.pinhole}`, side?.corrected && `BCVA ${side.corrected}`, side?.iopMmHg != null && `IOP ${side.iopMmHg} mmHg`,
      side?.sphere != null && `Rx ${side.sphere > 0 ? '+' : ''}${side.sphere}${side.cylinder != null ? ` / ${side.cylinder} × ${side.axis}` : ''}${side.add ? ` add +${side.add}` : ''}`].filter(Boolean).join(' · ');
    return (
      <div className="mt-2 space-y-1">
        <Line label="Right (OD)" value={row(data.right)} />
        <Line label="Left (OS)" value={row(data.left)} />
        <Line label="Anterior segment" value={[data.right?.anteriorSegment && `OD ${data.right.anteriorSegment}`, data.left?.anteriorSegment && `OS ${data.left.anteriorSegment}`].filter(Boolean).join('; ')} />
        <Line label="Fundus" value={[data.right?.fundus && `OD ${data.right.fundus}`, data.left?.fundus && `OS ${data.left.fundus}`].filter(Boolean).join('; ')} />
        <Line label="Impression" value={data.impression} />
        <Line label="Plan" value={[data.plan, data.glassesPrescribed ? 'Glasses prescribed' : ''].filter(Boolean).join('. ')} />
      </div>
    );
  }
  if (type === 'PHYSIO_ASSESSMENT') {
    return (
      <div className="mt-2 space-y-1">
        <Line label="Complaint" value={data.presentingComplaint} />
        <Line label="Area" value={data.affectedArea} />
        <Line label="Pain" value={data.painScore != null ? `${data.painScore}/10` : null} />
        <Line label="Range of motion" value={data.rangeOfMotion} />
        <Line label="Strength" value={data.muscleStrength} />
        <Line label="Function" value={data.functionalLimitations} />
        <Line label="Special tests" value={data.specialTests} />
        <Line label="Goals" value={data.goals} />
        <Line label="Plan" value={[data.plan, data.plannedSessions && `${data.plannedSessions} sessions`].filter(Boolean).join(' · ')} />
      </div>
    );
  }
  if (type === 'PHYSIO_SESSION') {
    return (
      <div className="mt-2 space-y-1">
        <Line label="Session" value={data.sessionNumber} />
        <Line label="Treatment" value={data.treatments?.join('; ')} />
        <Line label="Pain" value={data.painBefore != null || data.painAfter != null ? `${data.painBefore ?? '?'} → ${data.painAfter ?? '?'} /10` : null} />
        <Line label="Response" value={data.response} />
        <Line label="Home exercises" value={data.homeExercises} />
        <Line label="Next" value={data.nextSession} />
      </div>
    );
  }
  if (type === 'NUTRITION_ASSESSMENT') {
    const d = data.derived || {};
    return (
      <div className="mt-2 space-y-1">
        <Line label="Measurements" value={[`${data.weightKg} kg`, data.heightCm && `${data.heightCm} cm`, data.muacCm && `MUAC ${data.muacCm} cm`, data.oedema && data.oedema !== 'NONE' && `oedema ${data.oedema.toLowerCase()}`].filter(Boolean).join(' · ')} />
        {(d.bmi || d.muacCategory) && (
          <p className={`text-sm font-semibold ${/severe|obese|undernourished/i.test(`${d.bmiCategory} ${d.muacCategory}`) ? 'text-red-700' : 'text-slate-800'}`}>
            {[d.bmi && `BMI ${d.bmi} (${d.bmiCategory})`, d.muacCategory && `MUAC: ${d.muacCategory}`].filter(Boolean).join(' · ')}
          </p>
        )}
        <Line label="Diet history" value={data.dietHistory} />
        <Line label="Nutrition diagnosis" value={data.nutritionDiagnosis} />
        <Line label="Plan" value={[data.plan, data.followUpWeeks && `review in ${data.followUpWeeks} week${data.followUpWeeks === 1 ? '' : 's'}`].filter(Boolean).join(' · ')} />
      </div>
    );
  }
  return <pre className="mt-2 overflow-x-auto text-xs text-slate-600">{JSON.stringify(data, null, 2)}</pre>;
}

/* --------------------------------------------------------------- editors */

const blankFor = (type) => ({
  DENTAL_CHART: { teeth: {}, oralHygiene: '', gums: '', treatmentsDone: '', treatmentPlan: '', notes: '', primary: false },
  EYE_EXAM: { right: {}, left: {}, iopMethod: '', glassesPrescribed: false, impression: '', plan: '' },
  PHYSIO_ASSESSMENT: { presentingComplaint: '', affectedArea: '', painScore: '', rangeOfMotion: '', muscleStrength: '', functionalLimitations: '', specialTests: '', goals: '', plannedSessions: '', plan: '' },
  PHYSIO_SESSION: { sessionNumber: '', treatments: '', painBefore: '', painAfter: '', response: '', homeExercises: '', nextSession: '' },
  NUTRITION_ASSESSMENT: { weightKg: '', heightCm: '', muacCm: '', oedema: 'NONE', dietHistory: '', nutritionDiagnosis: '', plan: '', followUpWeeks: '' }
}[type]);

/** Loads an earlier form back into editor state, for corrections. */
function fromData(type, data) {
  const blank = blankFor(type);
  if (!data) return blank;
  if (type === 'DENTAL_CHART') {
    return {
      ...blank,
      teeth: Object.fromEntries((data.teeth || []).map((t) => [t.tooth, { condition: t.condition, surfaces: t.surfaces || [], note: t.note || '' }])),
      oralHygiene: data.oralHygiene || '', gums: data.gums || '', treatmentPlan: data.treatmentPlan || '', notes: data.notes || '',
      treatmentsDone: (data.treatmentsDone || []).map((t) => `${t.tooth ? `${t.tooth}: ` : ''}${t.procedure}`).join('\n'),
      primary: (data.teeth || []).some((t) => Number(t.tooth) > 50)
    };
  }
  if (type === 'PHYSIO_SESSION') return { ...blank, ...stringify(data), treatments: (data.treatments || []).join('\n') };
  if (type === 'EYE_EXAM') return { ...blank, ...data, right: stringify(data.right || {}), left: stringify(data.left || {}) };
  const { derived, ...rest } = data;
  void derived;
  return { ...blank, ...stringify(rest) };
}

function stringify(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v]));
}

const num = (v) => (v === '' || v === undefined || v === null ? undefined : Number(v));
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/** Converts editor state to the API payload for each form type. */
function toPayload(type, f) {
  if (type === 'DENTAL_CHART') {
    return clean({
      teeth: Object.entries(f.teeth).map(([tooth, t]) => clean({ tooth, condition: t.condition, surfaces: t.surfaces?.length ? t.surfaces : undefined, note: str(t.note) })),
      oralHygiene: f.oralHygiene || undefined,
      gums: str(f.gums),
      treatmentsDone: f.treatmentsDone.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
        const m = line.match(/^(\d{2})\s*[:-]\s*(.+)$/);
        return m ? { tooth: m[1], procedure: m[2] } : { procedure: line };
      }),
      treatmentPlan: str(f.treatmentPlan),
      notes: str(f.notes)
    });
  }
  if (type === 'EYE_EXAM') {
    const side = (s) => clean({ unaided: str(s.unaided), pinhole: str(s.pinhole), corrected: str(s.corrected), iopMmHg: num(s.iopMmHg), sphere: num(s.sphere), cylinder: num(s.cylinder), axis: num(s.axis), add: num(s.add), anteriorSegment: str(s.anteriorSegment), fundus: str(s.fundus) });
    return clean({ right: side(f.right), left: side(f.left), iopMethod: f.iopMethod || undefined, glassesPrescribed: f.glassesPrescribed, impression: str(f.impression), plan: str(f.plan) });
  }
  if (type === 'PHYSIO_SESSION') {
    return clean({ sessionNumber: num(f.sessionNumber), treatments: f.treatments.split('\n').map((l) => l.trim()).filter(Boolean), painBefore: num(f.painBefore), painAfter: num(f.painAfter), response: str(f.response), homeExercises: str(f.homeExercises), nextSession: str(f.nextSession) });
  }
  const numeric = ['painScore', 'plannedSessions', 'weightKg', 'heightCm', 'muacCm', 'followUpWeeks'];
  return clean(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, numeric.includes(k) ? num(v) : typeof v === 'string' ? (k === 'oedema' ? v : str(v)) : v])));
}

function FormModal({ editing, ...props }) {
  if (!editing) return null;
  // Keyed so each form (and each correction) starts from its own state, never the previous editor's.
  return <FormEditorModal key={`${editing.type}:${editing.amends?.id || 'new'}`} editing={editing} {...props} />;
}

function FormEditorModal({ editing, busy, onClose, onSave }) {
  const [form, setForm] = useState(() => fromData(editing.type, editing.amends?.data));
  const Editor = { DENTAL_CHART: DentalChartEditor, EYE_EXAM: EyeExamEditor, PHYSIO_ASSESSMENT: PhysioAssessmentEditor, PHYSIO_SESSION: PhysioSessionEditor, NUTRITION_ASSESSMENT: NutritionEditor }[editing.type];
  return (
    <Modal open title={`${editing.amends ? 'Correct' : 'Record'} ${FORMS[editing.type].label.toLowerCase()}`} description={editing.amends ? 'The original stays on the record; this correction is added after it.' : undefined} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={() => onSave(toPayload(editing.type, form))}>{busy ? 'Saving…' : 'Save'}</Button></>}>
      <Editor form={form} setForm={setForm} />
    </Modal>
  );
}

function useField(form, setForm) {
  return (key) => ({ value: form[key] ?? '', onChange: (e) => setForm((c) => ({ ...c, [key]: e.target.value })) });
}

function DentalChartEditor({ form, setForm }) {
  const [selected, setSelected] = useState('');
  const field = useField(form, setForm);
  const set = form.primary ? PRIMARY_TEETH : PERMANENT_TEETH;
  const tooth = selected ? form.teeth[selected] : null;
  const setTooth = (patch) => setForm((c) => ({ ...c, teeth: { ...c.teeth, [selected]: { condition: 'SOUND', surfaces: [], note: '', ...c.teeth[selected], ...patch } } }));
  const clearTooth = () => setForm((c) => { const teeth = { ...c.teeth }; delete teeth[selected]; return { ...c, teeth }; });
  const row = (teeth) => (
    <div className="grid grid-cols-8 gap-1 sm:grid-cols-16" style={{ gridTemplateColumns: `repeat(${teeth.length}, minmax(0, 1fr))` }}>
      {teeth.map((n) => {
        const t = form.teeth[String(n)];
        return (
          <button key={n} type="button" aria-pressed={selected === String(n)} aria-label={`Tooth ${n}${t ? `, ${TOOTH_CONDITIONS[t.condition].label}` : ''}`} onClick={() => setSelected(String(n))}
            className={`rounded-md border px-0.5 py-1.5 text-[11px] font-bold ${t ? TOOTH_CONDITIONS[t.condition].className : 'border-slate-200 bg-slate-50 text-slate-500'} ${selected === String(n) ? 'ring-2 ring-clinical-500' : ''}`}>
            {n}
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input type="checkbox" className="h-4 w-4" checked={form.primary} onChange={(e) => { setSelected(''); setForm((c) => ({ ...c, primary: e.target.checked })); }} /> Primary (milk) teeth
      </label>
      <div className="space-y-1 overflow-x-auto">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Upper · patient's right on the left</p>
        {row(set.upper)}
        {row(set.lower)}
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Lower</p>
      </div>
      {selected ? (
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="mb-2 text-sm font-bold text-slate-900">Tooth {selected}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Condition">
              <select className={inputClass} value={tooth?.condition || ''} onChange={(e) => (e.target.value ? setTooth({ condition: e.target.value }) : clearTooth())}>
                <option value="">Not charted</option>
                {Object.entries(TOOTH_CONDITIONS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </FormField>
            <FormField label="Note"><input className={inputClass} value={tooth?.note || ''} disabled={!tooth} onChange={(e) => setTooth({ note: e.target.value })} maxLength={200} /></FormField>
          </div>
          {tooth && (
            <fieldset className="mt-2 flex flex-wrap gap-3 text-sm">
              <legend className="mb-1 text-xs font-semibold text-slate-600">Surfaces</legend>
              {[['M', 'Mesial'], ['O', 'Occlusal'], ['D', 'Distal'], ['B', 'Buccal'], ['L', 'Lingual'], ['I', 'Incisal']].map(([s, name]) => (
                <label key={s} className="flex items-center gap-1">
                  <input type="checkbox" checked={tooth.surfaces?.includes(s)} onChange={(e) => setTooth({ surfaces: e.target.checked ? [...(tooth.surfaces || []), s] : tooth.surfaces.filter((x) => x !== s) })} /> {name}
                </label>
              ))}
            </fieldset>
          )}
        </div>
      ) : <p className="text-sm text-slate-500">Choose a tooth to chart it. {Object.keys(form.teeth).length} charted.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Oral hygiene">
          <select className={inputClass} {...field('oralHygiene')}>
            <option value="">Not assessed</option><option value="GOOD">Good</option><option value="FAIR">Fair</option><option value="POOR">Poor</option>
          </select>
        </FormField>
        <FormField label="Gums"><input className={inputClass} {...field('gums')} maxLength={500} /></FormField>
      </div>
      <FormField label="Treatment done today" help="One per line; start with the tooth number, e.g. 36: Amalgam filling."><textarea rows={3} className={inputClass} {...field('treatmentsDone')} /></FormField>
      <FormField label="Treatment plan"><textarea rows={2} className={inputClass} {...field('treatmentPlan')} maxLength={2000} /></FormField>
      <FormField label="Notes"><input className={inputClass} {...field('notes')} maxLength={2000} /></FormField>
    </div>
  );
}

function EyeExamEditor({ form, setForm }) {
  const field = useField(form, setForm);
  const sideField = (side, key) => ({ value: form[side][key] ?? '', onChange: (e) => setForm((c) => ({ ...c, [side]: { ...c[side], [key]: e.target.value } })) });
  const rows = [['unaided', 'VA unaided', '6/6'], ['pinhole', 'VA pinhole', '6/6'], ['corrected', 'Best corrected VA', '6/6'], ['iopMmHg', 'IOP (mmHg)', '16'], ['sphere', 'Sphere', '-1.25'], ['cylinder', 'Cylinder', '-0.50'], ['axis', 'Axis (°)', '90'], ['add', 'Add', '+2.00'], ['anteriorSegment', 'Anterior segment', ''], ['fundus', 'Fundus', '']];
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-[0.06em] text-slate-500"><th className="py-1 pr-2" /><th className="px-1">Right (OD)</th><th className="px-1">Left (OS)</th></tr></thead>
          <tbody>
            {rows.map(([key, label, placeholder]) => (
              <tr key={key}>
                <th scope="row" className="py-1 pr-2 text-left font-semibold text-slate-700">{label}</th>
                {['right', 'left'].map((side) => (
                  <td key={side} className="px-1 py-1"><input aria-label={`${label} ${side}`} className={inputClass} placeholder={placeholder} {...sideField(side, key)} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Acuity as Snellen (6/6, 6/60) or CF, HM, PL, NPL. Refraction in 0.25 steps; a cylinder needs an axis.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="IOP method">
          <select className={inputClass} {...field('iopMethod')}>
            <option value="">—</option><option value="NON_CONTACT">Non-contact</option><option value="APPLANATION">Applanation</option><option value="SCHIOTZ">Schiøtz</option><option value="PALPATION">Palpation</option>
          </select>
        </FormField>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-slate-800">
          <input type="checkbox" className="h-4 w-4" checked={form.glassesPrescribed} onChange={(e) => setForm((c) => ({ ...c, glassesPrescribed: e.target.checked }))} /> Glasses prescribed
        </label>
      </div>
      <FormField label="Impression"><input className={inputClass} {...field('impression')} maxLength={1000} /></FormField>
      <FormField label="Plan"><textarea rows={2} className={inputClass} {...field('plan')} maxLength={2000} /></FormField>
    </div>
  );
}

function PhysioAssessmentEditor({ form, setForm }) {
  const field = useField(form, setForm);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label="Presenting complaint" required className="sm:col-span-2"><input className={inputClass} {...field('presentingComplaint')} maxLength={1000} /></FormField>
      <FormField label="Affected area" required><input className={inputClass} {...field('affectedArea')} maxLength={200} placeholder="e.g. Right knee" /></FormField>
      <FormField label="Pain (0-10)"><input type="number" min="0" max="10" className={inputClass} {...field('painScore')} /></FormField>
      <FormField label="Range of motion"><input className={inputClass} {...field('rangeOfMotion')} maxLength={1000} /></FormField>
      <FormField label="Muscle strength"><input className={inputClass} {...field('muscleStrength')} maxLength={1000} placeholder="e.g. Quadriceps 4/5" /></FormField>
      <FormField label="Functional limitations" className="sm:col-span-2"><input className={inputClass} {...field('functionalLimitations')} maxLength={1000} /></FormField>
      <FormField label="Special tests" className="sm:col-span-2"><input className={inputClass} {...field('specialTests')} maxLength={1000} /></FormField>
      <FormField label="Goals" required className="sm:col-span-2"><input className={inputClass} {...field('goals')} maxLength={1000} /></FormField>
      <FormField label="Planned sessions"><input type="number" min="1" max="100" className={inputClass} {...field('plannedSessions')} /></FormField>
      <FormField label="Plan"><input className={inputClass} {...field('plan')} maxLength={2000} /></FormField>
    </div>
  );
}

function PhysioSessionEditor({ form, setForm }) {
  const field = useField(form, setForm);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField label="Session number"><input type="number" min="1" className={inputClass} {...field('sessionNumber')} /></FormField>
      <FormField label="Pain before (0-10)"><input type="number" min="0" max="10" className={inputClass} {...field('painBefore')} /></FormField>
      <FormField label="Pain after (0-10)"><input type="number" min="0" max="10" className={inputClass} {...field('painAfter')} /></FormField>
      <FormField label="Treatment given" required help="One per line." className="sm:col-span-3"><textarea rows={3} className={inputClass} {...field('treatments')} placeholder={'TENS 15 min\nStrengthening exercises'} /></FormField>
      <FormField label="Response" className="sm:col-span-3"><input className={inputClass} {...field('response')} maxLength={1000} /></FormField>
      <FormField label="Home exercises" className="sm:col-span-2"><input className={inputClass} {...field('homeExercises')} maxLength={1000} /></FormField>
      <FormField label="Next session"><input className={inputClass} {...field('nextSession')} maxLength={200} /></FormField>
    </div>
  );
}

function NutritionEditor({ form, setForm }) {
  const field = useField(form, setForm);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label="Weight (kg)" required><input type="number" step="0.1" min="0.3" className={inputClass} {...field('weightKg')} /></FormField>
      <FormField label="Height / length (cm)"><input type="number" step="0.1" className={inputClass} {...field('heightCm')} /></FormField>
      <FormField label="MUAC (cm)"><input type="number" step="0.1" className={inputClass} {...field('muacCm')} /></FormField>
      <FormField label="Bilateral pitting oedema">
        <select className={inputClass} {...field('oedema')}>
          <option value="NONE">None</option><option value="MILD">Mild (+)</option><option value="MODERATE">Moderate (++)</option><option value="SEVERE">Severe (+++)</option>
        </select>
      </FormField>
      <FormField label="Diet history" className="sm:col-span-2"><textarea rows={2} className={inputClass} {...field('dietHistory')} maxLength={2000} /></FormField>
      <FormField label="Nutrition diagnosis" required className="sm:col-span-2"><input className={inputClass} {...field('nutritionDiagnosis')} maxLength={500} /></FormField>
      <FormField label="Diet plan" required className="sm:col-span-2"><textarea rows={3} className={inputClass} {...field('plan')} maxLength={2000} /></FormField>
      <FormField label="Review in (weeks)"><input type="number" min="1" max="52" className={inputClass} {...field('followUpWeeks')} /></FormField>
      <p className="self-end pb-3 text-xs text-slate-500">BMI and the MUAC category are worked out when you save.</p>
    </div>
  );
}
