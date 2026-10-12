import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, BedDouble, Download, FileText, ShieldCheck, Upload } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { directoryService } from '../../services/directoryService';
import { ageLabel, can, patientName } from '../opd/opdUtils';
import { formatDateTime } from '../../utils/formatters';
import { TestLine } from '../clinician/ResultView';
import { DOCUMENT_CATEGORIES, MAX_DOCUMENT_BYTES, PURPOSES, VISIT_TYPE, day, fileSize, ongoingMedicines, readFileAsBase64, saveBytes } from './profileUtils';

/*
  A patient's whole record, read-only: who they are, what must not be missed, every visit,
  and the documents filed against them.

  It was opened for a stated reason that has already been logged. Reading a past visit's
  notes and results is logged again, against the same reason, because it is a further look
  at the record.
*/

const TABS = [
  { id: 'history', label: 'Visit history' },
  { id: 'documents', label: 'Documents' },
  { id: 'other', label: 'Other care' }
];

export function PatientProfile({ row, chart, purpose, onClose }) {
  const { state, dispatch } = useAppStore();
  const auth = state.auth;
  const patient = chart.patient;
  const [tab, setTab] = useState('history');
  const [visit, setVisit] = useState(null);
  const [documents, setDocuments] = useState(null);
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await directoryService.documents(apiClient, patient.id);
      setDocuments(res.items || []);
    } catch (e) {
      setDocuments([]);
      toast('error', e?.message || 'Documents could not be loaded.');
    }
  }, [patient.id, toast]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const medicines = useMemo(() => ongoingMedicines(chart.prescriptions), [chart.prescriptions]);
  const inWard = chart.admissions.find((a) => a.status === 'ADMITTED');

  async function openVisit(encounter) {
    try {
      setVisit({ summary: encounter, record: await directoryService.visit(apiClient, patient.id, encounter.id, purpose) });
    } catch (e) {
      toast('error', e?.message || 'That visit could not be opened.');
    }
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl bg-[#09101a] p-4 text-white shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button type="button" onClick={onClose} aria-label="Back to the directory" className="mt-0.5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Directory</span>
            </button>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{patientName(patient)}</h2>
              <p className="text-xs text-slate-400">{[ageLabel(patient.dateOfBirth), patient.gender, patient.patientCode].filter(Boolean).join(' • ')}</p>
              <p className="mt-1 text-sm text-slate-200">
                {[patient.phone, patient.address, patient.nationalId && `Ghana Card ${patient.nationalId}`, patient.insuranceProvider && `${patient.insuranceProvider}${patient.policyNumber ? ` ${patient.policyNumber}` : ''}`].filter(Boolean).join(' · ') || 'No contact details recorded'}
              </p>
            </div>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Opened for {PURPOSES[purpose]?.toLowerCase() || 'review'} · logged
          </p>
        </div>
        {patient.deceasedRecord && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">Deceased {day(patient.deceasedRecord.dateOfDeath)}{patient.deceasedRecord.causeOfDeath ? ` · ${patient.deceasedRecord.causeOfDeath}` : ''}</p>}
        {inWard && <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sky-400/20 px-3 py-2 text-sm font-semibold text-sky-100"><BedDouble className="h-4 w-4" aria-hidden="true" /> In {inWard.ward.name} since {day(inWard.admittedAt)}</p>}
      </header>

      {/* The permanent flags: what must be seen before anything else. */}
      <section aria-label="Health summary" className="grid gap-4 md:grid-cols-3">
        <Card title="Allergies" compact>
          {patient.allergies.length ? (
            <ul className="flex flex-wrap gap-2">
              {patient.allergies.map((a) => (
                <li key={a.id} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {a.substance}{a.reaction ? ` (${a.reaction})` : ''}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">None recorded.</p>}
        </Card>
        <Card title="Long-term conditions" compact>
          {chart.problems.length ? (
            <ul className="flex flex-wrap gap-2">{chart.problems.map((p) => <li key={p.id} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{p.code ? `${p.code} ` : ''}{p.description}</li>)}</ul>
          ) : <p className="text-sm text-slate-500">None recorded.</p>}
        </Card>
        <Card title="Ongoing medicines" subtitle="Prescribed more than once in six months, or with no end date. Check with the patient." compact>
          {medicines.length ? (
            <ul className="space-y-1 text-sm text-slate-800">{medicines.map((m) => <li key={m.name}><span className="font-semibold">{m.name}</span>{m.how ? ` · ${m.how}` : ''}</li>)}</ul>
          ) : <p className="text-sm text-slate-500">None found.</p>}
        </Card>
      </section>

      <div role="tablist" aria-label="Record" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="profile-panel"
            onClick={() => setTab(item.id)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === item.id ? 'border-clinical-500 text-clinical-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {item.label}{item.id === 'documents' && documents ? ` (${documents.length})` : item.id === 'history' ? ` (${chart.encounters.length})` : ''}
          </button>
        ))}
      </div>

      <div id="profile-panel" role="tabpanel">
        {tab === 'history' && <VisitHistory encounters={chart.encounters} onOpen={openVisit} />}
        {tab === 'documents' && <DocumentVault patientId={patient.id} documents={documents} canWrite={can(auth, 'records:documents:write')} reload={loadDocuments} toast={toast} />}
        {tab === 'other' && <OtherCare chart={chart} />}
      </div>

      <VisitRecordModal visit={visit} onClose={() => setVisit(null)} />
    </div>
  );
}

/* ----------------------------------------------------------- visit history */

function VisitHistory({ encounters, onOpen }) {
  if (!encounters.length) return <Card><p className="text-sm text-slate-500">No visits on record.</p></Card>;
  return (
    <ol className="space-y-3" aria-label="Visits, newest first">
      {encounters.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onOpen(e)}
            aria-label={`Open the visit of ${day(e.startedAt)}, ${e.encounterCode}`}
            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-clinical-300 hover:shadow-md"
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">{day(e.startedAt)} · {VISIT_TYPE[e.type] || e.type}{e.clinic && e.clinic !== 'GENERAL' ? ` · ${e.clinic.toLowerCase().replace(/_/g, ' ')}` : ''}</span>
              <span className="text-xs font-semibold text-slate-500">{e.encounterCode}{e.outcome ? ` · ${e.outcome.toLowerCase().replace(/_/g, ' ')}` : ` · ${e.status.toLowerCase().replace(/_/g, ' ')}`}</span>
            </span>
            {e.chiefComplaint && <span className="mt-1 block text-sm text-slate-700">{e.chiefComplaint}</span>}
            {e.diagnoses.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1.5">{e.diagnoses.map((d) => <span key={`${d.code}-${d.description}`} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">{d.code ? `${d.code} ` : ''}{d.description}</span>)}</span>
            )}
            <span className="mt-2 block text-xs text-slate-500">{[e.attending?.name && `Seen by ${e.attending.name}`, e._count.notes && `${e._count.notes} note${e._count.notes === 1 ? '' : 's'}`, e._count.orders && `${e._count.orders} test order${e._count.orders === 1 ? '' : 's'}`, e._count.prescriptions && `${e._count.prescriptions} prescription${e._count.prescriptions === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function VisitRecordModal({ visit, onClose }) {
  const r = visit?.record;
  return (
    <Modal open={Boolean(visit)} title={visit ? `Visit ${r.encounterCode} · ${day(r.startedAt)}` : ''} description={r ? [VISIT_TYPE[r.type], r.attending?.name && `Seen by ${r.attending.name}`, r.outcome && r.outcome.toLowerCase().replace(/_/g, ' ')].filter(Boolean).join(' · ') : ''} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {r && (
        <div className="space-y-5 text-sm text-slate-800">
          {r.chiefComplaint && <p><span className="font-semibold">Complaint:</span> {r.chiefComplaint}</p>}

          {r.vitalSigns.length > 0 && (
            <section aria-label="Vitals">
              <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Vitals</h4>
              <ul className="mt-1 space-y-1">
                {r.vitalSigns.map((v) => (
                  <li key={v.id}>
                    <span className="text-xs text-slate-500">{formatDateTime(v.recordedAt)}</span>{' '}
                    {[v.temperatureC != null && `T ${Number(v.temperatureC)}°C`, v.pulseBpm != null && `P ${v.pulseBpm}`, v.respiratoryRate != null && `RR ${v.respiratoryRate}`, v.systolicBp != null && `BP ${v.systolicBp}/${v.diastolicBp}`, v.spo2 != null && `SpO₂ ${v.spo2}%`, v.weightKg != null && `${Number(v.weightKg)} kg`].filter(Boolean).join(' · ')}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.diagnoses.length > 0 && (
            <section aria-label="Diagnoses">
              <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Diagnoses</h4>
              <div className="mt-1 flex flex-wrap gap-1.5">{r.diagnoses.map((d) => <span key={d.id} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">{d.code ? `${d.code} ` : ''}{d.description}</span>)}</div>
            </section>
          )}

          <section aria-label="Notes">
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Clinical notes</h4>
            {r.notes.length ? (
              <ul className="mt-1 space-y-2">
                {r.notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{n.type.toLowerCase()} · {n.author?.name || 'Unknown'} · {formatDateTime(n.createdAt)}{n.amendsId ? ' · correction' : ''}</p>
                    {[['S', n.subjective], ['O', n.objective], ['A', n.assessment], ['P', n.plan]].filter(([, v]) => v).map(([k, v]) => <p key={k} className="mt-1 whitespace-pre-wrap"><span className="font-bold">{k}:</span> {v}</p>)}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-slate-500">No notes were saved on this visit.</p>}
          </section>

          {r.prescriptions.length > 0 && (
            <section aria-label="Medicines">
              <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Medicines prescribed</h4>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {r.prescriptions.flatMap((rx) => rx.items.map((i, index) => (
                  <li key={`${rx.id}-${index}`}>{[i.drugName, i.strength, i.dosageForm].filter(Boolean).join(' ')} — {i.dose} {i.route}, {i.frequency}{i.durationDays ? ` for ${i.durationDays} days` : ''}</li>
                )))}
              </ul>
            </section>
          )}

          {r.tests.length > 0 && (
            <section aria-label="Tests and results">
              <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Tests and results</h4>
              <ul className="mt-1 space-y-3">{r.tests.map((test) => <li key={test.id}><TestLine test={test} expanded /></li>)}</ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ----------------------------------------------------------------- vault */

function DocumentVault({ patientId, documents, canWrite, reload, toast }) {
  const fileInput = useRef(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('REFERRAL_LETTER');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  function choose(chosen) {
    setProblem('');
    if (chosen && chosen.size > MAX_DOCUMENT_BYTES) {
      setFile(null);
      setProblem(`That file is ${fileSize(chosen.size)}. The limit is ${fileSize(MAX_DOCUMENT_BYTES)}: scan or photograph it at a lower resolution.`);
      return;
    }
    setFile(chosen || null);
    if (chosen && !title.trim()) setTitle(chosen.name.replace(/\.[^.]*$/, '').replace(/[_-]+/g, ' ').slice(0, 120));
  }

  async function submit(event) {
    event.preventDefault();
    if (!file || title.trim().length < 2) return;
    setBusy(true);
    try {
      await directoryService.upload(apiClient, patientId, { title: title.trim(), category, fileName: file.name, contentBase64: await readFileAsBase64(file) });
      toast('success', 'Document filed.');
      setTitle('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      await reload();
    } catch (e) {
      setProblem(e?.message || 'The document could not be filed.');
    } finally {
      setBusy(false);
    }
  }

  async function download(doc) {
    try {
      saveBytes(await directoryService.download(doc.id), doc.fileName, doc.mimeType);
    } catch (e) {
      toast('error', e?.message || 'The document could not be downloaded.');
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card title="Document vault" subtitle="Letters, reports and consents from here or from other hospitals.">
        {documents === null && <p className="text-sm text-slate-500">Loading documents…</p>}
        {documents?.length === 0 && <p className="text-sm text-slate-500">Nothing has been filed for this patient.</p>}
        <ul className="divide-y divide-slate-100">
          {(documents || []).map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{doc.title}</p>
                  <p className="text-xs text-slate-500">{DOCUMENT_CATEGORIES[doc.category]} · {fileSize(doc.sizeBytes)} · {day(doc.createdAt)}{doc.uploadedBy ? ` · ${doc.uploadedBy.name}` : ''}</p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => download(doc)} aria-label={`Download ${doc.title}`}><Download className="h-4 w-4" /> Download</Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="File a document" subtitle="PDF, JPEG, PNG or WebP, up to 5 MB.">
        {canWrite ? (
          <form onSubmit={submit} className="space-y-3">
            <FormField label="Title" required>
              <input className={inputClass} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            <FormField label="Kind of document">
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(DOCUMENT_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormField>
            <FormField label="File" required>
              <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={inputClass} onChange={(e) => choose(e.target.files?.[0])} />
            </FormField>
            {problem && <p role="alert" className="text-sm font-semibold text-red-600">{problem}</p>}
            <Button type="submit" disabled={busy || !file || title.trim().length < 2}><Upload className="h-4 w-4" /> {busy ? 'Filing…' : 'File document'}</Button>
          </form>
        ) : <p className="text-sm text-slate-500">Your role can read documents but not file them.</p>}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ other care */

function OtherCare({ chart }) {
  const sections = [
    ['Ward stays', chart.admissions.map((a) => ({ key: a.id, text: `${a.admissionCode} · ${a.ward.name} · ${day(a.admittedAt)}${a.dischargedAt ? ` to ${day(a.dischargedAt)}` : ' (still in)'}${a.reason ? ` · ${a.reason}` : ''}` }))],
    ['Operations', chart.surgeries.map((s) => ({ key: s.id, text: `${s.procedureName} · ${day(s.scheduledStart)} · ${s.status.toLowerCase().replace(/_/g, ' ')}${s.surgeon ? ` · ${s.surgeon.name}` : ''}` }))],
    ['Pregnancies', chart.pregnancies.map((p) => ({ key: p.id, text: `${p.pregnancyCode} · booked ${day(p.bookedAt)} · ${p.status.toLowerCase().replace(/_/g, ' ')}${p.delivery ? ` · delivered ${day(p.delivery.deliveredAt)}` : ''}` }))],
    ['Immunisations', chart.immunizations.map((i) => ({ key: i.id, text: `${i.vaccine} · ${day(i.givenAt)}${i.givenElsewhere ? ' (given elsewhere)' : ''}` }))]
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map(([title, items]) => (
        <Card key={title} title={title} compact>
          {items.length ? <ul className="space-y-1.5 text-sm text-slate-800">{items.map((i) => <li key={i.key}>{i.text}</li>)}</ul> : <p className="text-sm text-slate-500">None on record.</p>}
        </Card>
      ))}
    </div>
  );
}
