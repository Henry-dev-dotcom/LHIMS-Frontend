import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, CheckCheck, Mail, MessageSquareText, X } from 'lucide-react';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import { formatDateTime } from '../../utils/formatters';

export function NotificationDrawer({ open, notifications = [], onClose, onMarkDelivered, ignoreRef }) {
  const drawerRef = useRef(null);
  const [drawerPosition, setDrawerPosition] = useState({ top: 72, right: 20 });

  useEffect(() => {
    if (!open) return undefined;

    const syncDrawerPosition = () => {
      const triggerRect = ignoreRef?.current?.getBoundingClientRect();
      const viewportPadding = 12;
      if (!triggerRect) {
        setDrawerPosition({ top: 72, right: 20 });
        return;
      }
      setDrawerPosition({
        top: Math.min(triggerRect.bottom + 8, window.innerHeight - viewportPadding),
        right: Math.max(viewportPadding, window.innerWidth - triggerRect.right)
      });
    };

    syncDrawerPosition();
    window.addEventListener('resize', syncDrawerPosition);
    window.addEventListener('scroll', syncDrawerPosition, true);
    return () => {
      window.removeEventListener('resize', syncDrawerPosition);
      window.removeEventListener('scroll', syncDrawerPosition, true);
    };
  }, [open, ignoreRef]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handlePointerDown = (event) => {
      const target = event.target;
      const clickedDrawer = drawerRef.current && drawerRef.current.contains(target);
      const clickedIgnoredElement = ignoreRef?.current && ignoreRef.current.contains(target);
      if (!clickedDrawer && !clickedIgnoredElement) {
        onClose?.();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, ignoreRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] pointer-events-none print:hidden">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm md:hidden pointer-events-auto" onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="pointer-events-auto fixed inset-x-0 bottom-0 grid max-h-[calc(88dvh-env(safe-area-inset-bottom))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-[1.65rem] border border-slate-200 bg-white shadow-panel ring-1 ring-slate-950/5 md:inset-x-auto md:bottom-auto md:right-[var(--drawer-right)] md:top-[var(--drawer-top)] md:w-[calc(100vw-1.5rem)] md:max-w-[26rem] md:rounded-[1.75rem]"
        style={{ '--drawer-top': `${drawerPosition.top}px`, '--drawer-right': `${drawerPosition.right}px` }}
      >
        <div className="border-b border-slate-100 bg-gradient-to-br from-white to-clinical-50 px-4 pb-3 pt-2.5 md:px-5 md:py-4">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-200 md:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-950"><BellRing className="h-4 w-4 text-clinical-600" /> Delivery & role notifications</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">In-platform, email and SMS delivery events for this workspace.</p>
            </div>
            <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={onClose}>Close</Button>
            <Button variant="subtle" size="sm" className="h-9 w-9 shrink-0 p-0 md:hidden" onClick={onClose} aria-label="Close notifications">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {notifications.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">No notifications for this workspace.</div>
          ) : notifications.slice(0, 12).map((note) => (
            <div key={note.id} className="mb-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-clinical-50 text-clinical-700">
                    {String(note.channel || note.type || '').toLowerCase().includes('sms') ? <MessageSquareText className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-slate-900">{note.title || note.channel || 'Notification'}</p>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-500">{note.message || note.body || note.status || 'No details supplied.'}</p>
                  </div>
                </div>
                <div className="shrink-0"><StatusBadge status={note.status || (note.read ? 'Delivered' : 'Queued')} /></div>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>{formatDateTime(note.createdAt || note.timestamp)}</span>
                {onMarkDelivered && note.status !== 'Delivered' && (
                  <button onClick={() => onMarkDelivered(note.id)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 ring-1 ring-emerald-200 sm:min-h-0">
                    <CheckCheck className="h-3.5 w-3.5" /> mark delivered
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
