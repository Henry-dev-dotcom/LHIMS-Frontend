import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Droplets, RefreshCw, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { BLOOD_GROUPS, COMPONENTS, bloodBankService, isCompatible } from '../../services/bloodBankService';
import { can, patientName } from '../opd/opdUtils';

const REQ_STATUS = { PENDING: 'Waiting for crossmatch', CROSSMATCHED: 'Crossmatched', ISSUED: 'Issued', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const URGENCY = { ROUTINE: 'text-slate-600', URGENT: 'font-semibold text-amber-700', EMERGENCY: 'font-bold text-red-700' };
const formatDay = (v) => (v ? new Date(v).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** The blood bank: requests to crossmatch and issue, stock, and donors. Clinicians see requests and transfusions. */
export function BloodBankPage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const lab = can(auth, 'bloodbank:manage');
  const tabs = lab ? [['requests', 'Requests'], ['stock', 'Stock'], ['donors', 'Donors & donations']] : [['requests', 'Requests']];
  const [tab, setTab] = useState('requests');
  const [data, setData] = useState({ tab: null, value: null });
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState('');
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);
  const value = data.tab === tab ? data.value : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = tab === 'requests'
        ? listItems(await bloodBankService.requests(apiClient))
        : tab === 'stock'
          ? { summary: await bloodBankService.stock(apiClient), units: listItems(await bloodBankService.units(apiClient, { status: 'AVAILABLE' })), quarantine: listItems(await bloodBankService.units(apiClient, { status: 'QUARANTINE' })) }
          : listItems(await bloodBankService.donors(apiClient));
      setData({ tab, value: loaded });
    } catch (e) {
      toast('error', e?.message || 'The blood bank could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => { if (!openId) load(); }, [load, openId]);

  if (openId) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => setOpenId('')}><ArrowLeft className="h-4 w-4" /> Back to blood bank</Button>
        <RequestDetail id={openId} auth={auth} toast={toast} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Blood bank" title="Blood bank" description={lab ? 'Crossmatch and issue blood for requests, keep screened stock in date, and record donations.' : 'Blood requests for your patients, and transfusions to record.'} />
      <Card title={tabs.find(([k]) => k === tab)[1]} actions={<Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>}>
        {tabs.length > 1 && (
          <div role="tablist" aria-label="Blood bank" className="mb-4 flex flex-wrap gap-2">
            {tabs.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
            ))}
          </div>
        )}
        {tab === 'requests' && (
          <DataTable caption="Open blood requests" rowBadge={(r) => r.requestCode} rows={value || []} emptyMessage={loading ? 'Loading…' : 'No open blood requests.'}
            columns={[
              { key: 'patient', label: 'Patient', mobilePrimary: true, render: (r) => <span><span className="font-semibold">{patientName(r.patient)}</span><span className="block text-xs text-slate-500">{r.patient.patientCode} · group {r.patientGroup}</span></span> },
              { key: 'what', label: 'Request', render: (r) => `${r.unitsRequested} × ${COMPONENTS[r.component]}` },
              { key: 'urgency', label: 'Urgency', render: (r) => <span className={URGENCY[r.urgency]}>{r.urgency.toLowerCase()}</span> },
              { key: 'status', label: 'Status', render: (r) => REQ_STATUS[r.status] },
              { key: 'when', label: 'Requested', render: (r) => formatDateTime(r.createdAt) },
              { key: 'actions', label: 'Actions', render: (r) => <Button size="sm" onClick={() => setOpenId(r.id)}>Open</Button> }
            ]} />
        )}
        {tab === 'stock' && value && <StockView value={value} toast={toast} reload={load} />}
        {tab === 'donors' && value && <DonorsView donors={value} toast={toast} reload={load} />}
      </Card>
    </div>
  );
}

