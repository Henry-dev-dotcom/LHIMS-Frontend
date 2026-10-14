import { lazy, Suspense, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { PageSkeleton } from '../../components/ui/LoadingSkeleton';
import { useAppStore } from '../../store/AppStore';
import { availableClinics } from './clinicHub';

/*
  Every clinic on one page.

  Nine clinic screens used to be nine menu items. Here the clinics this facility runs sit in a row
  of choices, and the chosen clinic's own screen opens underneath, unchanged. The choice is
  remembered, so a doctor who runs the antenatal clinic every morning lands straight on it.
*/

const ClinicQueuePage = lazy(() => import('../opd/OpdQueuePage').then((m) => ({ default: m.ClinicQueuePage })));
const MaternityRegisterPage = lazy(() => import('../maternity/MaternityRegisterPage').then((m) => ({ default: m.MaternityRegisterPage })));
const ImmunizationDueListPage = lazy(() => import('../childHealth/ImmunizationDueListPage').then((m) => ({ default: m.ImmunizationDueListPage })));

// Each clinic opens its own existing screen, unchanged.
const SCREENS = {
  'clinic-antenatal': () => <ClinicQueuePage clinic="ANTENATAL" />,
  'clinic-postnatal': () => <ClinicQueuePage clinic="POSTNATAL" />,
  'maternity-register': () => <MaternityRegisterPage />,
  'clinic-child-welfare': () => <ClinicQueuePage clinic="CHILD_WELFARE" />,
  'immunisation-due': () => <ImmunizationDueListPage />,
  'clinic-dental': () => <ClinicQueuePage clinic="DENTAL" />,
  'clinic-eye': () => <ClinicQueuePage clinic="EYE" />,
  'clinic-physiotherapy': () => <ClinicQueuePage clinic="PHYSIOTHERAPY" />,
  'clinic-dietetics': () => <ClinicQueuePage clinic="DIETETICS" />
};

const CHOICE_KEY = 'curatamed-clinic-choice';

function readChoice() {
  try {
    return window.localStorage.getItem(CHOICE_KEY) || '';
  } catch {
    return '';
  }
}

function writeChoice(id) {
  try {
    window.localStorage.setItem(CHOICE_KEY, id);
  } catch {
    // Remembering the clinic is a convenience; the page works without it.
  }
}

export function ClinicsHubPage() {
  const { state } = useAppStore();
  const groups = availableClinics(state.auth);
  const all = groups.flatMap((group) => group.items);
  const [choice, setChoice] = useState(() => readChoice());
  const selected = all.find((item) => item.id === choice) || all[0];

  if (all.length === 0) {
    return <Card title="Clinics"><p className="text-sm text-slate-600">This facility has no clinics switched on.</p></Card>;
  }

  const pick = (id) => {
    setChoice(id);
    writeChoice(id);
  };

  return (
    <div className="space-y-4">
      {all.length > 1 && (
        <nav aria-label="Choose a clinic" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {groups.map((group) => (
              <div key={group.label} className="min-w-0">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => {
                    const active = item.id === selected.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => pick(item.id)}
                        className={`min-h-9 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${active ? 'border-clinical-600 bg-clinical-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-clinical-300 hover:bg-clinical-25'}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>
      )}
      <section aria-label={`${selected.label} clinic`} key={selected.id}>
        <Suspense fallback={<PageSkeleton />}>{SCREENS[selected.id]()}</Suspense>
      </section>
    </div>
  );
}
