import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { BIRTH_OUTCOMES, DELIVERY_MODES, END_REASONS, PERINEUM, RISK_FACTORS, SCREENING, gestationLabel, maternityService } from '../../services/maternityService';
import { ageLabel, patientName } from '../opd/opdUtils';
import { FormSummary } from '../clinics/ClinicalFormsCard';
import { formatDay } from './PregnancyCard';

const TABS = [['ACTIVE', 'Ongoing'], ['DELIVERED', 'Delivered'], ['ENDED', 'Ended']];

/** The pregnancy register: every booked pregnancy, with its antenatal record, delivery and postnatal care. */
export function MaternityRegisterPage() {
  const { dispatch } = useAppStore();
  const [tab, setTab] = useState('ACTIVE');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState('');
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(listItems(await maternityService.pregnancies(apiClient, { status: tab })));
    } catch (error) {
      toast('error', error?.message || 'The register could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    if (!openId) load();
  }, [load, openId]);

  if (openId) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => setOpenId('')}><ArrowLeft className="h-4 w-4" /> Back to register</Button>
        <PregnancyRecord id={openId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Maternity" title="Maternity register" description="Booked pregnancies with gestation today, due dates and risk factors. Book and follow pregnancies from the antenatal clinic." />
      <Card title="Pregnancies" subtitle={loading ? 'Loading…' : `${rows.length} ${TABS.find(([k]) => k === tab)[1].toLowerCase()}`} actions={<Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>}>
        <div role="tablist" aria-label="Pregnancy status" className="mb-4 flex flex-wrap gap-2">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
          ))}
        </div>
        <DataTable
          caption="Pregnancies"
          rowBadge={(row) => row.pregnancyCode}
          emptyMessage={loading ? 'Loading…' : 'No pregnancies here.'}
          rows={rows}
          columns={[
            { key: 'patient', label: 'Mother', mobilePrimary: true, render: (row) => (
              <span><span className="font-semibold text-slate-900">{patientName(row.patient)}</span><span className="block text-xs text-slate-500">{row.patient.patientCode} · {ageLabel(row.patient.dateOfBirth)}</span></span>
            ) },
            { key: 'gestation', label: tab === 'ACTIVE' ? 'Gestation today' : 'Outcome', render: (row) => (tab === 'ACTIVE' ? gestationLabel(row.gestationToday) : row.delivery ? `${DELIVERY_MODES[row.delivery.mode]}, ${formatDay(row.delivery.deliveredAt)}` : END_REASONS[row.endReason] || '—') },
            { key: 'edd', label: 'Due date', render: (row) => formatDay(row.edd) },
            { key: 'gp', label: 'G / P', render: (row) => `G${row.gravida} P${row.parity}` },
            { key: 'risks', label: 'Risks', render: (row) => (row.riskFactors?.length ? <span className="font-semibold text-amber-800">{row.riskFactors.map((r) => RISK_FACTORS[r] || r).join(', ')}</span> : '—') },
            { key: 'visits', label: 'Visits', render: (row) => row._count?.forms ?? 0 },
            { key: 'actions', label: 'Actions', render: (row) => <Button size="sm" onClick={() => setOpenId(row.id)}>Open</Button> }
          ]}
        />
      </Card>
    </div>
  );
}

