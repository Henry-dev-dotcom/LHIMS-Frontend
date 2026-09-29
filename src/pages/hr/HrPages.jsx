import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { buildQuery } from '../../api/apiClient';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { can } from '../opd/opdUtils';

// HR module (backend /hr).
const hr = {
  me: () => apiClient.request('/hr/me'),
  staff: () => apiClient.request('/hr/staff'),
  saveProfile: (userId, body) => apiClient.request(`/hr/staff/${userId}`, { method: 'PUT', body }),
  shiftTypes: () => apiClient.request('/hr/shift-types'),
  createShiftType: (body) => apiClient.request('/hr/shift-types', { method: 'POST', body }),
  rota: (params) => apiClient.request(`/hr/rota${buildQuery(params)}`),
  assign: (body) => apiClient.request('/hr/rota', { method: 'POST', body }),
  remove: (id) => apiClient.request(`/hr/rota/${id}`, { method: 'DELETE' }),
  leave: (params) => apiClient.request(`/hr/leave${buildQuery(params)}`),
  requestLeave: (body) => apiClient.request('/hr/leave', { method: 'POST', body }),
  decide: (id, body) => apiClient.request(`/hr/leave/${id}/decision`, { method: 'POST', body }),
  cancel: (id) => apiClient.request(`/hr/leave/${id}/cancel`, { method: 'POST', body: {} })
};

