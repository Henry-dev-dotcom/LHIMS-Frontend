import { FlaskConical, ScanLine } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

/*
  How a test and its result are shown to a clinician.

  A result's values appear only when the laboratory or imaging unit has signed it off
  (the server sends nothing before that), so anything shown here is final. Until then
  the test is just a line saying how far it has got.
*/

export const FLAG_STYLE = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-red-100 text-red-800',
  LOW: 'bg-amber-100 text-amber-900',
  NORMAL: 'bg-emerald-50 text-emerald-800',
  NO_RANGE: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-slate-100 text-slate-600'
};

const FLAG_LABEL = { CRITICAL: 'Critical', HIGH: 'High', LOW: 'Low', NORMAL: 'Normal', NO_RANGE: '', PENDING: '' };

export function testProgressLabel(test) {
  if (test.resultedAt) return 'Result ready';
  return { REQUESTED: 'Ordered', ACCEPTED: 'Received by the lab', DRAFT: 'Being processed', PENDING_REVIEW: 'Awaiting sign-off', REJECTED: 'Sample rejected', RETEST_REQUESTED: 'Retest requested' }[test.status] || 'In progress';
}

/** Parameters worth a glance first: anything outside its range. */
export function abnormalParameters(test) {
  return (test.lab?.parameters || []).filter((p) => ['CRITICAL', 'HIGH', 'LOW'].includes(p.flag));
}

function FlagChip({ flag }) {
  if (!FLAG_LABEL[flag]) return null;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${FLAG_STYLE[flag]}`}>{FLAG_LABEL[flag]}</span>;
}

/** A test's full result: a table of values for the laboratory, findings and impression for imaging. */
export function ResultDetail({ test }) {
  if (test.lab) {
    return (
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2">Test</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2"><span className="sr-only">Flag</span></th></tr>
          </thead>
          <tbody>
            {test.lab.parameters.map((p) => (
              <tr key={p.name} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                <td className="px-3 py-2 text-slate-900">{p.value ?? '—'} {p.unit || ''}</td>
                <td className="px-3 py-2 text-slate-500">{p.referenceRange || '—'}</td>
                <td className="px-3 py-2"><FlagChip flag={p.flag} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {test.lab.interpretation && <p className="border-t border-slate-100 px-3 py-2 text-sm text-slate-700"><span className="font-semibold">Interpretation:</span> {test.lab.interpretation}</p>}
      </div>
    );
  }
  if (test.scan) {
    return (
      <div className="mt-2 space-y-1 rounded-xl border border-slate-200 p-3 text-sm text-slate-800">
        {test.scan.findings && <p><span className="font-semibold">Findings:</span> {test.scan.findings}</p>}
        {test.scan.impression && <p><span className="font-semibold">Impression:</span> {test.scan.impression}</p>}
      </div>
    );
  }
  return null;
}

/** One line for a test, with its progress or its standout values. */
export function TestLine({ test, expanded = false }) {
  const Icon = test.kind === 'SCAN' ? ScanLine : FlaskConical;
  const abnormal = abnormalParameters(test);
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="font-semibold text-slate-900">{test.name}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${test.resultedAt ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{testProgressLabel(test)}</span>
        {test.resultedAt && <span className="text-xs text-slate-500">{formatDateTime(test.resultedAt)}</span>}
      </p>
      {!expanded && abnormal.length > 0 && (
        <p className="ml-6 mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-700">
          {abnormal.slice(0, 3).map((p) => <span key={p.name}>{p.name} <span className="font-semibold">{p.value} {p.unit || ''}</span> <FlagChip flag={p.flag} /></span>)}
        </p>
      )}
      {!expanded && test.scan?.impression && <p className="ml-6 mt-0.5 text-xs text-slate-700">{test.scan.impression.slice(0, 120)}{test.scan.impression.length > 120 ? '…' : ''}</p>}
      {expanded && <ResultDetail test={test} />}
    </div>
  );
}
