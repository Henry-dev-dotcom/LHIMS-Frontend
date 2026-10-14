import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pill, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { apiClient } from '../../store/commands';
import { encounterService } from '../../services/encounterService';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';
import { DrugPicker } from '../opd/EncounterWorkspace';
import { P, can } from '../opd/opdUtils';
import { suggestionsFor } from './prescribingSuggestions';

/*
  Tab 3: prescriptions.

  Medicines wait here as lines the clinician can still change, and go to the pharmacy
  together when the prescription is issued - or automatically when the visit is
  completed. The suggestions above them come from the diagnoses recorded on this visit;
  they are shortcuts the clinician approves one at a time, never prescriptions made for
  them (see prescribingSuggestions.js for the rules).
*/

export const EMPTY_LINE = { drugId: '', drugName: '', strength: '', dosageForm: '', dose: '', route: 'Oral', frequency: '', durationDays: '', quantity: '', instructions: '' };

export const lineIsBlank = (l) => !l.drugName?.trim() && !l.dose?.trim() && !l.frequency?.trim();
export const lineIsComplete = (l) => l.drugName?.trim().length >= 2 && l.dose?.trim() && l.route?.trim() && l.frequency?.trim();

/** The line as the server wants it. */
export function toPrescriptionItem(l) {
  return {
    drugId: l.drugId || undefined,
    drugName: l.drugName.trim(),
    strength: l.strength?.trim() || undefined,
    dosageForm: l.dosageForm?.trim() || undefined,
    dose: l.dose.trim(),
    route: l.route.trim(),
    frequency: l.frequency.trim(),
    durationDays: l.durationDays ? Number(l.durationDays) : undefined,
    quantity: l.quantity ? Number(l.quantity) : undefined,
    instructions: l.instructions?.trim() || undefined
  };
}

