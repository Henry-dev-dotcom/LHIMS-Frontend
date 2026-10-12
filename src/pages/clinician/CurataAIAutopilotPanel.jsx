import { FileText, FlaskConical, Pill, Sparkles } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

const AREAS = [
  { title: 'Draft note', icon: FileText },
  { title: 'Suggested investigations', icon: FlaskConical },
  { title: 'Suggested prescriptions', icon: Pill }
];

/**
 * UI contract only. This component intentionally accepts no encounter or note data and
 * has no API/model client. It stays unavailable until the separately reviewed backend exists.
 */
export function CurataAIAutopilotPanel() {
  return (
    <Card title="CurataAI Predictive Autopilot" subtitle="Clinician review remains required for every future suggestion." actions={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Unavailable</span>}>
      <div role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-900">Waiting for an approved backend integration.</p>
        <p className="mt-1 text-slate-600">This panel does not receive patient notes, call an AI service, or display mock clinical recommendations.</p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3" aria-label="Autopilot feature areas">
        {AREAS.map(({ title, icon: Icon }) => (
          <section key={title} className="rounded-2xl border border-dashed border-slate-300 bg-white p-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />{title}</h4>
            <p className="mt-2 text-xs text-slate-500">Not connected</p>
          </section>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button disabled aria-label="Review and auto-fill (unavailable)"><Sparkles className="h-4 w-4" /> Review &amp; Auto-Fill</Button>
        <p className="text-xs text-slate-500">No note text or patient data is sent by this panel.</p>
      </div>
    </Card>
  );
}