const LEAVE_TYPES = { ANNUAL: 'Annual', SICK: 'Sick', MATERNITY: 'Maternity', PATERNITY: 'Paternity', STUDY: 'Study', COMPASSIONATE: 'Compassionate', UNPAID: 'Unpaid' };
const LEAVE_STATUS = { PENDING: 'bg-amber-100 text-amber-900', APPROVED: 'bg-emerald-100 text-emerald-900', REJECTED: 'bg-red-100 text-red-800', CANCELLED: 'bg-slate-200 text-slate-500' };
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const fmt = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const mondayOf = (d) => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const wd = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - wd); return x; };
const pill = (status) => <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${LEAVE_STATUS[status]}`}>{status.toLowerCase()}</span>;

function useToast() {
  const { dispatch } = useAppStore();
  return useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);
}

/* ------------------------------------------------------------ my rota & leave */

export function MyHrPage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [asking, setAsking] = useState(false);
  const load = useCallback(() => hr.me().then(setData).catch((e) => toast('error', e?.message || 'Could not load your HR record.')), [toast]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Card><p className="text-sm text-slate-500">Loading…</p></Card>;
  const b = data.balance;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="HR" title="My rota & leave" description="Your shifts for the next four weeks, your leave balance and your leave requests." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Annual leave left ({b.year})</p><p className="mt-1 text-2xl font-bold">{b.remaining} <span className="text-sm font-normal text-slate-500">of {b.entitlement} working days</span></p></Card>
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Job</p><p className="mt-1 font-semibold">{data.profile?.jobTitle || 'No HR profile yet'}</p><p className="text-sm text-slate-500">{data.profile?.unit || ''}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Professional registration</p><p className="mt-1 font-semibold">{data.profile?.registrationNumber || '—'}</p>{data.profile?.registrationExpiresAt && <p className="text-sm text-slate-500">expires {fmt(data.profile.registrationExpiresAt)}</p>}</Card>
      </div>
      <Card title="My shifts" subtitle="Next four weeks">
        {data.rota.length === 0 ? <p className="text-sm text-slate-500">You are not on the rota in the next four weeks.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{data.rota.map((e) => <li key={e.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold">{fmt(e.date)}</span> · {e.shiftType.name} {e.shiftType.startTime}–{e.shiftType.endTime}<span className="block text-xs text-slate-500">{e.unit}</span></li>)}</ul>
        )}
      </Card>
      <Card title="My leave" actions={<Button onClick={() => setAsking(true)}><Plus className="h-4 w-4" /> Request leave</Button>}>
        <DataTable caption="My leave requests" rowBadge={() => null} rows={data.leave} emptyMessage="No leave requests."
          columns={[
            { key: 'type', label: 'Leave', mobilePrimary: true, render: (l) => <span className="font-semibold">{LEAVE_TYPES[l.type]} · {l.days} day{l.days === 1 ? '' : 's'}</span> },
            { key: 'dates', label: 'Dates', render: (l) => `${fmt(l.startDate)} – ${fmt(l.endDate)}` },
            { key: 'status', label: 'Status', render: (l) => <span>{pill(l.status)}{l.decisionNote && <span className="block text-xs text-slate-500">{l.decisionNote}</span>}</span> },
            { key: 'actions', label: 'Actions', render: (l) => (l.status === 'PENDING' || (l.status === 'APPROVED' && new Date(l.startDate) > new Date())) && <Button size="sm" variant="ghost" onClick={() => hr.cancel(l.id).then(() => { toast('success', 'Leave withdrawn.'); load(); }).catch((e) => toast('error', e?.message))}>Withdraw</Button> }
          ]} />
      </Card>
      <LeaveModal open={asking} onClose={() => setAsking(false)} onDone={() => { setAsking(false); toast('success', 'Leave requested.'); load(); }} toast={toast} />
    </div>
  );
}

function LeaveModal({ open, onClose, onDone, toast }) {
  const [f, setF] = useState({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
  useEffect(() => { if (open) setF({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' }); }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const save = () => hr.requestLeave({ type: f.type, startDate: f.startDate, endDate: f.endDate, reason: f.reason.trim() || undefined }).then(onDone).catch((e) => toast('error', e?.message || 'The request could not be sent.'));
  return (
    <Modal open title="Request leave" description="Annual leave is counted in working days (Monday to Friday)." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!f.startDate || !f.endDate} onClick={save}>Send request</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Type"><select className={inputClass} value={f.type} onChange={set('type')}>{Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
        <FormField label="From" required><input type="date" className={inputClass} value={f.startDate} onChange={set('startDate')} /></FormField>
        <FormField label="To" required><input type="date" className={inputClass} value={f.endDate} min={f.startDate} onChange={set('endDate')} /></FormField>
        <FormField label="Reason" className="sm:col-span-3"><input className={inputClass} value={f.reason} onChange={set('reason')} maxLength={500} /></FormField>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- duty rota */

export function DutyRotaPage() {
  const { state } = useAppStore();
  const toast = useToast();
  const manage = can(state.auth, 'hr:manage');
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [unit, setUnit] = useState('');
  const [data, setData] = useState({ entries: [], leave: [] });
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * 86_400_000)), [week]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await hr.rota({ from: iso(days[0]), to: iso(days[6]), unit: unit || undefined }));
    } catch (e) {
      toast('error', e?.message || 'The rota could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [days, unit, toast]);
  useEffect(() => { load(); }, [load]);

  const people = [...new Map(data.entries.map((e) => [e.user.id, e.user])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const units = [...new Set(data.entries.map((e) => e.unit))];
  const onLeave = (userId, d) => data.leave.find((l) => l.user.id === userId && iso(l.startDate) <= iso(d) && iso(l.endDate) >= iso(d));
  const remove = (e) => { if (window.confirm(`Take ${e.user.name} off ${e.shiftType.name} on ${fmt(e.date)}?`)) hr.remove(e.id).then(() => { toast('success', 'Removed from the rota.'); load(); }).catch((err) => toast('error', err?.message)); };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="HR" title="Duty rota" description={manage ? 'Put staff on shifts. The rota refuses overlaps, less than 11 hours’ rest between shifts, and shifts during approved leave.' : 'Who is on duty this week.'} />
      <Card
        title={`Week of ${fmt(days[0])}`}
        subtitle={loading ? 'Loading…' : `${data.entries.length} shifts`}
        actions={(
          <>
            <Button variant="secondary" aria-label="Previous week" onClick={() => setWeek(new Date(week.getTime() - 7 * 86_400_000))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="secondary" onClick={() => setWeek(mondayOf(new Date()))}>This week</Button>
            <Button variant="secondary" aria-label="Next week" onClick={() => setWeek(new Date(week.getTime() + 7 * 86_400_000))}><ChevronRight className="h-4 w-4" /></Button>
            <input aria-label="Ward or unit" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="All units" value={unit} onChange={(e) => setUnit(e.target.value)} list="rota-units" />
            <datalist id="rota-units">{units.map((u) => <option key={u} value={u} />)}</datalist>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
            {manage && <Button onClick={() => setAdding({ date: iso(days[0]) })}><Plus className="h-4 w-4" /> Add to rota</Button>}
          </>
        )}
      >
        {people.length === 0 ? <p className="text-sm text-slate-500">Nobody is on the rota this week.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Duty rota</caption>
              <thead><tr className="text-left text-xs uppercase tracking-[0.06em] text-slate-500"><th className="py-1 pr-2">Staff</th>{days.map((d) => <th key={iso(d)} className="px-1">{fmt(d)}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {people.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="py-2 pr-2 text-left font-semibold text-slate-800">{p.name}</th>
                    {days.map((d) => {
                      const shifts = data.entries.filter((e) => e.user.id === p.id && iso(e.date) === iso(d));
                      const leave = onLeave(p.id, d);
                      return (
                        <td key={iso(d)} className="px-1 py-1 align-top">
                          {leave && <span className="block rounded-lg bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-900">{LEAVE_TYPES[leave.type]} leave</span>}
                          {shifts.map((e) => (
                            <span key={e.id} className="mb-0.5 flex items-center justify-between gap-1 rounded-lg bg-clinical-50 px-1.5 py-0.5 text-[11px] font-semibold text-clinical-900" title={`${e.shiftType.startTime}–${e.shiftType.endTime} · ${e.unit}`}>
                              {e.shiftType.name}
                              {manage && <button type="button" aria-label={`Remove ${p.name} from ${e.shiftType.name} on ${fmt(d)}`} onClick={() => remove(e)}><Trash2 className="h-3 w-3" /></button>}
                            </span>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AssignModal target={adding} onClose={() => setAdding(null)} onDone={() => { setAdding(null); toast('success', 'Added to the rota.'); load(); }} toast={toast} />
    </div>
  );
}

function AssignModal({ target, onClose, onDone, toast }) {
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [f, setF] = useState(null);
  useEffect(() => {
    if (!target) return;
    setF({ userId: '', date: target.date, shiftTypeId: '', unit: '' });
    hr.staff().then((d) => setStaff(listItems(d))).catch(() => setStaff([]));
    hr.shiftTypes().then((d) => { const s = listItems(d); setShifts(s); setF((c) => ({ ...c, shiftTypeId: s[0]?.id || '' })); }).catch(() => setShifts([]));
  }, [target]);
  if (!target || !f) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const save = () => hr.assign({ ...f, unit: f.unit.trim() }).then(onDone).catch((e) => toast('error', e?.message || 'Could not add to the rota.'));
  return (
    <Modal open title="Add to the rota" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!f.userId || !f.shiftTypeId || f.unit.trim().length < 2} onClick={save}>Add</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Staff member" required><select className={inputClass} value={f.userId} onChange={(e) => { const u = staff.find((s) => s.id === e.target.value); setF((c) => ({ ...c, userId: e.target.value, unit: c.unit || u?.staffProfile?.unit || '' })); }}><option value="">Choose…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.staffProfile?.jobTitle ? ` (${s.staffProfile.jobTitle})` : ''}</option>)}</select></FormField>
        <FormField label="Date" required><input type="date" className={inputClass} value={f.date} onChange={set('date')} /></FormField>
        <FormField label="Shift" required><select className={inputClass} value={f.shiftTypeId} onChange={set('shiftTypeId')}>{shifts.map((s) => <option key={s.id} value={s.id}>{s.name} {s.startTime}–{s.endTime}</option>)}</select></FormField>
        <FormField label="Ward or unit" required><input className={inputClass} value={f.unit} onChange={set('unit')} maxLength={120} /></FormField>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- HR admin */

export function HrAdminPage() {
  const toast = useToast();
  const [tab, setTab] = useState('leave');
  const [data, setData] = useState({ tab: null, rows: [] });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const rows = data.tab === tab ? data.rows : [];
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = tab === 'leave' ? await hr.leave({ status: 'PENDING' }) : tab === 'staff' ? await hr.staff() : await hr.shiftTypes();
      setData({ tab, rows: listItems(loaded) });
    } catch (e) {
      toast('error', e?.message || 'Could not load HR.');
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);
  useEffect(() => { load(); }, [load]);
  const decide = (l, decision) => {
    const note = window.prompt(decision === 'REJECT' ? 'Why is this leave refused?' : 'Approve. Note (optional):');
    // Cancelling the prompt cancels the decision; a refusal needs a reason.
    if (note === null || (decision === 'REJECT' && !note.trim())) return;
    hr.decide(l.id, { decision, note: note?.trim() || undefined }).then(() => { toast('success', `Leave ${decision === 'APPROVE' ? 'approved' : 'refused'}.`); load(); }).catch((e) => toast('error', e?.message));
  };
  const REG = { EXPIRED: 'font-bold text-red-700', EXPIRING: 'font-semibold text-amber-700', VALID: 'text-slate-700' };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="HR" title="HR administration" description="Leave approvals, staff profiles with professional registration, and shift types." />
      <Card title={{ leave: 'Leave waiting for a decision', staff: 'Staff', shifts: 'Shift types' }[tab]} subtitle={loading ? 'Loading…' : `${rows.length}`}
        actions={<>{tab === 'shifts' && <Button onClick={() => setEditing({ shift: true })}><Plus className="h-4 w-4" /> New shift</Button>}<Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button></>}>
        <div role="tablist" aria-label="HR" className="mb-4 flex flex-wrap gap-2">
          {[['leave', 'Leave approvals'], ['staff', 'Staff'], ['shifts', 'Shift types']].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
          ))}
        </div>
        {tab === 'leave' && (
          <DataTable caption="Pending leave" rowBadge={() => null} rows={rows} emptyMessage={loading ? 'Loading…' : 'No leave waiting.'}
            columns={[
              { key: 'who', label: 'Staff', mobilePrimary: true, render: (l) => <span className="font-semibold">{l.user.name}</span> },
              { key: 'what', label: 'Leave', render: (l) => `${LEAVE_TYPES[l.type]} · ${l.days} working day${l.days === 1 ? '' : 's'}` },
              { key: 'dates', label: 'Dates', render: (l) => `${fmt(l.startDate)} – ${fmt(l.endDate)}` },
              { key: 'reason', label: 'Reason', render: (l) => l.reason || '—' },
              { key: 'actions', label: 'Actions', render: (l) => <div className="flex gap-1"><Button size="sm" onClick={() => decide(l, 'APPROVE')}>Approve</Button><Button size="sm" variant="secondary" onClick={() => decide(l, 'REJECT')}>Refuse</Button></div> }
            ]} />
        )}
        {tab === 'staff' && (
          <DataTable caption="Staff" rowBadge={(u) => u.staffProfile?.staffNumber || null} rows={rows} emptyMessage="No staff."
            columns={[
              { key: 'name', label: 'Staff', mobilePrimary: true, render: (u) => <span><span className="font-semibold">{u.name}</span><span className="block text-xs text-slate-500">{u.staffProfile?.jobTitle || u.role.toLowerCase().replace(/_/g, ' ')}</span></span> },
              { key: 'unit', label: 'Unit', render: (u) => u.staffProfile?.unit || '—' },
              { key: 'reg', label: 'Registration', render: (u) => (u.registration ? <span className={REG[u.registration]}>{u.staffProfile.registrationNumber} · {u.registration === 'EXPIRED' ? 'expired' : `to ${fmt(u.staffProfile.registrationExpiresAt)}`}</span> : '—') },
              { key: 'actions', label: 'Actions', render: (u) => <Button size="sm" variant="secondary" onClick={() => setEditing({ user: u })}>{u.staffProfile ? 'Edit' : 'Add profile'}</Button> }
            ]} />
        )}
        {tab === 'shifts' && (
          <DataTable caption="Shift types" rowBadge={(s) => s.code} rows={rows} emptyMessage="No shift types."
            columns={[
              { key: 'name', label: 'Shift', mobilePrimary: true, render: (s) => <span className="font-semibold">{s.name}</span> },
              { key: 'hours', label: 'Hours', render: (s) => `${s.startTime}–${s.endTime}${s.endTime <= s.startTime ? ' (overnight)' : ''}` }
            ]} />
        )}
      </Card>
      <ProfileModal user={editing?.user} onClose={() => setEditing(null)} onDone={() => { setEditing(null); toast('success', 'Profile saved.'); load(); }} toast={toast} />
      <ShiftModal open={Boolean(editing?.shift)} onClose={() => setEditing(null)} onDone={() => { setEditing(null); toast('success', 'Shift added.'); load(); }} toast={toast} />
    </div>
  );
}

function ProfileModal({ user, onClose, onDone, toast }) {
  const [f, setF] = useState(null);
  useEffect(() => {
    if (!user) return;
    const p = user.staffProfile || {};
    setF({ staffNumber: p.staffNumber || '', jobTitle: p.jobTitle || '', unit: p.unit || '', employmentType: p.employmentType || 'PERMANENT', registrationBody: p.registrationBody || '', registrationNumber: p.registrationNumber || '', registrationExpiresAt: p.registrationExpiresAt ? iso(p.registrationExpiresAt) : '', annualLeaveDays: String(p.annualLeaveDays ?? 21), phone: p.phone || '' });
  }, [user]);
  if (!user || !f) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const opt = (v) => (v.trim() ? v.trim() : undefined);
  const save = () => hr.saveProfile(user.id, { staffNumber: f.staffNumber.trim(), jobTitle: f.jobTitle.trim(), unit: opt(f.unit), employmentType: f.employmentType, registrationBody: opt(f.registrationBody), registrationNumber: opt(f.registrationNumber), registrationExpiresAt: f.registrationExpiresAt || undefined, annualLeaveDays: Number(f.annualLeaveDays), phone: opt(f.phone) }).then(onDone).catch((e) => toast('error', e?.message));
  return (
    <Modal open title={`HR profile: ${user.name}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={f.staffNumber.trim().length < 2 || f.jobTitle.trim().length < 2} onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Staff number" required><input className={inputClass} value={f.staffNumber} onChange={set('staffNumber')} maxLength={30} /></FormField>
        <FormField label="Job title" required><input className={inputClass} value={f.jobTitle} onChange={set('jobTitle')} maxLength={120} /></FormField>
        <FormField label="Usual ward or unit"><input className={inputClass} value={f.unit} onChange={set('unit')} maxLength={120} /></FormField>
        <FormField label="Employment"><select className={inputClass} value={f.employmentType} onChange={set('employmentType')}>{['PERMANENT', 'CONTRACT', 'NATIONAL_SERVICE', 'LOCUM', 'VOLUNTEER'].map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ')}</option>)}</select></FormField>
        <FormField label="Registration body"><input className={inputClass} value={f.registrationBody} onChange={set('registrationBody')} maxLength={120} placeholder="Nursing and Midwifery Council" /></FormField>
        <FormField label="Registration number"><input className={inputClass} value={f.registrationNumber} onChange={set('registrationNumber')} maxLength={60} /></FormField>
        <FormField label="Registration expires"><input type="date" className={inputClass} value={f.registrationExpiresAt} onChange={set('registrationExpiresAt')} /></FormField>
        <FormField label="Annual leave (working days)"><input type="number" min="0" max="60" className={inputClass} value={f.annualLeaveDays} onChange={set('annualLeaveDays')} /></FormField>
      </div>
    </Modal>
  );
}

function ShiftModal({ open, onClose, onDone, toast }) {
  const [f, setF] = useState({ code: '', name: '', startTime: '07:00', endTime: '14:00' });
  useEffect(() => { if (open) setF({ code: '', name: '', startTime: '07:00', endTime: '14:00' }); }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  return (
    <Modal open title="New shift type" description="A shift that ends at or before its start time runs overnight." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!f.code.trim() || f.name.trim().length < 2} onClick={() => hr.createShiftType(f).then(onDone).catch((e) => toast('error', e?.message))}>Add shift</Button></>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <FormField label="Code" required><input className={`${inputClass} uppercase`} value={f.code} onChange={set('code')} maxLength={10} /></FormField>
        <FormField label="Name" required><input className={inputClass} value={f.name} onChange={set('name')} maxLength={60} /></FormField>
        <FormField label="Starts"><input type="time" className={inputClass} value={f.startTime} onChange={set('startTime')} /></FormField>
        <FormField label="Ends"><input type="time" className={inputClass} value={f.endTime} onChange={set('endTime')} /></FormField>
      </div>
    </Modal>
  );
}