export function PrescriptionsTab({ encounter, auth, open, busy, draft, updateDraft, issuePrescription }) {
  const canWrite = open && can(auth, P.PRESCRIBE);
  const lines = useMemo(() => draft.rxLines || [], [draft.rxLines]);
  const useFormulary = can(auth, 'pharmacy:formulary:read') && (auth?.modules || []).includes('pharmacy');
  const [found, setFound] = useState({});

  const diagnoses = (encounter.diagnoses || []).filter((d) => d.status !== 'RESOLVED');
  const issued = (encounter.prescriptions || []).flatMap((rx) => rx.items.map((i) => i.drugName));
  const suggestions = useMemo(
    () => suggestionsFor({ diagnoses, patient: encounter.patient, alreadyHave: [...issued, ...lines.map((l) => l.drugName).filter(Boolean)] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [encounter.diagnoses, encounter.patient, encounter.prescriptions, lines]
  );

  // Look each suggested medicine up in this facility's pharmacy list: only what it stocks is offered one-click.
  const wanted = suggestions.map((s) => s.search).join('|');
  useEffect(() => {
    if (!useFormulary || !canWrite) return;
    let live = true;
    suggestions.forEach((s) => {
      if (s.search in found) return;
      encounterService.formulary(apiClient, s.search)
        .then((data) => {
          const matches = listItems(data);
          const pick = matches.find((m) => m.onHand > 0 && (!s.strength || (m.strength || '').replace(/\s/g, '') === s.strength.replace(/\s/g, ''))) || matches.find((m) => m.onHand > 0) || matches[0] || null;
          if (live) setFound((prev) => ({ ...prev, [s.search]: pick }));
        })
        .catch(() => live && setFound((prev) => ({ ...prev, [s.search]: null })));
    });
    return () => {
      live = false;
    };
  }, [wanted, useFormulary, canWrite]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (index, patch) => updateDraft((prev) => ({ rxLines: (prev.rxLines || []).map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
  const addLine = (line = EMPTY_LINE) => updateDraft((prev) => ({ rxLines: [...(prev.rxLines || []), { ...line }] }));
  const removeLine = (index) => updateDraft((prev) => ({ rxLines: (prev.rxLines || []).filter((_, i) => i !== index) }));

  const approve = (s) => {
    const drug = found[s.search];
    addLine({
      ...EMPTY_LINE,
      drugId: drug?.id || '',
      drugName: drug?.genericName || s.name,
      strength: drug?.strength || s.strength || '',
      dosageForm: drug?.dosageForm || s.dosageForm || '',
      dose: s.dose,
      route: s.route,
      frequency: s.frequency,
      durationDays: s.durationDays ? String(s.durationDays) : '',
      instructions: s.instructions || ''
    });
  };

  const ready = lines.length > 0 && lines.every(lineIsComplete);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-4">
        {canWrite && suggestions.length > 0 && (
          <Card
            title="Suggested for this diagnosis"
            subtitle="Common first-line choices. Check the dose, allergies and interactions for this patient, then approve each one you want."
            actions={<Sparkles className="h-4 w-4 text-clinical-600" aria-hidden="true" />}
          >
            <ul className="space-y-3">
              {suggestions.map((s) => {
                const drug = found[s.search];
                const missing = useFormulary && s.search in found && !drug;
                const waitingForList = useFormulary && !(s.search in found);
                return (
                  <li key={s.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="wrap-break-word text-sm font-bold text-slate-900">{[drug?.genericName || s.name, drug?.strength || s.strength, drug?.dosageForm || s.dosageForm].filter(Boolean).join(' ')}</p>
                        <p className="wrap-break-word text-xs text-slate-600">For {s.reason.toLowerCase()} · {s.dose ? `${s.dose}, ` : ''}{s.route.toLowerCase()}, {s.frequency.toLowerCase()}{s.durationDays ? ` for ${s.durationDays} days` : ''}</p>
                        {s.note && <p className="mt-1 text-xs text-slate-500">{s.note}</p>}
                        {drug && <p className={`mt-1 text-xs font-semibold ${drug.onHand > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{drug.onHand > 0 ? `${drug.onHand} in stock` : 'Out of stock'}</p>}
                        {missing && <p className="mt-1 text-xs font-semibold text-slate-500">Not in your pharmacy list.</p>}
                        {s.allergy && (
                          <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Recorded allergy: {s.allergy.substance}{s.allergy.reaction ? ` (${s.allergy.reaction})` : ''}. Not offered for one-click approval.
                          </p>
                        )}
                      </div>
                      <Button size="sm" disabled={busy || missing || waitingForList || Boolean(s.allergy)} onClick={() => approve(s)} aria-label={`Approve and add ${s.name}`}>
                        <Plus className="h-4 w-4" /> Approve &amp; Add
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Card
          title="Prescription"
          subtitle={encounter.patient.allergies?.length ? `Check allergies: ${encounter.patient.allergies.map((a) => a.substance).join(', ')}.` : 'Medicines here go to the pharmacy when you issue the prescription or complete the visit.'}
        >
          {!canWrite ? (
            <p className="text-sm text-slate-500">{open ? 'Only prescribers can write prescriptions.' : 'This visit is closed, so nothing more can be prescribed.'}</p>
          ) : (
            <div className="space-y-3">
              {lines.length === 0 && <p className="text-sm text-slate-500">No medicines yet. Approve a suggestion or add one.</p>}
              {lines.map((line, index) => (
                <div key={index} className="grid gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-4" aria-label={`Medicine ${index + 1}`}>
                  <div className="sm:col-span-2">
                    {useFormulary ? (
                      <DrugPicker
                        line={line}
                        onText={(value) => setLine(index, { drugName: value, drugId: '' })}
                        onPick={(drug) => setLine(index, { drugId: drug.id, drugName: drug.genericName, strength: drug.strength || line.strength, dosageForm: drug.dosageForm || line.dosageForm })}
                      />
                    ) : (
                      <FormField label="Medicine" required><input className={inputClass} value={line.drugName} onChange={(e) => setLine(index, { drugName: e.target.value })} /></FormField>
                    )}
                  </div>
                  <FormField label="Strength"><input className={inputClass} value={line.strength} onChange={(e) => setLine(index, { strength: e.target.value })} placeholder="500 mg" /></FormField>
                  <FormField label="Form"><input className={inputClass} value={line.dosageForm} onChange={(e) => setLine(index, { dosageForm: e.target.value })} placeholder="Tablet" /></FormField>
                  <FormField label="Dose" required><input className={inputClass} value={line.dose} onChange={(e) => setLine(index, { dose: e.target.value })} placeholder="1 tablet" /></FormField>
                  <FormField label="Route" required><input className={inputClass} value={line.route} onChange={(e) => setLine(index, { route: e.target.value })} /></FormField>
                  <FormField label="Frequency" required><input className={inputClass} value={line.frequency} onChange={(e) => setLine(index, { frequency: e.target.value })} placeholder="Twice daily" /></FormField>
                  <FormField label="Days"><input type="number" min="1" className={inputClass} value={line.durationDays} onChange={(e) => setLine(index, { durationDays: e.target.value })} /></FormField>
                  <FormField label="Quantity"><input type="number" min="1" className={inputClass} value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} /></FormField>
                  <FormField label="Instructions" className="sm:col-span-2"><input className={inputClass} value={line.instructions} onChange={(e) => setLine(index, { instructions: e.target.value })} placeholder="After meals" /></FormField>
                  <div className="flex items-end"><Button size="sm" variant="ghost" onClick={() => removeLine(index)}><Trash2 className="h-3.5 w-3.5" /> Remove</Button></div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => addLine()}><Plus className="h-4 w-4" /> {lines.length ? 'Another medicine' : 'Add a medicine'}</Button>
                <Button variant="secondary" disabled={busy || !ready} onClick={issuePrescription}><Pill className="h-4 w-4" /> Send to pharmacy</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Prescribed on this visit">
        <ul className="space-y-2 text-sm">
          {encounter.prescriptions?.length ? encounter.prescriptions.map((rx) => (
            <li key={rx.id} className="rounded-2xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">{rx.prescriptionCode} · {rx.prescriber?.name || ''} · {formatDateTime(rx.createdAt)}</p>
              <ul className="mt-1 list-disc pl-5 text-slate-800">
                {rx.items.map((item) => (
                  <li key={item.id}>{[item.drugName, item.strength, item.dosageForm].filter(Boolean).join(' ')} — {item.dose} {item.route}, {item.frequency}{item.durationDays ? ` for ${item.durationDays} days` : ''}{item.quantity ? ` (qty ${item.quantity})` : ''}{item.instructions ? `; ${item.instructions}` : ''}</li>
                ))}
              </ul>
            </li>
          )) : <li className="text-slate-500">Nothing prescribed yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