function PregnancyRecord({ id }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    maternityService.pregnancy(apiClient, id).then(setP).catch((e) => setError(e?.message || 'This pregnancy could not be loaded.'));
  }, [id]);
  if (error) return <Card><p role="alert" className="text-sm font-semibold text-red-600">{error}</p></Card>;
  if (!p) return <Card><p className="text-sm text-slate-500">Loading…</p></Card>;
  const anc = p.forms.filter((f) => f.type === 'ANC_VISIT');
  const pnc = p.forms.filter((f) => f.type === 'POSTNATAL_CHECK');
  const d = p.delivery;
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{p.pregnancyCode} · {p.status === 'ACTIVE' ? 'ongoing' : p.status.toLowerCase()}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{patientName(p.patient)}</h2>
        <p className="mt-1 text-sm text-slate-600">{p.patient.patientCode} · {ageLabel(p.patient.dateOfBirth)} · G{p.gravida} P{p.parity}{p.livingChildren != null ? ` · ${p.livingChildren} living` : ''} · Blood group {p.bloodGroup || 'not known'}</p>
        <p className="mt-1 text-sm text-slate-800">LMP {formatDay(p.lmp)} · Due {formatDay(p.edd)}{p.eddByScan ? ' (by scan)' : ''}{p.gestationToday ? ` · ${gestationLabel(p.gestationToday)} today` : ''}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.patient.allergies?.map((a) => <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white"><AlertTriangle className="h-3.5 w-3.5" /> Allergy: {a.substance}</span>)}
          {p.riskFactors.map((r) => <span key={r} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">{RISK_FACTORS[r] || r}</span>)}
        </div>
        {Object.keys(p.screening || {}).length > 0 && <p className="mt-2 text-xs text-slate-600">Screening: {Object.entries(p.screening).map(([k, v]) => `${SCREENING[k] || k} ${String(v).toLowerCase().replace('_', ' ')}`).join(' · ')}</p>}
        {p.status === 'ENDED' && <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">Ended {formatDay(p.endedAt)}: {END_REASONS[p.endReason]}{p.endNote ? `. ${p.endNote}` : ''}</p>}
      </Card>

      <Card title="Antenatal visits" subtitle={`${anc.length} recorded`}>
        {anc.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
          <div className="space-y-3">
            {anc.map((f) => (
              <article key={f.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{formatDateTime(f.createdAt)} · {f.encounter?.encounterCode} · {f.author?.name}{f.amendsId ? ' · correction' : ''}</p>
                <FormSummary type={f.type} data={f.data} />
              </article>
            ))}
          </div>
        )}
      </Card>

      {d && (
        <Card title="Delivery" subtitle={`${formatDateTime(d.deliveredAt)} · ${d.encounter?.encounterCode}${d.attendant ? ` · ${d.attendant.name}` : ''}`}>
          <p className="text-sm text-slate-800">{DELIVERY_MODES[d.mode]} at {d.gestationWeeks ?? '?'} weeks · Blood loss {d.bloodLossMl ?? '—'} ml · Placenta {d.placentaComplete ? 'complete' : 'INCOMPLETE'}{d.perineum ? ` · ${PERINEUM[d.perineum]}` : ''}{d.oxytocinGiven ? ' · oxytocin given' : ''}</p>
          {d.complications && <p className="mt-1 text-sm text-slate-800"><span className="font-semibold">Complications:</span> {d.complications}</p>}
          <ul className="mt-3 space-y-2">
            {d.babies.map((b) => (
              <li key={b.id} className="rounded-2xl bg-slate-50 px-4 py-2 text-sm">
                <span className="font-semibold">{d.babies.length > 1 ? `Baby ${b.birthOrder}: ` : ''}{BIRTH_OUTCOMES[b.outcome]}</span>, {b.sex.toLowerCase()}{b.birthWeightG ? `, ${b.birthWeightG} g` : ''}{b.apgar1 != null ? `, Apgar ${b.apgar1}/${b.apgar5 ?? '?'}` : ''}{b.resuscitated ? ', resuscitated' : ''}
                {b.patient && <span className="block text-xs text-slate-600">Registered as {b.patient.firstName} {b.patient.lastName} ({b.patient.patientCode})</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(d || pnc.length > 0) && (
        <Card title="Postnatal care" subtitle={`${pnc.length} check${pnc.length === 1 ? '' : 's'}`}>
          {pnc.length === 0 ? <p className="text-sm text-slate-500">No postnatal checks yet. WHO advises checks within 24 hours, on days 3, 7-14 and at 6 weeks.</p> : pnc.map((f) => (
            <article key={f.id} className="mb-3 rounded-2xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{formatDateTime(f.createdAt)} · {f.author?.name}</p>
              <FormSummary type={f.type} data={f.data} />
            </article>
          ))}
        </Card>
      )}
    </div>
  );
}
