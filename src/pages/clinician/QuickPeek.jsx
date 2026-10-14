import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';
import { formatDateTime } from '../../utils/formatters';
import { TestLine } from './ResultView';

/*
  Quick-peek history.

  A narrow panel down the side of the workspace showing the patient's last three
  visits - what was diagnosed, what was prescribed and what the tests found - so a
  clinician can glance back without leaving, or losing their place in, the visit
  they are in the middle of. It never shows the current visit (that is the workspace
  itself) and it only reads.
*/

const LATEST = 3;

export function QuickPeek({ patientId, currentEncounterId, onClose }) {
  const [visits, setVisits] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    encounterService.clinicalHistory(apiClient, patientId, LATEST + 1)
      .then((data) => {
        if (live) setVisits((data.encounters || []).filter((e) => e.id !== currentEncounterId).slice(0, LATEST));
      })
      .catch((e) => live && setError(e?.message || 'History could not be loaded.'));
    return () => {
      live = false;
    };
  }, [patientId, currentEncounterId]);

  return (
    <aside aria-label="Quick-peek history" className="flex min-w-0 w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-xs lg:w-80 lg:shrink-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><History className="h-4 w-4 text-clinical-600" aria-hidden="true" /> Last {LATEST} visits</h3>
        <button type="button" onClick={onClose} aria-label="Close history" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-w-0 max-h-[70vh] space-y-4 overflow-y-auto p-4 wrap-anywhere">
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
        {!error && visits === null && <p className="text-sm text-slate-500">Loading history…</p>}
        {visits?.length === 0 && <p className="text-sm text-slate-500">No earlier visits on record.</p>}
        {visits?.map((visit) => (
          <section key={visit.id} className="space-y-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{formatDateTime(visit.startedAt)} · {visit.encounterCode}</p>
            {visit.chiefComplaint && <p className="text-sm text-slate-800"><span className="font-semibold">Complaint:</span> {visit.chiefComplaint}</p>}
            {visit.diagnoses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {visit.diagnoses.map((d) => <span key={d.id} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">{d.code ? `${d.code} ` : ''}{d.description}</span>)}
              </div>
            )}
            {visit.prescriptions.flatMap((rx) => rx.items).length > 0 && (
              <p className="text-xs text-slate-600"><span className="font-semibold">Prescribed:</span> {visit.prescriptions.flatMap((rx) => rx.items).map((i) => i.drugName).join(', ')}</p>
            )}
            {visit.tests.length > 0 && <div className="space-y-1.5">{visit.tests.map((test) => <TestLine key={test.id} test={test} />)}</div>}
            {visit.outcome && <p className="text-xs text-slate-500">Outcome: {visit.outcome.toLowerCase().replace(/_/g, ' ')}</p>}
          </section>
        ))}
      </div>
    </aside>
  );
}
