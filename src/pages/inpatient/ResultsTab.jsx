import { useCallback, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { InvestigationsTab } from '../clinician/InvestigationsTab';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';
import { inpatientService } from '../../services/inpatientService';
import { IP } from './wardUtils';
import { can } from '../opd/opdUtils';

/*
  Tab 4: orders and results.

  The same results list and order builder the clinic uses, applied to the stay. A doctor
  who has read the new results marks them reviewed, which clears the yellow dot on the board;
  a result that comes back later turns it on again.
*/

export function ResultsTab({ admission, encounter, auth, open, busy, act, toast, newResults, onChanged }) {
  const [draft, setDraft] = useState({ stagedTestIds: [], urgency: 'ROUTINE' });
  const [reviewing, setReviewing] = useState(false);

  const updateDraft = useCallback((patch) => setDraft((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), []);

  async function sendOrdersNow() {
    if (draft.stagedTestIds.length === 0) return true;
    const ok = await act(
      () => encounterService.order(apiClient, encounter.id, { items: draft.stagedTestIds.map((id) => ({ catalogItemId: id })), urgency: draft.urgency }),
      'Sent to the lab and imaging queues.'
    );
    if (ok) {
      updateDraft({ stagedTestIds: [] });
      onChanged?.();
    }
    return ok;
  }

  async function reviewed() {
    setReviewing(true);
    try {
      await inpatientService.resultsReviewed(apiClient, admission.id);
      toast('success', 'Results marked as reviewed.');
      onChanged?.();
    } catch (e) {
      toast('error', e?.message || 'That could not be saved.');
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="space-y-4">
      {open && can(auth, IP.REVIEW_RESULTS) && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">{newResults ? <><span className="font-bold text-amber-700">{newResults} new result{newResults === 1 ? '' : 's'}</span> since results were last reviewed.</> : 'No new results since you last reviewed.'}</p>
            <Button variant="secondary" disabled={reviewing || !newResults} onClick={reviewed}><CheckCircle2 className="h-4 w-4" /> Mark results reviewed</Button>
          </div>
        </Card>
      )}
      <InvestigationsTab encounter={encounter} auth={auth} open={open} busy={busy} draft={draft} updateDraft={updateDraft} sendOrdersNow={sendOrdersNow} />
    </div>
  );
}
