import clsx from 'clsx';
import { Bell, CalendarDays, CheckCircle2, ClipboardList, CreditCard, FlaskConical, Home, LineChart, Menu, ScanLine, Search, Settings, ShieldCheck, UsersRound } from 'lucide-react';
import { useAppStore } from '../../store/AppStore';
import { canAccessPage } from '../../utils/permissions';

const ROLE_QUICK_LINKS = {
  doctor: [
    { id: 'doctor-new-order', label: 'Order', icon: ClipboardList },
    { id: 'doctor-active-orders', label: 'Active', icon: CheckCircle2 },
    { id: 'doctor-results', label: 'Results', icon: ShieldCheck },
    { id: 'doctor-patient-trends', label: 'Trends', icon: LineChart }
  ],
  receptionist: [
    { id: 'incoming-orders', label: 'Orders', icon: ClipboardList },
    { id: 'patient-checkin', label: 'Check-in', icon: UsersRound },
    { id: 'appointments', label: 'Visits', icon: CalendarDays },
    { id: 'reception-results', label: 'Results', icon: Bell }
  ],
  lab: [
    { id: 'lab-queue', label: 'Queue', icon: FlaskConical },
    { id: 'accepted-samples', label: 'Samples', icon: CheckCircle2 },
    { id: 'lab-review', label: 'Review', icon: ShieldCheck },
    { id: 'lab-rejections', label: 'Retest', icon: ClipboardList }
  ],
  scan: [
    { id: 'scan-queue', label: 'Queue', icon: ScanLine },
    { id: 'accepted-scans', label: 'Accepted', icon: CheckCircle2 },
    { id: 'scan-review', label: 'Review', icon: ShieldCheck },
    { id: 'equipment-booking', label: 'Booking', icon: CalendarDays }
  ],
  billing: [
    { id: 'invoices', label: 'Invoices', icon: CreditCard },
    { id: 'finance-shift', label: 'Shift', icon: CheckCircle2 },
    { id: 'float-tracker', label: 'Float', icon: CreditCard },
    { id: 'billing-analytics', label: 'Stats', icon: LineChart }
  ],
  admin: [
    { id: 'users', label: 'Users', icon: UsersRound },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'reports', label: 'Reports', icon: LineChart },
    { id: 'audit-log', label: 'Audit', icon: ShieldCheck }
  ]
};

export function MobileBottomNav() {
  const { state, dispatch } = useAppStore();
  const role = state.auth?.role;
  if (!state.auth || state.currentPage === 'login') return null;

  const landing = state.auth?.landing || 'overview';
  const roleLinks = (ROLE_QUICK_LINKS[role] || []).filter((item) => item.id !== landing && canAccessPage(role, item.id));
  const links = [
    { id: landing, label: 'Home', icon: Home },
    ...roleLinks.slice(0, 3),
    { id: '__menu__', label: 'Menu', icon: Menu }
  ];
  const activeIndex = links.findIndex((item) => (item.id === '__menu__' ? state.ui.sidebarOpen : state.currentPage === item.id));

  return (
    <nav className="mobile-bottom-nav fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 rounded-[1.5rem] border border-white/70 bg-white/95 p-1.5 shadow-panel backdrop-blur-xl sm:inset-x-3 lg:hidden print:hidden" aria-label="Mobile quick navigation">
      <div className="relative grid grid-cols-5 gap-0 overflow-hidden rounded-[1.15rem]">
        {activeIndex >= 0 && (
          <span
            className="mobile-bottom-nav-pill pointer-events-none absolute inset-y-0 z-0 rounded-2xl bg-clinical-500 shadow-sm"
            aria-hidden="true"
            style={{ width: '20%', transform: `translateX(${activeIndex * 100}%)` }}
          />
        )}
        {links.map((item) => {
          const Icon = item.icon || Search;
          const active = item.id === '__menu__' ? state.ui.sidebarOpen : state.currentPage === item.id;
          const handleClick = () => {
            if (item.id === '__menu__') dispatch({ type: 'TOGGLE_SIDEBAR' });
            else dispatch({ type: 'NAVIGATE', pageId: item.id });
          };
          return (
            <button
              key={item.id}
              type="button"
              onClick={handleClick}
              aria-current={active ? 'page' : undefined}
              aria-label={item.id === '__menu__' ? 'Open full navigation menu' : `Go to ${item.label}`}
              className={clsx(
                'relative z-10 flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-2xl px-1 text-[10px] font-semibold transition duration-200 active:scale-95',
                active ? 'bg-clinical-600/0 text-white shadow-sm' : 'text-slate-500 hover:bg-clinical-50 hover:text-clinical-700'
              )}
            >
              <Icon className={clsx('mb-0.5 h-4 w-4 shrink-0 transition-transform duration-200', active && 'scale-110')} />
              <span className="max-w-full truncate leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
