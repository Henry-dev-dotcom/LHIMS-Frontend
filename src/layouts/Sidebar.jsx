import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Activity, ChevronRight, X } from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import { getNavForRole, groupNavItems } from '../utils/permissions';
import { ROLES } from '../data/roles';
import { useFocusTrap } from '../hooks/useFocusTrap';

export function Sidebar() {
  const { state, dispatch } = useAppStore();
  const role = state.auth?.role || 'admin';
  const roleInfo = ROLES.find((item) => item.id === role);
  const closeButtonRef = useRef(null);
  const drawerRef = useRef(null);
  useFocusTrap(drawerRef, state.ui.sidebarOpen);
  const allItems = getNavForRole(role);
  const groups = groupNavItems(allItems);

  useEffect(() => {
    if (!state.ui.sidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') dispatch({ type: 'CLOSE_SIDEBAR' });
    };
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleViewportChange = (event) => {
      if (event.matches) dispatch({ type: 'CLOSE_SIDEBAR' });
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    window.setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 0);
    mediaQuery.addEventListener?.('change', handleViewportChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      mediaQuery.removeEventListener?.('change', handleViewportChange);
    };
  }, [dispatch, state.ui.sidebarOpen]);

  const content = (
    <>
      <div className="border-b border-slate-100 p-5 pr-14">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-clinical-500 text-white shadow-lift">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-bold tracking-tight text-slate-900">Diagnosis Center</div>
            <div className="truncate text-xs font-medium text-slate-500">Orders · Billing · Results</div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Active workspace</p>
        <p className="mt-0.5 truncate text-sm font-bold text-clinical-700">{roleInfo?.label}</p>
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {Object.entries(groups).length === 0 && <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">No matching menu items.</div>}
        {Object.entries(groups).map(([section, items]) => (
          <div key={section} className="mb-5">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{section}</p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active = state.currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      dispatch({ type: 'NAVIGATE', pageId: item.id });
                      dispatch({ type: 'CLOSE_SIDEBAR' });
                    }}
                    className={clsx(
                      'group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition duration-150',
                      active ? 'bg-clinical-50 font-semibold text-clinical-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-lg transition', active ? 'bg-clinical-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700')}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronRight className={clsx('h-4 w-4 shrink-0 transition', active ? 'text-clinical-500' : 'text-slate-300 group-hover:text-slate-400')} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-screen w-[19rem] flex-col border-r border-slate-200/80 bg-white print:hidden lg:flex">{content}</aside>
      <div
        className={clsx('fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-sm transition-opacity print:hidden lg:hidden', state.ui.sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0')}
        role="presentation"
        aria-hidden={!state.ui.sidebarOpen}
        onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
      >
        <aside
          ref={drawerRef}
          className={clsx(
            'flex h-full w-[19rem] max-w-[88vw] transform flex-col bg-white shadow-2xl transition-transform duration-200 ease-out',
            state.ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <button
            ref={closeButtonRef}
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-clinical-200"
            type="button"
            onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
          {content}
        </aside>
      </div>
    </>
  );
}
