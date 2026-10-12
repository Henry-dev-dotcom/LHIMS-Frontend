import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';

/** Status-only foundation: it never receives note text and never calls a model. */
export function CurataAINoteFormattingStatus({ encounterId }) {
  const [status, setStatus] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    encounterService.noteFormattingStatus(apiClient, encounterId)
      .then((result) => current && setStatus(result))
      .catch(() => current && setFailed(true));
    return () => { current = false; };
  }, [encounterId]);

  const explanation = failed
    ? 'Availability could not be checked. Note formatting stays unavailable; no AI service is called.'
    : status?.reason === 'PROVIDER_NOT_CONFIGURED'
      ? 'The feature is not available yet because no provider is configured. No AI service is called.'
      : 'This feature is turned off. Your note is not sent to an AI service.';

  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-slate-800">CurataAI note formatting · unavailable</p>
          <p className="mt-0.5 text-xs text-slate-600">{explanation}</p>
        </div>
      </div>
      <Button size="sm" variant="secondary" disabled aria-label="Format note with CurataAI (unavailable)">
        Format note
      </Button>
    </div>
  );
}
