import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlaskConical, RefreshCw, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { P, can } from '../opd/opdUtils';
import { ORDER_SETS, resolveOrderSet } from './clinicalContent';
import { ResultDetail, TestLine } from './ResultView';

/*
  Tab 2: diagnostic tests.

  The left side is what the patient has had done - this visit's tests with their results
  once the lab has signed them off, then earlier visits'. The right side is the order
  builder: pick tests or tap a bundle, and they wait there (saved with the draft) until the
  clinician sends them, either straight away or with "Send to Diagnostics & Suspend".
*/

const POLL_MS = 30_000;
const HISTORY_VISITS = 10;

export function InvestigationsTab({ encounter, auth, open, busy, draft, updateDraft, sendOrdersNow }) {
  const canOrder = open && can(auth, P.ORDER);
  const [catalog, setCatalog] = useState([]);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');

  const staged = useMemo(() => draft.stagedTestIds || [], [draft.stagedTestIds]);
  const urgency = draft.urgency || 'ROUTINE';

  const loadHistory = useCallback(async () => {
    try {
      const data = await encounterService.clinicalHistory(apiClient, encounter.patient.id, HISTORY_VISITS);
      setHistory(data.encounters || []);
      setHistoryError('');
    } catch (e) {
      setHistoryError(e?.message || 'Results could not be loaded.');
    }
  }, [encounter.patient.id]);

  // Reload whenever the visit's own tests change (something was ordered or came back).
  const testSignature = (encounter.orders || []).flatMap((o) => o.items.map((i) => `${i.id}:${i.status}`)).join('|');
  useEffect(() => {
    loadHistory();
  }, [loadHistory, testSignature]);

  const waiting = history?.find((e) => e.id === encounter.id)?.tests.some((t) => !t.resultedAt);
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = window.setInterval(() => document.visibilityState === 'visible' && loadHistory(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [waiting, loadHistory]);

  useEffect(() => {
    if (!canOrder) return;
    encounterService.catalog(apiClient)
      .then((data) => setCatalog(listItems(data).filter((item) => item.isActive !== false && (item.type === 'LAB' || item.type === 'SCAN'))))
      .catch(() => setCatalog([]));
  }, [canOrder]);

  // Tests already ordered on this visit and not cancelled cannot be ordered twice.
  const orderedIds = useMemo(() => new Set((encounter.orders || [])
    .filter((o) => o.status !== 'CANCELLED')
    .flatMap((o) => o.items.filter((i) => i.status !== 'CANCELLED').map((i) => i.catalogItemId || i.catalogItem?.id))), [encounter.orders]);

  const toggle = (id) => updateDraft((prev) => {
    const current = prev.stagedTestIds || [];
    return { stagedTestIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] };
  });

  const toggleSet = (set) => {
    const { items } = resolveOrderSet(set, catalog);
    const ids = items.map((i) => i.id).filter((id) => !orderedIds.has(id));
    updateDraft((prev) => {
      const current = prev.stagedTestIds || [];
      const allIn = ids.length > 0 && ids.every((id) => current.includes(id));
      return { stagedTestIds: allIn ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])] };
    });
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    // Laboratory tests first: they are what is ordered most, and the catalogue lists scans ahead of them.
    const ordered = [...catalog].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'LAB' ? -1 : 1));
    return ordered.filter((item) => (typeFilter === 'ALL' || item.type === typeFilter)
      && (!q || item.name.toLowerCase().includes(q) || String(item.catalogCode).toLowerCase().includes(q) || String(item.modality || '').toLowerCase().includes(q))).slice(0, 40);
  }, [catalog, filter, typeFilter]);

  const byId = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const thisVisit = history?.find((e) => e.id === encounter.id);
  const earlier = (history || []).filter((e) => e.id !== encounter.id && e.tests.length > 0);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card
        title="Results and history"
        subtitle="Values appear once the lab or imaging unit has signed a result off."
        actions={<Button size="sm" variant="ghost" onClick={loadHistory} aria-label="Refresh results"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</Button>}
      >
        {historyError && <p role="alert" className="text-sm font-semibold text-red-600">{historyError}</p>}
        {!historyError && history === null && <p className="text-sm text-slate-500">Loading results…</p>}

        {history && (
          <div className="space-y-5">
            <section aria-label="This visit">
              <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">This visit</h4>
              {thisVisit?.tests.length ? (
                <ul className="mt-2 space-y-3">
                  {thisVisit.tests.map((test) => <li key={test.id}><TestLine test={test} expanded /></li>)}
                </ul>
              ) : <p className="mt-2 text-sm text-slate-500">Nothing has been sent for this visit yet.</p>}
            </section>

            <section aria-label="Earlier visits">
              <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Earlier results</h4>
              {earlier.length === 0 && <p className="mt-2 text-sm text-slate-500">No earlier tests on record.</p>}
              <div className="mt-2 space-y-4">
                {earlier.map((visit) => (
                  <div key={visit.id}>
                    <p className="text-xs font-semibold text-slate-600">{formatDateTime(visit.startedAt)} · {visit.encounterCode}</p>
                    <ul className="mt-1.5 space-y-2">
                      {visit.tests.map((test) => (
                        <li key={test.id}>
                          {test.resultedAt ? (
                            <details>
                              <summary className="cursor-pointer list-none"><TestLine test={test} /></summary>
                              <ResultDetail test={test} />
                            </details>
                          ) : <TestLine test={test} />}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </Card>

      <Card title="Diagnostic Tests" subtitle="Request laboratory tests and medical imaging in one place, then send them now or pause the visit while results are prepared.">
        {!canOrder ? (
          <p className="text-sm text-slate-500">{open ? 'Only clinicians who can order tests see the order builder.' : 'This visit is closed, so nothing more can be ordered.'}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">One-click bundles</p>
              <div className="flex flex-wrap gap-2">
                {ORDER_SETS.map((set) => {
                  const { items, missing } = resolveOrderSet(set, catalog);
                  const usable = items.filter((i) => !orderedIds.has(i.id));
                  const active = usable.length > 0 && usable.every((i) => staged.includes(i.id));
                  if (items.length === 0) return null;
                  return (
                    <button
                      key={set.id}
                      type="button"
                      aria-pressed={active}
                      disabled={usable.length === 0}
                      onClick={() => toggleSet(set)}
                      title={items.map((i) => i.name).join(', ') + (missing ? ` (${missing} more not offered here)` : '')}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-clinical-600 bg-clinical-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-clinical-300 hover:bg-clinical-25'}`}
                    >
                      {set.label} <span className={active ? 'text-clinical-100' : 'text-slate-500'}>· {items.length}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Diagnostic test type">
                {[['ALL', 'All diagnostics'], ['LAB', 'Laboratory'], ['SCAN', 'Imaging & X-ray']].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setTypeFilter(value)} aria-pressed={typeFilter === value} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${typeFilter === value ? 'border-clinical-600 bg-clinical-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-clinical-300 hover:bg-clinical-25'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <input className={inputClass} placeholder="Search tests, scans or X-rays" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search diagnostic tests, scans or X-rays" />
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2">
                {visible.length ? visible.map((item) => {
                  const done = orderedIds.has(item.id);
                  return (
                    <label key={item.id} className={`flex min-w-0 items-start gap-2 rounded-xl px-2 py-1.5 text-sm ${done ? 'opacity-50' : 'hover:bg-slate-50'}`}>
                      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-clinical-600" disabled={done} checked={done || staged.includes(item.id)} onChange={() => toggle(item.id)} />
                      <span className="min-w-0 flex-1 wrap-break-word">{item.name}</span>
                      <span className="max-w-[35%] shrink-0 wrap-break-word text-right text-xs text-slate-500">{done ? 'Ordered' : item.type === 'LAB' ? 'Laboratory' : item.modality || 'Imaging'}</span>
                    </label>
                  );
                }) : <p className="px-2 py-1.5 text-sm text-slate-500">No matching tests or scans.</p>}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">{staged.length ? `${staged.length} waiting to be sent` : 'Nothing waiting to be sent'}</p>
              {staged.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Tests waiting to be sent">
                  {staged.map((id) => (
                    <li key={id} className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-xs">
                      <span className="min-w-0 wrap-break-word">{byId.get(id)?.name || 'Test'}</span>
                      <button type="button" aria-label={`Remove ${byId.get(id)?.name || 'test'}`} onClick={() => toggle(id)} className="shrink-0 rounded-full p-0.5 text-slate-500 hover:bg-slate-100"><X className="h-3 w-3" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <FormField label="Urgency">
                  <select className={inputClass} value={urgency} onChange={(e) => updateDraft({ urgency: e.target.value })}>
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </FormField>
                <Button variant="secondary" disabled={busy || staged.length === 0} onClick={sendOrdersNow}><FlaskConical className="h-4 w-4" /> Send {staged.length || ''} now</Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Sending now keeps the patient in your consultation. &ldquo;Send to Diagnostics &amp; Suspend&rdquo; below sends the requests to laboratory or imaging staff and parks the visit until results are back.</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
