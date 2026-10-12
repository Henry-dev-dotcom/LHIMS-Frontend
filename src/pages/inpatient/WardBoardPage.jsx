import { useCallback, useEffect, useState } from 'react';
import { BedDouble, Plus, RefreshCw, Sparkles, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { inpatientService } from '../../services/inpatientService';
import { encounterService } from '../../services/encounterService';
import { listItems } from '../../api/normalizers';
import { can, patientName } from '../opd/opdUtils';
import { InpatientWorkspace } from './InpatientWorkspace';
import { IP, bedDots } from './wardUtils';

const BED_STYLE = {
  AVAILABLE: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  OCCUPIED: 'border-clinical-300 bg-clinical-50 text-slate-900',
  CLEANING: 'border-amber-300 bg-amber-50 text-amber-900',
  OUT_OF_SERVICE: 'border-slate-300 bg-slate-100 text-slate-500'
};
const BED_LABEL = { AVAILABLE: 'Free', OCCUPIED: 'Occupied', CLEANING: 'Being cleaned', OUT_OF_SERVICE: 'Out of service' };

export function WardBoardPage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdmission, setOpenAdmission] = useState('');
  const [admitBed, setAdmitBed] = useState(null);
  const [wardModal, setWardModal] = useState(false);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWards(listItems(await inpatientService.board(apiClient)));
    } catch (error) {
      toast('error', error?.message || 'Wards could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!openAdmission) load();
  }, [load, openAdmission]);

  async function markBed(bed, status) {
    try {
      await inpatientService.setBedStatus(apiClient, bed.id, status);
      await load();
      toast('success', `Bed ${bed.label}: ${BED_LABEL[status].toLowerCase()}.`);
    } catch (error) {
      toast('error', error?.message || 'The bed could not be updated.');
    }
  }

  if (openAdmission) {
    return <InpatientWorkspace admissionId={openAdmission} onClose={() => setOpenAdmission('')} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Wards" title="Ward board" description="Every bed at a glance. A red dot means a dose or observations are due; a yellow dot means new results are waiting for a doctor." />
      <Card
        title="Wards"
        subtitle={loading ? 'Loading…' : `${wards.reduce((n, w) => n + w.occupancy.occupied, 0)} of ${wards.reduce((n, w) => n + w.occupancy.total, 0)} beds occupied`}
        actions={(
          <>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            {can(auth, IP.WARDS) && <Button onClick={() => setWardModal(true)}><Plus className="h-4 w-4" /> New ward</Button>}
          </>
        )}
      >
        {!loading && wards.length === 0 && <p className="text-sm text-slate-500">No wards yet.{can(auth, IP.WARDS) ? ' Create the first one.' : ''}</p>}
        <div className="space-y-6">
          {wards.map((ward) => (
            <section key={ward.id} aria-label={ward.name}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900">{ward.name} {!ward.isActive && <span className="text-sm font-normal text-slate-500">(closed)</span>}</h3>
                <p className="text-xs text-slate-500">{ward.gender === 'MIXED' ? 'Mixed' : ward.gender === 'MALE' ? 'Male' : 'Female'} · {ward.occupancy.occupied}/{ward.occupancy.total} occupied · {Number(ward.dailyRate).toFixed(2)} per night</p>
              </div>
              <ul className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {ward.beds.map((bed) => (
                  <li key={bed.id} className={`rounded-2xl border p-3 text-sm ${BED_STYLE[bed.status]}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold"><BedDouble className="h-4 w-4" aria-hidden="true" /> {bed.label}</span>
                      <span className="text-[11px] font-semibold uppercase">{BED_LABEL[bed.status]}</span>
                    </div>
                    {bed.admission ? (
                      <BedPatient admission={bed.admission} onOpen={() => setOpenAdmission(bed.admission.id)} />
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {bed.status === 'AVAILABLE' && ward.isActive && can(auth, IP.ADMIT) && (
                          <Button size="sm" variant="secondary" onClick={() => setAdmitBed({ ward, bed })}><UserPlus className="h-3.5 w-3.5" /> Admit</Button>
                        )}
                        {bed.status === 'CLEANING' && can(auth, IP.BED_STATUS) && (
                          <Button size="sm" variant="secondary" onClick={() => markBed(bed, 'AVAILABLE')}><Sparkles className="h-3.5 w-3.5" /> Ready</Button>
                        )}
                        {bed.status === 'OUT_OF_SERVICE' && can(auth, IP.BED_STATUS) && (
                          <Button size="sm" variant="ghost" onClick={() => markBed(bed, 'AVAILABLE')}>Return to service</Button>
                        )}
                        {bed.status === 'AVAILABLE' && can(auth, IP.BED_STATUS) && (
                          <Button size="sm" variant="ghost" onClick={() => markBed(bed, 'OUT_OF_SERVICE')}>Out of service</Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Card>

      <DirectAdmitModal target={admitBed} wards={wards} onClose={() => setAdmitBed(null)} onAdmitted={(admission) => { setAdmitBed(null); toast('success', `${patientName(admission.patient)} admitted to bed ${admission.bed.label}.`); setOpenAdmission(admission.id); }} />
      <NewWardModal open={wardModal} onClose={() => setWardModal(false)} onSaved={() => { setWardModal(false); toast('success', 'Ward created.'); load(); }} />
    </div>
  );
}

/** Planned (elective) admission straight onto a chosen bed. */
function DirectAdmitModal({ target, wards, onClose, onAdmitted }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (target) {
      setSearch('');
      setResults([]);
      setPatient(null);
      setReason('');
      setError('');
    }
  }, [target]);

  async function find(event) {
    event.preventDefault();
    if (search.trim().length < 2) return;
    setResults(listItems(await encounterService.searchPatients(apiClient, search.trim())));
  }

  async function admit() {
    setSaving(true);
    setError('');
    try {
      onAdmitted(await inpatientService.admit(apiClient, { patientId: patient.id, wardId: target.ward.id, bedId: target.bed.id, reason: reason.trim() }));
    } catch (e) {
      setError(e?.message || 'The patient could not be admitted.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={Boolean(target)} title={target ? `Admit to ${target.ward.name}, bed ${target.bed.label}` : 'Admit'}
      description="For planned admissions. To admit from a clinic or emergency visit, use Admit to ward inside the visit."
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!patient || reason.trim().length < 3 || saving} onClick={admit}>{saving ? 'Admitting…' : 'Admit'}</Button></>}>
      <div className="space-y-4">
        {!patient ? (
          <>
            <form onSubmit={find} className="flex gap-2">
              <label className="sr-only" htmlFor="admit-search">Search patients</label>
              <input id="admit-search" className={inputClass} placeholder="Name, patient number or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button type="submit" variant="secondary">Find</Button>
            </form>
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200">
              {results.map((p) => (
                <li key={p.id}><button type="button" className="w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => setPatient(p)}><span className="font-semibold">{patientName(p)}</span> <span className="text-xs text-slate-500">{p.patientCode}</span></button></li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex items-center justify-between rounded-2xl bg-clinical-50 px-4 py-3">
            <span className="font-semibold">{patientName(patient)} <span className="text-xs font-normal text-slate-600">{patient.patientCode}</span></span>
            <button type="button" className="text-sm font-semibold text-clinical-700 hover:underline" onClick={() => setPatient(null)}>Change</button>
          </div>
        )}
        <FormField label="Reason for admission" required><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Elective hernia repair" /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

function NewWardModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ code: '', name: '', type: 'GENERAL', gender: 'MIXED', dailyRate: '', beds: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({ code: '', name: '', type: 'GENERAL', gender: 'MIXED', dailyRate: '', beds: '' });
      setError('');
    }
  }, [open]);
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const beds = form.beds.split(',').map((b) => b.trim()).filter(Boolean);
  async function save() {
    setSaving(true);
    setError('');
    try {
      await inpatientService.createWard(apiClient, { code: form.code.trim(), name: form.name.trim(), type: form.type, gender: form.gender, dailyRate: form.dailyRate === '' ? 0 : Number(form.dailyRate), beds });
      onSaved();
    } catch (e) {
      setError(e?.message || 'The ward could not be created.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} title="New ward" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={form.code.trim().length < 2 || form.name.trim().length < 2 || saving} onClick={save}>{saving ? 'Saving…' : 'Create ward'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code" required><input className={`${inputClass} uppercase`} value={form.code} onChange={set('code')} maxLength={20} placeholder="SW1" /></FormField>
        <FormField label="Name" required><input className={inputClass} value={form.name} onChange={set('name')} placeholder="Surgical Ward 1" /></FormField>
        <FormField label="Type">
          <select className={inputClass} value={form.type} onChange={set('type')}>
            {['GENERAL', 'MEDICAL', 'SURGICAL', 'MATERNITY', 'PAEDIATRIC', 'ICU', 'PRIVATE'].map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </select>
        </FormField>
        <FormField label="Patients">
          <select className={inputClass} value={form.gender} onChange={set('gender')}>
            <option value="MIXED">Mixed</option>
            <option value="MALE">Male only</option>
            <option value="FEMALE">Female only</option>
          </select>
        </FormField>
        <FormField label="Charge per night"><input type="number" min="0" step="0.01" className={inputClass} value={form.dailyRate} onChange={set('dailyRate')} /></FormField>
        <FormField label="Beds" help={`Comma-separated labels${beds.length ? ` (${beds.length})` : ''}.`}><input className={inputClass} value={form.beds} onChange={set('beds')} placeholder="S1, S2, S3" /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}

/** The patient on a bed: name, diagnosis, day of the stay, and the dots that say who needs someone. */
function BedPatient({ admission, onOpen }) {
  const dots = bedDots(admission.flags);
  const attention = dots.reasons.length ? `. Needs attention: ${dots.reasons.join(', ')}` : '';
  return (
    <button type="button" className="mt-2 block w-full text-left" onClick={onOpen} aria-label={`${patientName(admission.patient)}, ${admission.diagnosis}, day ${admission.dayNumber}${attention}`}>
      <span className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate font-semibold underline-offset-2 hover:underline">{patientName(admission.patient)}</span>
        {dots.red && <span className="h-3 w-3 shrink-0 rounded-full bg-red-500" title={dots.reasons.filter((r) => !r.includes('result')).join(', ')} data-dot="red" />}
        {dots.yellow && <span className="h-3 w-3 shrink-0 rounded-full bg-amber-400" title="Results to review" data-dot="yellow" />}
      </span>
      <span className="block truncate text-xs text-slate-700">{admission.diagnosis}</span>
      <span className="block truncate text-xs text-slate-500">Day {admission.dayNumber}{admission.attending ? ` · ${admission.attending.name}` : ''}</span>
    </button>
  );
}
