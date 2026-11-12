import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, FilePlus2, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react';
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
import { CLAIM_STATUS, claimsService, money } from '../../services/claimsService';
import { can, patientName } from '../opd/opdUtils';

const TABS = [
  ['TO_CLAIM', 'To claim'], ['DRAFT', 'Drafts'], ['SUBMITTED', 'Submitted'], ['QUERIED', 'Queried'],
  ['APPROVED', 'Approved'], ['PAID', 'Paid'], ['REJECTED', 'Rejected'], ['BATCHES', 'Batches']
];
const formatDay = (value) => (value ? new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function StatusPill({ status }) {
  const s = CLAIM_STATUS[status] || { label: status, className: 'bg-slate-100' };
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${s.className}`}>{s.label}</span>;
}

/** The claims office: visits to claim, drafts to submit, decisions and scheme payments. */
export function ClaimsPage() {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const [schemes, setSchemes] = useState([]);
  const [schemeId, setSchemeId] = useState('');
  const [tab, setTab] = useState('TO_CLAIM');
  // Rows are kept with the tab they were loaded for, so a tab never renders another tab's rows.
  const [data, setData] = useState({ key: null, rows: [] });
  const rows = data.key === `${schemeId}:${tab}` ? data.rows : [];
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState('');
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  useEffect(() => {
    claimsService.schemes(apiClient).then((d) => {
      const items = listItems(d).filter((s) => s.isActive);
      setSchemes(items);
      setSchemeId((current) => current || items[0]?.id || '');
    }).catch((e) => toast('error', e?.message || 'Schemes could not be loaded.'));
  }, [toast]);

  const load = useCallback(async () => {
    if (!schemeId) return;
    setLoading(true);
    setSelected([]);
    try {
      const loaded = tab === 'TO_CLAIM'
        ? await claimsService.candidates(apiClient, schemeId)
        : tab === 'BATCHES' ? await claimsService.batches(apiClient, schemeId) : await claimsService.claims(apiClient, { schemeId, status: tab });
      setData({ key: `${schemeId}:${tab}`, rows: listItems(loaded) });
    } catch (e) {
      toast('error', e?.message || 'Claims could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [schemeId, tab, toast]);

  useEffect(() => {
    if (!openId) load();
  }, [load, openId]);

  const run = async (fn, success) => {
    try {
      const out = await fn();
      toast('success', success);
      return out;
    } catch (e) {
      toast('error', e?.message || 'That did not work.');
      return null;
    }
  };

  if (openId) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => setOpenId('')}><ArrowLeft className="h-4 w-4" /> Back to claims</Button>
        <ClaimDetail id={openId} auth={auth} toast={toast} />
      </div>
    );
  }

  const manage = can(auth, 'claims:manage');
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const scheme = schemes.find((s) => s.id === schemeId);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Claims" title="Insurance claims" description="Claim completed visits from NHIS and other schemes, submit them in monthly batches, and record the scheme’s decision and payment." />
      <Card
        title={scheme ? scheme.name : 'Claims'}
        subtitle={loading ? 'Loading…' : `${rows.length} ${TABS.find(([k]) => k === tab)[1].toLowerCase()}`}
        actions={(
          <>
            <label className="sr-only" htmlFor="claim-scheme">Scheme</label>
            <select id="claim-scheme" className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
              {schemes.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            {manage && ['DRAFT', 'QUERIED'].includes(tab) && (
              <Button disabled={!selected.length} onClick={async () => { if (await run(() => claimsService.submit(apiClient, selected), `${selected.length} claim${selected.length === 1 ? '' : 's'} submitted.`)) load(); }}>
                <Send className="h-4 w-4" /> Submit {selected.length || ''}
              </Button>
            )}
          </>
        )}
      >
        <div role="tablist" aria-label="Claim stage" className="mb-4 flex flex-wrap gap-2">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
          ))}
        </div>

        {tab === 'TO_CLAIM' && (
          <DataTable caption="Visits to claim" rowBadge={(row) => row.encounterCode} rows={rows} emptyMessage={loading ? 'Loading…' : 'No completed visits waiting to be claimed.'}
            columns={[
              { key: 'patient', label: 'Patient', mobilePrimary: true, render: (row) => <span><span className="font-semibold">{patientName(row.patient)}</span><span className="block text-xs text-slate-500">{row.patient.patientCode}</span></span> },
              { key: 'date', label: 'Visit', render: (row) => formatDay(row.startedAt) },
              { key: 'dx', label: 'Diagnoses', render: (row) => (row._count.diagnoses ? row._count.diagnoses : <span className="font-semibold text-red-700">None: add before claiming</span>) },
              { key: 'amount', label: 'Claimable', render: (row) => money(row.claimable) },
              { key: 'actions', label: 'Actions', render: (row) => manage && (
                <Button size="sm" disabled={!row._count.diagnoses} onClick={async () => { const c = await run(() => claimsService.create(apiClient, { encounterId: row.id, schemeId }), 'Claim prepared.'); if (c) setOpenId(c.id); }}>
                  <FilePlus2 className="h-3.5 w-3.5" /> Prepare claim
                </Button>
              ) }
            ]} />
        )}

        {tab === 'BATCHES' && (
          <DataTable caption="Claim batches" rowBadge={(row) => row.batchCode} rows={rows} emptyMessage={loading ? 'Loading…' : 'No batches yet; submitting a claim opens the month’s batch.'}
            columns={[
              { key: 'period', label: 'Month', mobilePrimary: true, render: (row) => <span className="font-semibold">{row.period}</span> },
              { key: 'status', label: 'Status', render: (row) => (row.status === 'OPEN' ? 'Open' : `Sent ${formatDay(row.submittedAt)}`) },
              { key: 'claims', label: 'Claims', render: (row) => row.claimCount },
              { key: 'claimed', label: 'Claimed', render: (row) => money(row.claimed) },
              { key: 'approved', label: 'Approved', render: (row) => money(row.approved) },
              { key: 'paid', label: 'Paid', render: (row) => money(row.paid) },
              { key: 'actions', label: 'Actions', render: (row) => manage && row.status === 'OPEN' && (
                <Button size="sm" variant="secondary" onClick={async () => { if (window.confirm(`Mark the ${row.period} batch as sent to the scheme? Later claims for that month will not be able to join it.`) && (await run(() => claimsService.closeBatch(apiClient, row.id), 'Batch marked as sent.'))) load(); }}>Mark as sent</Button>
              ) }
            ]} />
        )}

        {!['TO_CLAIM', 'BATCHES'].includes(tab) && (
          <DataTable caption="Claims" rowBadge={(row) => row.claimCode} rows={rows} emptyMessage={loading ? 'Loading…' : 'No claims here.'}
            columns={[
              ...(manage && ['DRAFT', 'QUERIED'].includes(tab) ? [{ key: 'pick', label: 'Select', render: (row) => <input type="checkbox" aria-label={`Select ${row.claimCode}`} className="h-4 w-4" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /> }] : []),
              { key: 'patient', label: 'Patient', mobilePrimary: true, render: (row) => <span><span className="font-semibold">{patientName(row.patient)}</span><span className="block text-xs text-slate-500">{row.claimCode} · {row.membershipNumber}</span></span> },
              { key: 'date', label: 'Visit', render: (row) => formatDay(row.attendanceDate) },
              ...(['DRAFT', 'QUERIED'].includes(tab) ? [{ key: 'vetted', label: 'Vetting', render: (row) => (row.vettedAt ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Vetted</span> : <span className="text-xs font-semibold text-amber-700">Not vetted</span>) }] : []),
              { key: 'claimed', label: 'Claimed', render: (row) => money(row.claimedAmount) },
              { key: 'approved', label: tab === 'PAID' ? 'Paid' : 'Approved', render: (row) => (tab === 'PAID' ? money(row.paidAmount) : row.approvedAmount != null ? money(row.approvedAmount) : '—') },
              { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
              { key: 'actions', label: 'Actions', render: (row) => <Button size="sm" onClick={() => setOpenId(row.id)}>Open</Button> }
            ]} />
        )}
      </Card>
    </div>
  );
}

function ClaimDetail({ id, auth, toast }) {
  const [claim, setClaim] = useState(null);
  const [modal, setModal] = useState('');
  const [vetResult, setVetResult] = useState(null);
  const load = useCallback(() => claimsService.claim(apiClient, id).then(setClaim).catch((e) => toast('error', e?.message || 'The claim could not be loaded.')), [id, toast]);
  useEffect(() => { load(); }, [load]);
  if (!claim) return <Card><p className="text-sm text-slate-500">Loading claim…</p></Card>;

  const act = async (fn, success) => {
    try {
      setClaim(await fn());
      toast('success', success);
      setModal('');
    } catch (e) {
      toast('error', e?.message || 'That did not work.');
    }
  };
  const manage = can(auth, 'claims:manage');
  const decide = can(auth, 'claims:adjudicate');
  const s = claim.status;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{claim.claimCode} · {claim.scheme.name}{claim.batch ? ` · batch ${claim.batch.batchCode} (${claim.batch.period})` : ''}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{patientName(claim.patient)}</h2>
            <p className="mt-1 text-sm text-slate-600">{claim.patient.patientCode} · member {claim.membershipNumber} · visit {claim.encounter.encounterCode} on {formatDay(claim.attendanceDate)}</p>
            <p className="mt-2 text-sm text-slate-800"><span className="font-semibold">Diagnoses:</span> {claim.diagnoses.map((d) => `${d.code ? `${d.code} ` : ''}${d.description}`).join('; ')}</p>
            {claim.vettedAt && ['DRAFT', 'QUERIED'].includes(s) && <p className="mt-2 inline-flex items-center gap-1 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><BadgeCheck className="h-4 w-4" /> Vetted {formatDateTime(claim.vettedAt)}{claim.vettedBy ? ` by ${claim.vettedBy.name}` : ''}{claim.vetNote ? ` · ${claim.vetNote}` : ''}</p>}
            {vetResult && !vetResult.vetted && <ul role="alert" className="mt-2 list-disc rounded-2xl bg-red-50 py-2 pl-7 pr-3 text-sm text-red-800">{vetResult.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            {vetResult?.warnings?.length > 0 && <ul className="mt-2 list-disc rounded-2xl bg-amber-50 py-2 pl-7 pr-3 text-sm text-amber-900">{vetResult.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            {claim.queryNote && <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><span className="font-semibold">Scheme query:</span> {claim.queryNote}</p>}
            {claim.rejectionReason && <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800"><span className="font-semibold">{s === 'CANCELLED' ? 'Cancelled' : 'Rejected'}:</span> {claim.rejectionReason}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <StatusPill status={s} />
            <p className="text-sm text-slate-700">Claimed <span className="font-bold">{money(claim.claimedAmount)}</span>{claim.approvedAmount != null ? ` · approved ${money(claim.approvedAmount)}` : ''}{Number(claim.paidAmount) > 0 ? ` · paid ${money(claim.paidAmount)} (${claim.paymentReference})` : ''}</p>
            <div className="flex flex-wrap gap-2">
              {manage && ['DRAFT', 'QUERIED'].includes(s) && <Button variant="secondary" onClick={() => setModal('edit')}><Pencil className="h-4 w-4" /> Edit claim</Button>}
              {manage && ['DRAFT', 'QUERIED'].includes(s) && <Button variant="secondary" onClick={async () => { try { const r = await claimsService.vet(apiClient, claim.id); setVetResult({ vetted: r.vetted, problems: r.problems, warnings: r.warnings }); setClaim(r.claim); toast(r.vetted ? 'success' : 'error', r.vetted ? 'Claim vetted.' : 'Claim failed vetting.'); } catch (e) { toast('error', e?.message || 'Vetting did not run.'); } }}><BadgeCheck className="h-4 w-4" /> Vet claim</Button>}
              {manage && ['DRAFT', 'QUERIED'].includes(s) && <Button onClick={() => act(async () => { await claimsService.submit(apiClient, [claim.id]); return claimsService.claim(apiClient, claim.id); }, 'Claim submitted.')}><Send className="h-4 w-4" /> Submit</Button>}
              {manage && ['DRAFT', 'QUERIED'].includes(s) && <Button variant="secondary" onClick={() => { const r = window.prompt('Why is this claim being cancelled?'); if (r && r.trim().length >= 3) act(() => claimsService.cancel(apiClient, claim.id, r.trim()), 'Claim cancelled; the invoices are back with the patient.'); }}>Cancel claim</Button>}
              {decide && s === 'SUBMITTED' && <Button variant="secondary" onClick={() => { const n = window.prompt('What did the scheme ask?'); if (n && n.trim().length >= 3) act(() => claimsService.query(apiClient, claim.id, n.trim()), 'Query recorded.'); }}>Record query</Button>}
              {decide && s === 'SUBMITTED' && <Button onClick={() => setModal('decide')}>Record decision</Button>}
              {decide && s === 'APPROVED' && <Button variant="success" onClick={() => setModal('pay')}>Record payment</Button>}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Lines" subtitle={`${claim.lines.length} line${claim.lines.length === 1 ? '' : 's'}`}>
        <DataTable caption="Claim lines" rowBadge={() => null} rows={claim.lines}
          columns={[
            { key: 'description', label: 'Item', mobilePrimary: true, render: (l) => <span><span className="font-semibold">{l.description}</span>{l.tariffCode && <span className="block text-xs text-slate-500">Tariff {l.tariffCode}</span>}</span> },
            { key: 'invoice', label: 'Invoice', render: (l) => l.invoice.invoiceCode },
            { key: 'qty', label: 'Qty', render: (l) => l.quantity },
            { key: 'amount', label: 'Claimed', render: (l) => money(l.amount) },
            { key: 'approved', label: 'Approved', render: (l) => (l.approvedAmount != null ? <span className={Number(l.approvedAmount) < Number(l.amount) ? 'font-semibold text-red-700' : ''}>{money(l.approvedAmount)}</span> : '—') },
            { key: 'reason', label: 'Reason cut', render: (l) => l.rejectedReason || '—' }
          ]} />
        <p className="mt-2 text-xs text-slate-500">Prepared {formatDateTime(claim.createdAt)}{claim.createdBy ? ` by ${claim.createdBy.name}` : ''}{claim.submittedAt ? ` · submitted ${formatDateTime(claim.submittedAt)}` : ''}{claim.decidedAt ? ` · decided ${formatDateTime(claim.decidedAt)}` : ''}</p>
      </Card>

      <EditClaimModal open={modal === 'edit'} claim={claim} onClose={() => setModal('')} onSave={(payload) => act(() => { setVetResult(null); return claimsService.update(apiClient, claim.id, payload); }, 'Claim updated. Vet it again before submitting.')} />
      <DecisionModal open={modal === 'decide'} claim={claim} onClose={() => setModal('')} onSave={(payload) => act(() => claimsService.decide(apiClient, claim.id, payload), 'Decision recorded.')} />
      <PaymentModal open={modal === 'pay'} claim={claim} onClose={() => setModal('')} onSave={(payload) => act(() => claimsService.pay(apiClient, claim.id, payload), 'Payment applied to the invoices.')} />
    </div>
  );
}

function DecisionModal({ open, claim, onClose, onSave }) {
  const [decision, setDecision] = useState('APPROVE');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState({});
  useEffect(() => {
    if (open) {
      setDecision('APPROVE');
      setReason('');
      setLines(Object.fromEntries(claim.lines.map((l) => [l.id, { approvedAmount: money(l.amount), rejectedReason: '' }])));
    }
  }, [open, claim]);
  if (!open) return null;
  const changed = claim.lines.filter((l) => Number(lines[l.id]?.approvedAmount) !== Number(l.amount));
  const total = claim.lines.reduce((s, l) => s + Number(lines[l.id]?.approvedAmount || 0), 0);
  const ready = decision === 'REJECT' ? reason.trim().length >= 3 : changed.every((l) => (lines[l.id]?.rejectedReason || '').trim().length >= 2);
  const save = () => onSave(decision === 'REJECT'
    ? { decision, reason: reason.trim() }
    : { decision, lines: changed.map((l) => ({ lineId: l.id, approvedAmount: Number(lines[l.id].approvedAmount), rejectedReason: lines[l.id].rejectedReason.trim() })) });
  return (
    <Modal open title="Scheme decision" description="Change the amount on any line the scheme cut, with its reason. Lines left alone are approved in full." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={decision === 'REJECT' ? 'danger' : 'primary'} disabled={!ready} onClick={save}>{decision === 'REJECT' ? 'Reject claim' : `Approve ${money(total)}`}</Button></>}>
      <div className="space-y-4">
        <div className="flex gap-4 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="radio" name="decision" checked={decision === 'APPROVE'} onChange={() => setDecision('APPROVE')} /> Approved (in full or in part)</label>
          <label className="flex items-center gap-2"><input type="radio" name="decision" checked={decision === 'REJECT'} onChange={() => setDecision('REJECT')} /> Rejected</label>
        </div>
        {decision === 'REJECT' ? (
          <FormField label="Scheme’s reason" required><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></FormField>
        ) : claim.lines.map((l) => (
          <div key={l.id} className="grid gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-3">
            <p className="text-sm font-semibold text-slate-800 sm:col-span-3">{l.description} <span className="font-normal text-slate-500">claimed {money(l.amount)}</span></p>
            <FormField label="Approved"><input type="number" step="0.01" min="0" max={Number(l.amount)} className={inputClass} value={lines[l.id]?.approvedAmount ?? ''} onChange={(e) => setLines((c) => ({ ...c, [l.id]: { ...c[l.id], approvedAmount: e.target.value } }))} /></FormField>
            {Number(lines[l.id]?.approvedAmount) !== Number(l.amount) && (
              <FormField label="Reason cut" required className="sm:col-span-2"><input className={inputClass} value={lines[l.id]?.rejectedReason ?? ''} onChange={(e) => setLines((c) => ({ ...c, [l.id]: { ...c[l.id], rejectedReason: e.target.value } }))} maxLength={300} /></FormField>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function PaymentModal({ open, claim, onClose, onSave }) {
  const [form, setForm] = useState({ amount: '', reference: '', paidAt: '' });
  useEffect(() => {
    if (open) setForm({ amount: money(claim.approvedAmount), reference: '', paidAt: new Date().toISOString().slice(0, 10) });
  }, [open, claim]);
  if (!open) return null;
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const short = Number(form.amount) < Number(claim.approvedAmount);
  return (
    <Modal open title="Scheme payment" description={`Approved ${money(claim.approvedAmount)}. Anything not paid returns to the patient’s invoice balance.`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="success" disabled={!(Number(form.amount) > 0) || form.reference.trim().length < 2} onClick={() => onSave({ amount: Number(form.amount), reference: form.reference.trim(), paidAt: form.paidAt ? new Date(`${form.paidAt}T12:00:00`).toISOString() : undefined })}>Apply payment</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Amount paid" required help={short ? 'Less than approved.' : undefined}><input type="number" step="0.01" min="0" className={inputClass} value={form.amount} onChange={set('amount')} /></FormField>
        <FormField label="Payment reference" required><input className={inputClass} value={form.reference} onChange={set('reference')} maxLength={80} placeholder="Remittance / transfer ref" /></FormField>
        <FormField label="Date received"><input type="date" className={inputClass} value={form.paidAt} onChange={set('paidAt')} /></FormField>
      </div>
    </Modal>
  );
}

function EditClaimModal({ open, claim, onClose, onSave }) {
  const [diagnoses, setDiagnoses] = useState([]);
  const [lines, setLines] = useState({});
  const [removed, setRemoved] = useState([]);
  useEffect(() => {
    if (!open) return;
    setDiagnoses(claim.diagnoses.map((d) => ({ code: d.code || '', description: d.description || '', type: d.type || '' })));
    setLines(Object.fromEntries(claim.lines.map((l) => [l.id, { description: l.description, tariffCode: l.tariffCode || '', quantity: String(l.quantity), unitPrice: money(l.unitPrice) }])));
    setRemoved([]);
  }, [open, claim]);
  if (!open) return null;
  const kept = claim.lines.filter((l) => !removed.includes(l.id));
  const total = kept.reduce((sum, l) => sum + Number(lines[l.id]?.quantity || 0) * Number(lines[l.id]?.unitPrice || 0), 0);
  const setLine = (id, key) => (e) => setLines((c) => ({ ...c, [id]: { ...c[id], [key]: e.target.value } }));
  const setDx = (index, key) => (e) => setDiagnoses((c) => c.map((d, i) => (i === index ? { ...d, [key]: e.target.value } : d)));
  const validDx = diagnoses.filter((d) => d.description.trim());
  const ready = validDx.length > 0 && kept.length > 0 && kept.every((l) => Number(lines[l.id]?.quantity) >= 1 && lines[l.id]?.description.trim() && lines[l.id]?.unitPrice !== '');
  const save = () => onSave({
    diagnoses: validDx.map((d) => ({ code: d.code.trim() || 'N/A', description: d.description.trim(), type: d.type || undefined })),
    lines: kept.map((l) => ({ id: l.id, description: lines[l.id].description.trim(), tariffCode: lines[l.id].tariffCode.trim() || null, quantity: Number(lines[l.id].quantity), unitPrice: Number(lines[l.id].unitPrice) })),
    ...(removed.length ? { removeLineIds: removed } : {})
  });
  return (
    <Modal open title="Edit claim" description="Correct diagnoses and lines before the claim goes out. Editing clears any earlier vetting." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready} onClick={save}>Save claim ({money(total)})</Button></>}>
      <div className="space-y-4">
        <section aria-label="Diagnoses" className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Diagnoses</h4>
          {diagnoses.map((d, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[7rem_1fr_auto]">
              <input aria-label="ICD-10 code" className={inputClass} placeholder="ICD-10" value={d.code} onChange={setDx(i, 'code')} maxLength={20} />
              <input aria-label="Diagnosis" className={inputClass} placeholder="Diagnosis" value={d.description} onChange={setDx(i, 'description')} maxLength={300} />
              <Button size="sm" variant="secondary" aria-label="Remove diagnosis" disabled={diagnoses.length === 1} onClick={() => setDiagnoses((c) => c.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setDiagnoses((c) => [...c, { code: '', description: '', type: '' }])}>Add diagnosis</Button>
        </section>
        <section aria-label="Lines" className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Lines</h4>
          {kept.map((l) => (
            <div key={l.id} className="grid gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[1fr_8rem_5rem_7rem_auto]">
              <input aria-label="Description" className={inputClass} value={lines[l.id]?.description ?? ''} onChange={setLine(l.id, 'description')} maxLength={300} />
              <input aria-label="Tariff code" className={inputClass} placeholder="Tariff code" value={lines[l.id]?.tariffCode ?? ''} onChange={setLine(l.id, 'tariffCode')} maxLength={40} />
              <input aria-label="Quantity" type="number" min="1" className={inputClass} value={lines[l.id]?.quantity ?? ''} onChange={setLine(l.id, 'quantity')} />
              <input aria-label="Unit price" type="number" min="0" step="0.01" className={inputClass} value={lines[l.id]?.unitPrice ?? ''} onChange={setLine(l.id, 'unitPrice')} />
              <Button size="sm" variant="secondary" aria-label={`Remove ${l.description}`} disabled={kept.length === 1} onClick={() => setRemoved((c) => [...c, l.id])}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          {removed.length > 0 && <p className="text-xs text-slate-500">{removed.length} line{removed.length === 1 ? '' : 's'} will be taken off this claim; an invoice with no lines left returns to the patient.</p>}
        </section>
      </div>
    </Modal>
  );
}
