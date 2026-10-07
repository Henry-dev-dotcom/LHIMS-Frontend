import { isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Bell, ChevronDown, Home, LogOut, Menu, Sparkles, UserRound } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { NotificationDrawer } from '../components/ui/NotificationDrawer';
import { MobileActionBar } from '../components/ui/MobileActionBar';
import { PAGE_HEADER_EVENT } from '../components/ui/PageHeader';
import { useAppStore } from '../store/AppStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { PAGE_META } from '../routes/routeRegistry';
import { ALL_ROLES } from '../data/roles';
import '../styles/getlabs-theme.css';

const dashboardMeta = {
  'doctor-dashboard': {
    eyebrow: 'Clinician Portal',
    title: 'Hospital-side clinician workspace',
    description: 'Places patient orders, follows active work, receives released results, and manages result notification preferences.'
  },
  'reception-dashboard': {
    eyebrow: 'Reception Desk',
    title: 'Incoming order and check-in command center',
    description: 'Confirms clinician orders, handles walk-ins, manages patient check-in, and routes work to billing, lab and scan units.'
  },
  'lab-dashboard': {
    eyebrow: 'Laboratory Unit',
    title: 'Lab processing dashboard',
    description: 'Tracks routed lab orders, sample collection, structured result entry, abnormal flags and review handoff.'
  },
  'scan-dashboard': {
    eyebrow: 'Scan / Imaging Unit',
    title: 'Imaging processing dashboard',
    description: 'Manages scan queues, room/equipment booking, uploads, reports and radiologist sign-off.'
  },
  'billing-dashboard': {
    eyebrow: 'Billing / Finance',
    title: 'Finance control dashboard',
    description: 'Generates invoices, tracks payment status, follows outstanding balances and prepares financial reports.'
  },
  'admin-dashboard': {
    eyebrow: 'Administration',
    title: 'System oversight dashboard',
    description: 'Manages users, hospitals, catalog configuration, department settings, audit logs and system reports.'
  }
};

function fallbackPageHeader(pageId, role) {
  const roleInfo = ALL_ROLES.find((item) => item.id === role);
  const meta = dashboardMeta[pageId] || PAGE_META[pageId];
  return {
    eyebrow: meta?.section || meta?.eyebrow || roleInfo?.label || 'Workspace',
    title: meta?.title || roleInfo?.label || 'CurataMed',
    description: meta?.description || '',
    actions: null
  };
}

