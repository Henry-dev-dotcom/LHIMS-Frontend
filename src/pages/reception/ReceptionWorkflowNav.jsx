import clsx from 'clsx';
import { CalendarDays, ClipboardCheck, ClipboardList, LayoutDashboard, Send, UserPlus, UsersRound } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';

const receptionTabs = [
  { id: 'reception-dashboard', label: 'Overview', helper: 'Reception summary', icon: LayoutDashboard, tone: 'blue' },
  { id: 'incoming-orders', label: 'Orders', helper: 'Confirm requests', icon: ClipboardList, tone: 'amber' },
  { id: 'patient-checkin', label: 'Check-In', helper: 'Verify arrivals', icon: ClipboardCheck, tone: 'emerald' },
  { id: 'reception-walkins', label: 'Walk-Ins', helper: 'Register new visits', icon: UserPlus, tone: 'purple' },
  { id: 'appointments', label: 'Appointments', helper: 'Schedule slots', icon: CalendarDays, tone: 'sky' },
  { id: 'daily-visits', label: 'Daily Visits', helper: 'Shift register', icon: UsersRound, tone: 'slate' },
  { id: 'reception-results', label: 'Results', helper: 'Print and notify', icon: Send, tone: 'rose' }
];

const toneClasses = {
  blue: 'text-clinical-700 bg-clinical-50 ring-clinical-100',
  amber: 'text-amber-700 bg-amber-50 ring-amber-100',
  emerald: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
  purple: 'text-purple-700 bg-purple-50 ring-purple-100',
  sky: 'text-sky-700 bg-sky-50 ring-sky-100',
  slate: 'text-slate-700 bg-slate-100 ring-slate-200',
  rose: 'text-rose-700 bg-rose-50 ring-rose-100'
};

function tabCount(id, data) {
  if (id === 'incoming-orders') return (data.orders || []).filter((order) => ['Submitted', 'Confirmed'].includes(order.status)).length;
  if (id === 'patient-checkin') return (data.dailyVisits || []).filter((visit) => visit.status === 'Checked In').length;
  if (id === 'reception-walkins') return (data.dailyVisits || []).filter((visit) => visit.status === 'Walk-in Registered' || !visit.orderId).length;
  if (id === 'appointments') return (data.appointments || []).filter((appointment) => appointment.status === 'Scheduled').length;
  if (id === 'daily-visits') return (data.dailyVisits || []).length;
  if (id === 'reception-results') return (data.orders || []).filter((order) => order.status === 'Final / Released').length;
  return (data.orders || []).filter((order) => order.status === 'Submitted').length;
}

export function ReceptionWorkflowNav() {
  const { state, dispatch } = useAppStore();
  const current = state.currentPage;
  const data = state.data || {};

  return (
    <section className="rounded-[1.15rem] border border-white/80 bg-white/92 p-2.5 shadow-soft backdrop-blur-xl sm:rounded-[1.4rem]">
      <div className="mb-2 flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Reception workflow</p>
          <p className="text-xs font-semibold text-slate-500">Move between focused reception pages without crowding one screen.</p>
        </div>
      </div>
      <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-7">
        {receptionTabs.map((tab) => {
          const Icon = tab.icon;
          const active = current === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => dispatch({ type: 'NAVIGATE', pageId: tab.id })}
              className={clsx(
                'group flex min-h-[4rem] min-w-[10.25rem] snap-start items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition duration-200 sm:min-w-0',
                active
                  ? 'border-clinical-200 bg-clinical-50/90 shadow-sm ring-2 ring-clinical-100'
                  : 'border-slate-200/80 bg-white/80 hover:border-clinical-200 hover:bg-slate-50'
              )}
            >
              <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1', toneClasses[tab.tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-900">{tab.label}</span>
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">{tabCount(tab.id, data)}</span>
                </span>
                <span className="mt-0.5 hidden truncate text-[11px] font-semibold text-slate-500 sm:block">{tab.helper}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