function StockView({ value, toast, reload }) {
  const count = (group, component) => value.summary.rows.filter((r) => r.bloodGroup === group && r.component === component && r.status === 'AVAILABLE').reduce((s, r) => s + r.count, 0);
  const components = Object.keys(COMPONENTS);
  return (
    <div className="space-y-4">
      {value.summary.expiringWithin3Days > 0 && <p className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">{value.summary.expiringWithin3Days} unit(s) expire within 3 days: use them first.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Available units by group and component</caption>
          <thead><tr className="text-left text-xs uppercase tracking-[0.06em] text-slate-500"><th className="py-1 pr-2">Group</th>{components.map((c) => <th key={c} className="px-2">{COMPONENTS[c]}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {BLOOD_GROUPS.map((g) => (
              <tr key={g}><th scope="row" className="py-1.5 pr-2 text-left font-bold text-slate-900">{g}</th>{components.map((c) => { const n = count(g, c); return <td key={c} className={`px-2 ${n === 0 ? 'text-slate-400' : 'font-semibold text-slate-900'}`}>{n}</td>; })}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <DataTable caption="Available units" rowBadge={(u) => u.unitCode} rows={value.units} emptyMessage="No units available."
        columns={[
          { key: 'unit', label: 'Unit', mobilePrimary: true, render: (u) => <span><span className="font-semibold">{u.bloodGroup} {COMPONENTS[u.component]}</span><span className="block text-xs text-slate-500">{u.unitCode}</span></span> },
          { key: 'expires', label: 'Expires', render: (u) => formatDay(u.expiresAt) },
          { key: 'actions', label: 'Actions', render: (u) => <Button size="sm" variant="ghost" onClick={() => { const r = window.prompt(`Why is ${u.unitCode} being discarded?`); if (r && r.trim().length >= 3) bloodBankService.discard(apiClient, u.id, r.trim()).then(() => { toast('success', `${u.unitCode} discarded.`); reload(); }).catch((e) => toast('error', e?.message)); }}>Discard</Button> }
        ]} />
      {value.quarantine.length > 0 && <p className="text-sm text-slate-600">{value.quarantine.length} unit(s) in quarantine awaiting screening (see Donors & donations).</p>}
    </div>
  );
}

function DonorsView({ donors, toast, reload }) {
  const [modal, setModal] = useState(null);
  const [donor, setDonor] = useState(null);
  const openDonor = (id) => bloodBankService.donor(apiClient, id).then(setDonor).catch((e) => toast('error', e?.message));
  if (donor) {
    return (
      <div className="space-y-3">
        <Button variant="secondary" onClick={() => setDonor(null)}><ArrowLeft className="h-4 w-4" /> All donors</Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-bold text-slate-900">{donor.firstName} {donor.lastName} <span className="text-sm font-normal text-slate-500">{donor.donorCode} · {donor.gender} · {donor.bloodGroup || 'group not known'}</span></p>
          <Button onClick={() => setModal('donate')}><Droplets className="h-4 w-4" /> Record donation</Button>
        </div>
        {donor.deferredUntil && new Date(donor.deferredUntil) > new Date() && <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">Deferred until {formatDay(donor.deferredUntil)}: {donor.deferralReason}</p>}
        {donor.donations.map((d) => (
          <article key={d.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
            <p className="font-semibold text-slate-900">{d.donationCode} · {formatDateTime(d.collectedAt)} · {d.bloodGroup} · {d.volumeMl} ml · Hb {d.haemoglobin}</p>
            <ul className="mt-1 flex flex-wrap gap-2">{d.units.map((u) => <li key={u.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold">{COMPONENTS[u.component]}: {u.status.toLowerCase()}{u.discardReason ? ` (${u.discardReason})` : ''}</li>)}</ul>
            {d.units.some((u) => u.status === 'QUARANTINE') && <Button size="sm" className="mt-2" onClick={() => setModal({ screen: d })}>Record screening</Button>}
          </article>
        ))}
        <DonationModal open={modal === 'donate'} donor={donor} onClose={() => setModal(null)} onDone={(d) => { setModal(null); setDonor(d); toast('success', 'Donation recorded; units are in quarantine until screened.'); }} toast={toast} />
        <ScreeningModal donation={modal?.screen} onClose={() => setModal(null)} onDone={(r) => { setModal(null); toast(r.released ? 'success' : 'error', r.released ? `${r.units} unit(s) released to stock.` : `Reactive (${r.reactive.join(', ')}): units discarded and donor deferred. Refer for counselling.`); openDonor(donor.id); }} toast={toast} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => setModal('register')}><UserPlus className="h-4 w-4" /> Register donor</Button></div>
      <DataTable caption="Donors" rowBadge={(d) => d.donorCode} rows={donors} emptyMessage="No donors registered."
        columns={[
          { key: 'name', label: 'Donor', mobilePrimary: true, render: (d) => <span className="font-semibold">{d.firstName} {d.lastName}</span> },
          { key: 'group', label: 'Group', render: (d) => d.bloodGroup || '—' },
          { key: 'last', label: 'Last donation', render: (d) => formatDay(d.lastDonationAt) },
          { key: 'actions', label: 'Actions', render: (d) => <Button size="sm" onClick={() => openDonor(d.id)}>Open</Button> }
        ]} />
      <RegisterDonorModal open={modal === 'register'} onClose={() => setModal(null)} onDone={(d) => { setModal(null); reload(); setDonor(d); }} toast={toast} />
    </div>
  );
}

function RegisterDonorModal({ open, onClose, onDone, toast }) {
  const [f, setF] = useState({ firstName: '', lastName: '', dateOfBirth: '', gender: 'Male', phone: '' });
  useEffect(() => { if (open) setF({ firstName: '', lastName: '', dateOfBirth: '', gender: 'Male', phone: '' }); }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const save = () => bloodBankService.registerDonor(apiClient, { ...f, phone: f.phone || undefined }).then(onDone).catch((e) => toast('error', e?.message));
  return (
    <Modal open title="Register donor" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!f.firstName.trim() || !f.lastName.trim() || !f.dateOfBirth} onClick={save}>Register</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="First name" required><input className={inputClass} value={f.firstName} onChange={set('firstName')} /></FormField>
        <FormField label="Surname" required><input className={inputClass} value={f.lastName} onChange={set('lastName')} /></FormField>
        <FormField label="Date of birth" required><input type="date" className={inputClass} value={f.dateOfBirth} onChange={set('dateOfBirth')} /></FormField>
        <FormField label="Sex"><select className={inputClass} value={f.gender} onChange={set('gender')}><option>Male</option><option>Female</option></select></FormField>
        <FormField label="Phone"><input className={inputClass} value={f.phone} onChange={set('phone')} /></FormField>
      </div>
    </Modal>
  );
}

function DonationModal({ open, donor, onClose, onDone, toast }) {
  const [f, setF] = useState(null);
  useEffect(() => { if (open) setF({ bloodGroup: donor.bloodGroup || 'O+', volumeMl: '450', haemoglobin: '', weightKg: '', components: ['PACKED_RED_CELLS', 'FRESH_FROZEN_PLASMA'] }); }, [open, donor]);
  if (!open || !f) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const toggle = (c) => setF((x) => ({ ...x, components: c === 'WHOLE_BLOOD' ? ['WHOLE_BLOOD'] : x.components.includes(c) ? x.components.filter((y) => y !== c) : [...x.components.filter((y) => y !== 'WHOLE_BLOOD'), c] }));
  const save = () => bloodBankService.donate(apiClient, donor.id, { bloodGroup: f.bloodGroup, volumeMl: Number(f.volumeMl), haemoglobin: Number(f.haemoglobin), weightKg: Number(f.weightKg), components: f.components }).then(onDone).catch((e) => toast('error', e?.message));
  return (
    <Modal open title={`Donation: ${donor.firstName} ${donor.lastName}`} description="Eligibility (age, weight, Hb, interval since the last donation) is checked when you save." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!f.haemoglobin || !f.weightKg || !f.components.length} onClick={save}>Record donation</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <FormField label="Group"><select className={inputClass} value={f.bloodGroup} onChange={set('bloodGroup')}>{BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}</select></FormField>
          <FormField label="Volume (ml)"><input type="number" className={inputClass} value={f.volumeMl} onChange={set('volumeMl')} /></FormField>
          <FormField label="Hb (g/dL)" required><input type="number" step="0.1" className={inputClass} value={f.haemoglobin} onChange={set('haemoglobin')} /></FormField>
          <FormField label="Weight (kg)" required><input type="number" step="0.1" className={inputClass} value={f.weightKg} onChange={set('weightKg')} /></FormField>
        </div>
        <fieldset className="flex flex-wrap gap-3 text-sm">
          <legend className="mb-1 text-sm font-bold text-slate-900">Processed into</legend>
          {Object.entries(COMPONENTS).map(([k, v]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={f.components.includes(k)} onChange={() => toggle(k)} /> {v}</label>)}
        </fieldset>
      </div>
    </Modal>
  );
}

function ScreeningModal({ donation, onClose, onDone, toast }) {
  const [f, setF] = useState({});
  useEffect(() => { if (donation) setF({ hiv: '', hepatitisB: '', hepatitisC: '', syphilis: '' }); }, [donation]);
  if (!donation) return null;
  const names = { hiv: 'HIV', hepatitisB: 'Hepatitis B (HBsAg)', hepatitisC: 'Hepatitis C', syphilis: 'Syphilis' };
  const save = () => bloodBankService.screen(apiClient, donation.id, f).then(onDone).catch((e) => toast('error', e?.message));
  return (
    <Modal open title={`Screening: ${donation.donationCode}`} description="Every marker must be recorded. Any reactive result discards all units from this donation." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={Object.values(f).some((v) => !v)} onClick={save}>Save results</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(names).map(([k, label]) => (
          <FormField key={k} label={label} required><select className={inputClass} value={f[k] || ''} onChange={(e) => setF((c) => ({ ...c, [k]: e.target.value }))}><option value="">—</option><option value="NEGATIVE">Non-reactive</option><option value="POSITIVE">Reactive</option></select></FormField>
        ))}
      </div>
    </Modal>
  );
}

function RequestDetail({ id, auth, toast }) {
  const [r, setR] = useState(null);
  const [units, setUnits] = useState([]);
  const [modal, setModal] = useState(null);
  const lab = can(auth, 'bloodbank:manage');
  const load = useCallback(async () => {
    try {
      const req = await bloodBankService.request(apiClient, id);
      setR(req);
      if (lab) setUnits(listItems(await bloodBankService.units(apiClient, { status: 'AVAILABLE', component: req.component })));
    } catch (e) {
      toast('error', e?.message || 'The request could not be loaded.');
    }
  }, [id, lab, toast]);
  useEffect(() => { load(); }, [load]);
  if (!r) return <Card><p className="text-sm text-slate-500">Loading…</p></Card>;
  const act = (fn, message) => fn().then((updated) => { setR(updated); toast('success', message); setModal(null); load(); }).catch((e) => toast('error', e?.message || 'That did not work.'));
  const open = ['PENDING', 'CROSSMATCHED', 'ISSUED'].includes(r.status);
  const compatible = units.filter((u) => isCompatible(r.component, r.patientGroup, u.bloodGroup));
  const matched = r.reservedUnits.length + r.transfusions.length;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{r.requestCode} · <span className={URGENCY[r.urgency]}>{r.urgency.toLowerCase()}</span> · {REQ_STATUS[r.status]}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{patientName(r.patient)} <span className="rounded-full bg-red-600 px-3 py-0.5 align-middle text-sm font-bold text-white">{r.patientGroup}</span></h2>
        <p className="mt-1 text-sm text-slate-700">{r.unitsRequested} × {COMPONENTS[r.component]} · {r.indication}{r.haemoglobin ? ` · Hb ${r.haemoglobin}` : ''} · requested by {r.requestedBy?.name} {formatDateTime(r.createdAt)}</p>
        {open && can(auth, 'bloodbank:request') && !r.transfusions.length && <Button size="sm" variant="ghost" className="mt-2" onClick={() => { const reason = window.prompt('Why is this request being cancelled?'); if (reason && reason.trim().length >= 3) act(() => bloodBankService.cancel(apiClient, r.id, reason.trim()), 'Request cancelled.'); }}>Cancel request</Button>}
      </Card>

      {lab && open && matched < r.unitsRequested && (
        <Card title="Compatible units in stock" subtitle={`${compatible.length} ${r.patientGroup}-compatible ${COMPONENTS[r.component].toLowerCase()}, soonest expiry first`}>
          {compatible.length === 0 ? <p className="text-sm font-semibold text-red-700">No compatible units available.</p> : (
            <ul className="space-y-2">
              {compatible.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm">
                  <span><span className="font-semibold">{u.bloodGroup}</span> {u.unitCode} · expires {formatDay(u.expiresAt)}</span>
                  <span className="flex gap-2">
                    <Button size="sm" onClick={() => act(() => bloodBankService.crossmatch(apiClient, r.id, { unitId: u.id, compatible: true }), `${u.unitCode} crossmatched and reserved.`)}>Compatible</Button>
                    <Button size="sm" variant="secondary" onClick={() => { const notes = window.prompt('Crossmatch incompatible: notes'); if (notes !== null) act(() => bloodBankService.crossmatch(apiClient, r.id, { unitId: u.id, compatible: false, notes: notes || undefined }), `Incompatible crossmatch recorded for ${u.unitCode}.`); }}>Incompatible</Button>
                    {r.urgency === 'EMERGENCY' && u.bloodGroup === 'O-' && ['PACKED_RED_CELLS', 'WHOLE_BLOOD'].includes(u.component) && (
                      <Button size="sm" variant="danger" onClick={() => { const reason = window.prompt('Emergency release without crossmatch: why can this not wait?'); if (reason && reason.trim().length >= 5) act(() => bloodBankService.emergency(apiClient, r.id, { unitId: u.id, reason: reason.trim() }), `${u.unitCode} released uncrossmatched.`); }}>Emergency release</Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="Units for this patient">
        {r.reservedUnits.length + r.transfusions.length === 0 ? <p className="text-sm text-slate-500">None matched yet.</p> : (
          <ul className="space-y-2">
            {r.reservedUnits.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sky-50 px-4 py-2 text-sm">
                <span><span className="font-semibold">{u.bloodGroup}</span> {u.unitCode} · reserved · expires {formatDay(u.expiresAt)}</span>
                {lab && <Button size="sm" onClick={() => act(() => bloodBankService.issue(apiClient, r.id, u.id), `${u.unitCode} issued to the ward.`)}>Issue</Button>}
              </li>
            ))}
            {r.transfusions.map((t) => (
              <li key={t.id} className={`rounded-2xl px-4 py-2 text-sm ${t.reaction === 'SEVERE' ? 'bg-red-50' : 'bg-slate-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><span className="font-semibold">{t.unit.bloodGroup}</span> {t.unit.unitCode} · issued {formatDateTime(t.issuedAt)}{t.emergencyRelease ? <span className="font-bold text-red-700"> · emergency release, uncrossmatched</span> : ''}</span>
                  {!t.endedAt && can(auth, 'bloodbank:transfuse') && <Button size="sm" onClick={() => setModal(t)}>Record transfusion</Button>}
                </div>
                {(t.startedAt || t.endedAt) && <p className="mt-1 text-xs text-slate-600">Started {formatDateTime(t.startedAt)}{t.endedAt ? ` · ended ${formatDateTime(t.endedAt)}` : ' · in progress'}{t.givenBy ? ` · ${t.givenBy.name}` : ''}</p>}
                {t.reaction && t.reaction !== 'NONE' && <p className={`mt-1 flex items-start gap-1 text-xs font-bold ${t.reaction === 'SEVERE' ? 'text-red-800' : 'text-amber-800'}`}><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {t.reaction.toLowerCase()} reaction: {t.reactionNotes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {r.crossmatches.length > 0 && (
        <Card title="Crossmatch record">
          <ul className="space-y-1 text-sm">{r.crossmatches.map((c) => <li key={c.id}>{c.unit.unitCode} ({c.unit.bloodGroup}): <span className={c.compatible ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{c.compatible ? 'compatible' : 'incompatible'}</span> · {c.performedBy?.name} {formatDateTime(c.performedAt)}{c.notes ? ` · ${c.notes}` : ''}</li>)}</ul>
        </Card>
      )}
      <TransfusionModal transfusion={modal} onClose={() => setModal(null)} onSave={(payload) => act(() => bloodBankService.transfusion(apiClient, modal.id, payload), 'Transfusion recorded.')} />
    </div>
  );
}

const localNow = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

function TransfusionModal({ transfusion, onClose, onSave }) {
  const [f, setF] = useState(null);
  useEffect(() => { if (transfusion) setF({ startedAt: transfusion.startedAt ? '' : localNow(), endedAt: '', reaction: 'NONE', reactionNotes: '' }); }, [transfusion]);
  if (!transfusion || !f) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const needsNotes = f.reaction !== 'NONE' && f.reactionNotes.trim().length < 3;
  const save = () => onSave({
    startedAt: f.startedAt ? new Date(f.startedAt).toISOString() : undefined,
    endedAt: f.endedAt ? new Date(f.endedAt).toISOString() : undefined,
    reaction: f.reaction,
    reactionNotes: f.reactionNotes.trim() || undefined
  });
  return (
    <Modal open title={`Transfusion: ${transfusion.unit.unitCode}`} description="Check the patient’s identity and the unit against the request at the bedside before starting. Stop the transfusion at once if a reaction is suspected." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={needsNotes || (!f.startedAt && !f.endedAt && f.reaction === 'NONE')} onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {!transfusion.startedAt && <FormField label="Started"><input type="datetime-local" className={inputClass} value={f.startedAt} onChange={set('startedAt')} /></FormField>}
        <FormField label="Ended" help="Leave empty while the transfusion is running."><input type="datetime-local" className={inputClass} value={f.endedAt} onChange={set('endedAt')} /></FormField>
        <FormField label="Reaction"><select className={inputClass} value={f.reaction} onChange={set('reaction')}><option value="NONE">None</option><option value="MILD">Mild (e.g. itch, rash, low fever)</option><option value="SEVERE">Severe (e.g. breathlessness, hypotension, haemolysis)</option></select></FormField>
        {f.reaction !== 'NONE' && <FormField label="What happened and what was done" required className="sm:col-span-2"><textarea rows={3} className={inputClass} value={f.reactionNotes} onChange={set('reactionNotes')} maxLength={1000} /></FormField>}
      </div>
    </Modal>
  );
}

/** From a visit: the doctor asks the blood bank for blood for this patient. */
export function RequestBloodModal({ open, encounter, onClose, onDone }) {
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setF({ patientGroup: '', component: 'PACKED_RED_CELLS', unitsRequested: '1', urgency: 'ROUTINE', indication: '', haemoglobin: '' }); setError(''); } }, [open]);
  if (!open || !f) return null;
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const save = () => bloodBankService.createRequest(apiClient, { patientId: encounter.patient.id, encounterId: encounter.id, patientGroup: f.patientGroup, component: f.component, unitsRequested: Number(f.unitsRequested), urgency: f.urgency, indication: f.indication.trim(), haemoglobin: f.haemoglobin ? Number(f.haemoglobin) : undefined })
    .then(onDone).catch((e) => setError(e?.message || 'The request could not be sent.'));
  return (
    <Modal open title="Request blood" description="The laboratory groups and crossmatches a sample; send one with the request." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!f.patientGroup || f.indication.trim().length < 3} onClick={save}><Droplets className="h-4 w-4" /> Send request</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Patient’s blood group" required><select className={inputClass} value={f.patientGroup} onChange={set('patientGroup')}><option value="">Choose…</option>{BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}</select></FormField>
        <FormField label="Component"><select className={inputClass} value={f.component} onChange={set('component')}>{Object.entries(COMPONENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
        <FormField label="Units"><input type="number" min="1" max="20" className={inputClass} value={f.unitsRequested} onChange={set('unitsRequested')} /></FormField>
        <FormField label="Urgency"><select className={inputClass} value={f.urgency} onChange={set('urgency')}><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="EMERGENCY">Emergency (O-negative may be released uncrossmatched)</option></select></FormField>
        <FormField label="Indication" required className="sm:col-span-2"><input className={inputClass} value={f.indication} onChange={set('indication')} maxLength={500} placeholder="e.g. Severe anaemia, Hb 5.2, symptomatic" /></FormField>
        <FormField label="Latest Hb (g/dL)"><input type="number" step="0.1" className={inputClass} value={f.haemoglobin} onChange={set('haemoglobin')} /></FormField>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}