export function Header() {
  const { state, dispatch } = useAppStore();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pageHeader, setPageHeader] = useState(() => fallbackPageHeader(state.currentPage, state.auth?.role));
  const notificationTriggerRef = useRef(null);
  const userMenuRef = useRef(null);
  const userDropdownRef = useRef(null);
  const screenGuideRef = useRef(null);
  const [userMenuPosition, setUserMenuPosition] = useState({ top: 0, right: 16 });
  const [screenGuideOpen, setScreenGuideOpen] = useState(false);
  const role = state.auth?.role;
  const roleInfo = ALL_ROLES.find((item) => item.id === role);
  const userInitial = (state.auth?.userName || roleInfo?.label || 'U').charAt(0);

  useEffect(() => {
    setPageHeader(fallbackPageHeader(state.currentPage, role));
    setScreenGuideOpen(false);
  }, [state.currentPage, role]);

  useEffect(() => {
    if (!screenGuideOpen) return undefined;

    const handlePointerDown = (event) => {
      if (screenGuideRef.current?.contains(event.target)) return;
      setScreenGuideOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setScreenGuideOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [screenGuideOpen]);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handlePointerDown = (event) => {
      if (userMenuRef.current?.contains(event.target) || userDropdownRef.current?.contains(event.target)) return;
      setUserMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  useFocusTrap(userDropdownRef, userMenuOpen);
  useEffect(() => {
    if (!userMenuOpen) return undefined;
    // Move focus into the menu on open so keyboard users land inside it.
    const timer = window.setTimeout(() => {
      const first = userDropdownRef.current?.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
      first?.focus?.({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return undefined;

    const syncUserMenuPosition = () => {
      const triggerRect = userMenuRef.current?.getBoundingClientRect();
      if (!triggerRect) return;
      const viewportPadding = 12;
      setUserMenuPosition({
        top: Math.min(triggerRect.bottom + 8, window.innerHeight - viewportPadding),
        right: Math.max(viewportPadding, window.innerWidth - triggerRect.right)
      });
    };

    syncUserMenuPosition();
    window.addEventListener('resize', syncUserMenuPosition);
    window.addEventListener('scroll', syncUserMenuPosition, true);
    return () => {
      window.removeEventListener('resize', syncUserMenuPosition);
      window.removeEventListener('scroll', syncUserMenuPosition, true);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    const handlePageHeader = (event) => {
      setPageHeader((current) => ({
        ...current,
        ...(event.detail || {})
      }));
    };
    window.addEventListener(PAGE_HEADER_EVENT, handlePageHeader);
    return () => window.removeEventListener(PAGE_HEADER_EVENT, handlePageHeader);
  }, []);

  const roleNotifications = useMemo(() => {
    return (state.data.notifications || []).filter((item) => {
      const audience = item.audience || item.role || item.channel;
      return !audience || audience === role || audience === 'all' || ['Email', 'SMS', 'In-Platform'].includes(audience);
    });
  }, [state.data.notifications, role]);
  const unread = roleNotifications.filter((item) => !item.read && item.status !== 'Delivered').length;

  return (
    <header className="relative z-[90] border-b border-white/60 bg-white/85 px-3 py-2 shadow-sm backdrop-blur-2xl sm:px-5 lg:px-8 print:hidden">
      <div className="lg:hidden">
        <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/95 px-3 py-2.5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-clinical-100 bg-clinical-50/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-clinical-800">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span className="truncate">{pageHeader?.eyebrow || roleInfo?.label || 'Workspace'}</span>
            </div>

            <div className="relative z-[95] flex shrink-0 items-center gap-1.5">
              <div ref={notificationTriggerRef} className="relative">
                <button
                  className="relative grid h-9 w-9 place-items-center rounded-2xl border border-slate-200/80 bg-white/95 text-slate-600 shadow-sm transition hover:border-clinical-200 hover:bg-clinical-50 hover:text-clinical-700 active:scale-95"
                  title="Role notifications"
                  type="button"
                  aria-label={unread > 0 ? `${unread} unread notifications` : 'Open notifications'}
                  aria-expanded={notificationsOpen}
                  onClick={() => setNotificationsOpen((value) => !value)}
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-white">{unread}</span>}
                </button>
                <NotificationDrawer
                  open={notificationsOpen}
                  notifications={roleNotifications}
                  onClose={() => setNotificationsOpen(false)}
                  onMarkDelivered={(notificationId) => dispatch({ type: 'MARK_NOTIFICATION_DELIVERED', notificationId })}
                  ignoreRef={notificationTriggerRef}
                />
              </div>

              <button
                className="grid h-9 w-9 place-items-center rounded-2xl border border-slate-200/80 bg-white/95 text-slate-600 shadow-sm transition hover:border-clinical-200 hover:bg-clinical-50 hover:text-clinical-700 active:scale-95"
                type="button"
                title="Home"
                aria-label="Go home"
                onClick={() => dispatch({ type: 'GO_HOME' })}
              >
                <Home className="h-4 w-4" />
              </button>

              <div ref={userMenuRef} className="relative">
                <button
                  className="grid h-9 w-9 place-items-center rounded-2xl border border-slate-200/80 bg-white/95 text-slate-700 shadow-sm transition hover:border-clinical-200 hover:bg-clinical-50 hover:text-clinical-800 active:scale-95"
                  title="User menu"
                  type="button"
                  aria-label="Open user menu"
                  aria-haspopup="dialog"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((value) => !value)}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-clinical-600 text-xs font-semibold text-white shadow-sm">{userInitial}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2.5 border-t border-slate-100 pt-2.5">
            <h1 className="line-clamp-1 text-[1.05rem] font-semibold leading-tight tracking-tight text-slate-900">{pageHeader?.title || 'CurataMed'}</h1>
            {pageHeader?.description && (
              isValidElement(pageHeader.description) ? (
                <div className="mt-2">{pageHeader.description}</div>
              ) : (
                <div ref={screenGuideRef} className="relative mt-1.5 inline-block text-xs font-semibold leading-5 text-slate-500">
                  <button
                    type="button"
                    className="inline-flex min-h-0 cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500 shadow-sm transition duration-200 hover:bg-clinical-50 hover:text-clinical-700 active:scale-[0.98]"
                    aria-label="Open screen guide"
                    aria-expanded={screenGuideOpen}
                    aria-controls="mobile-screen-guide-panel"
                    onClick={() => setScreenGuideOpen((value) => !value)}
                  >
                    Screen guide
                    <ChevronDown className={clsx('h-3 w-3 transition-transform duration-200', screenGuideOpen && 'rotate-180')} />
                  </button>
                  <div
                    id="mobile-screen-guide-panel"
                    role="status"
                    className={clsx(
                      'pointer-events-none absolute left-0 top-[calc(100%+0.45rem)] z-[140] w-[min(20rem,calc(100vw-2rem))] origin-top-left rounded-2xl border border-clinical-100 bg-white p-3 text-xs font-semibold leading-5 text-slate-600 opacity-0 shadow-lift ring-1 ring-slate-950/5 backdrop-blur-xl transition duration-200 ease-out',
                      screenGuideOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : '-translate-y-1 scale-[0.98] opacity-0'
                    )}
                  >
                    <p className="break-words">{pageHeader.description}</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
        {pageHeader?.actions && <div className="mt-2"><MobileActionBar>{pageHeader.actions}</MobileActionBar></div>}
      </div>

      <div className="hidden overflow-visible lg:block">
        <div className="relative flex min-h-[4.6rem] max-w-full items-start justify-between gap-4 overflow-visible rounded-[1.35rem] border border-slate-200/70 bg-white/95 px-6 py-2.5 shadow-card">
          <div className="min-w-0 flex-1 pr-2">
            {pageHeader?.eyebrow && (
              <p className="inline-flex items-center gap-1.5 rounded-full border border-clinical-100 bg-clinical-50/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-clinical-800">
                <Sparkles className="h-3 w-3" /> {pageHeader.eyebrow}
              </p>
            )}
            <div className="mt-1 min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{pageHeader?.title || 'CurataMed'}</h1>
              {pageHeader?.description && (
                isValidElement(pageHeader.description) ? (
                  <div className="mt-1.5 max-w-5xl">{pageHeader.description}</div>
                ) : (
                  <p className="mt-0.5 line-clamp-1 max-w-5xl text-sm leading-5 text-slate-500">{pageHeader.description}</p>
                )
              )}
            </div>
          </div>
          <div className="relative z-[95] flex shrink-0 flex-col items-end gap-2 pt-0.5">
            <div className="flex items-center gap-2">
            <div ref={notificationTriggerRef} className="relative">
              <button
                className="relative grid h-10 w-10 place-items-center rounded-2xl border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition hover:border-clinical-200 hover:bg-clinical-50 hover:text-clinical-700"
                title="Role notifications"
                type="button"
                aria-label={unread > 0 ? `${unread} unread notifications` : 'Open notifications'}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-white">{unread}</span>}
              </button>
              <NotificationDrawer
                open={notificationsOpen}
                notifications={roleNotifications}
                onClose={() => setNotificationsOpen(false)}
                onMarkDelivered={(notificationId) => dispatch({ type: 'MARK_NOTIFICATION_DELIVERED', notificationId })}
                ignoreRef={notificationTriggerRef}
              />
            </div>
            <Button variant="secondary" onClick={() => dispatch({ type: 'GO_HOME' })}>
              <Home className="h-4 w-4" /> <span>Home</span>
            </Button>
            <div ref={userMenuRef} className="relative">
              <button
                className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-3 text-slate-700 shadow-sm transition hover:border-clinical-200 hover:bg-clinical-50 hover:text-clinical-800"
                title="User menu"
                type="button"
                aria-label="Open user menu"
                aria-haspopup="dialog"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((value) => !value)}
              >
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-clinical-600 text-xs font-semibold text-white shadow-sm">{userInitial}</span>
                <span className="hidden min-w-0 text-left lg:block">
                  <span className="block max-w-[8rem] truncate text-xs font-semibold text-slate-900">{state.auth?.userName || 'User'}</span>
                  <span className="block max-w-[8rem] truncate text-[10px] font-bold capitalize text-slate-500">{state.auth?.username || role || 'workspace'}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>
          {pageHeader?.actions && <div className="flex w-full max-w-full flex-wrap justify-end gap-2 xl:max-w-[28rem]">{pageHeader.actions}</div>}
          </div>
        </div>
      </div>

      {userMenuOpen && typeof document !== 'undefined' && createPortal(
        <>
          <button
            type="button"
            className="getlabs-floating-overlay fixed inset-0 z-[129] bg-slate-950/40 backdrop-blur-sm md:hidden"
            aria-label="Close user menu"
            onClick={() => setUserMenuOpen(false)}
          />
          <div
          ref={userDropdownRef}
          className="getlabs-floating-panel fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[130] max-h-[calc(86dvh-env(safe-area-inset-bottom))] overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-lift ring-1 ring-slate-950/5 md:inset-x-auto md:bottom-auto md:right-[var(--user-menu-right)] md:top-[var(--user-menu-top)] md:w-[calc(100vw-1.5rem)] md:max-w-72 md:rounded-3xl"
          style={{ '--user-menu-top': `${userMenuPosition.top}px`, '--user-menu-right': `${userMenuPosition.right}px` }}
          role="dialog"
          aria-label="User session menu"
        >
          <div className="border-b border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-clinical-500 text-lg font-semibold text-white shadow-sm">{userInitial}</div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Signed in as</p>
                <p className="truncate text-base font-semibold text-slate-950">{state.auth?.userName || 'User'}</p>
                <p className="text-xs font-semibold capitalize text-slate-500">{state.auth?.username || role || 'workspace'}</p>
                {state.auth?.facility && <p className="truncate text-xs text-slate-500">{state.auth.facility.name}</p>}
              </div>
            </div>
          </div>
          <div className="max-h-[calc(86dvh-7rem-env(safe-area-inset-bottom))] space-y-2 overflow-y-auto overscroll-contain p-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-slate-800"><UserRound className="h-3.5 w-3.5" /> {roleInfo?.label || 'Workspace'}</div>
              <p className="mt-1 leading-5">Use this menu to view your session details or sign out securely.</p>
            </div>
            <div className="grid gap-2 md:hidden">
              <Button variant="secondary" size="sm" onClick={() => { setUserMenuOpen(false); dispatch({ type: 'GO_HOME' }); }}>
                <Home className="h-4 w-4" /> Home
              </Button>
            </div>
            <Button
              variant="danger"
              className="w-full"
              onClick={() => {
                setUserMenuOpen(false);
                dispatch({ type: 'LOGOUT' });
              }}
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
        </>,
        document.body
      )}
    </header>
  );
}
