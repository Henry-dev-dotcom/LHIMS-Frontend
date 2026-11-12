import { useCallback, useEffect, useMemo, useState } from 'react';
import { messageService } from '../services/messageService';
import { apiClient } from '../store/commands';

/*
  The bell: only what a person needs to act on.

  - New messages from other people (channels and department threads).
  - Released results and order updates (alerts for admins only).
  Delivery logs, payment receipts and the like live in their own screens and stay out.

  Clearing is per person and stored in this browser, so one user clearing a
  broadcast notification never hides it from a colleague.
*/
const POLL_MS = 30_000;
const MAX_DISMISSED = 500;
const OPEN_MESSAGE_KEY = 'lhims.messages.open';
export const OPEN_MESSAGE_EVENT = 'lhims:open-message';

const RELEVANT_TYPES = new Set(['RESULT_RELEASED', 'ORDER_UPDATE', 'SYSTEM_ALERT', 'DELTA_CHECK']);

const RESULT_PAGE = { doctor: 'doctor-results', receptionist: 'reception-results', lab: 'lab-results', scan: 'scan-results', admin: 'result-delivery', billing: 'result-delivery' };
const ORDER_PAGE = { doctor: 'doctor-active-orders', receptionist: 'incoming-orders', lab: 'lab-queue', scan: 'scan-queue', billing: 'invoices', admin: 'orders' };
const DELTA_PAGE = { lab: 'lab-delta-check', admin: 'lab-delta-check' };
const ALERT_PAGE = { lab: 'lab-analyzer-log', admin: 'admin-dashboard' };

const storeKey = (userId) => `lhims.notifications.dismissed.${userId || 'anon'}`;

function readDismissed(userId) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storeKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDismissed(userId, ids) {
  try {
    window.localStorage.setItem(storeKey(userId), JSON.stringify(ids.slice(-MAX_DISMISSED)));
  } catch { /* storage unavailable: clearing then lasts for this session only */ }
}

/** The page a notification leads to, for this role. */
export function targetFor(item, role) {
  if (item.kind === 'message') return 'messages';
  if (item.type === 'RESULT_RELEASED') return RESULT_PAGE[role] || null;
  if (item.type === 'ORDER_UPDATE') return ORDER_PAGE[role] || null;
  if (item.type === 'SYSTEM_ALERT') return ALERT_PAGE[role] || null;
  if (item.type === 'DELTA_CHECK') return DELTA_PAGE[role] || null;
  return null;
}

export function useNotificationCenter({ auth, notifications, dispatch, currentPage }) {
  const userId = auth?.userId || auth?.id || auth?.userName || '';
  const role = auth?.role;
  const [dismissed, setDismissed] = useState(() => new Set(readDismissed(userId)));
  const [messages, setMessages] = useState([]);

  useEffect(() => { setDismissed(new Set(readDismissed(userId))); }, [userId]);

  useEffect(() => {
    if (!auth) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await messageService.inbox(apiClient);
        const items = result?.data?.items || result?.items || [];
        if (!cancelled) setMessages(items);
      } catch { /* a missed poll must not disturb the page */ }
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [auth]);

  const items = useMemo(() => {
    const fromMessages = messages.map((message) => ({
      id: `msg:${message.id}`,
      kind: 'message',
      title: message.kind === 'direct' ? `Message from ${message.senderName}` : `${message.senderName} in ${String(message.channel).toLowerCase().replace(/_/g, ' ')}`,
      body: message.preview,
      createdAt: message.createdAt,
      openKey: message.kind === 'direct' && message.department ? `DEPARTMENT:${message.department}` : message.channel
    }));
    const fromSystem = (notifications || [])
      .filter((note) => RELEVANT_TYPES.has(note.type) && !note.read && (!['SYSTEM_ALERT', 'DELTA_CHECK'].includes(note.type) || role === 'admin' || role === 'lab'))
      .map((note) => ({ ...note, id: `sys:${note.id}`, rawId: note.id, kind: 'system' }));
    return [...fromMessages, ...fromSystem]
      .filter((item) => !dismissed.has(item.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [messages, notifications, dismissed, role]);

  const dismiss = useCallback((list) => {
    setDismissed((current) => {
      const next = new Set(current);
      list.forEach((item) => next.add(item.id));
      writeDismissed(userId, [...next]);
      return next;
    });
    // Only notifications addressed to this person are marked read for real.
    list.filter((item) => item.kind === 'system' && item.personal)
      .forEach((item) => dispatch({ type: 'MARK_NOTIFICATION_DELIVERED', notificationId: item.rawId }));
  }, [dispatch, userId]);

  const open = useCallback((item) => {
    dismiss([item]);
    const page = targetFor(item, role);
    if (item.kind === 'message') {
      try { window.sessionStorage.setItem(OPEN_MESSAGE_KEY, item.openKey); } catch { /* optional */ }
      window.dispatchEvent(new CustomEvent(OPEN_MESSAGE_EVENT, { detail: item.openKey }));
    }
    if (page) dispatch({ type: 'NAVIGATE', pageId: page });
  }, [dismiss, dispatch, role]);

  // Messages on screen are read: being in the Messages section clears their bell entries.
  useEffect(() => {
    if (currentPage !== 'messages') return;
    const visible = items.filter((item) => item.kind === 'message');
    if (visible.length) dismiss(visible);
  }, [currentPage, items, dismiss]);

  const clearAll = useCallback(() => dismiss(items), [dismiss, items]);

  return { items, unread: items.length, open, clearAll };
}

export function consumePendingMessage() {
  try {
    const key = window.sessionStorage.getItem(OPEN_MESSAGE_KEY);
    window.sessionStorage.removeItem(OPEN_MESSAGE_KEY);
    return key || '';
  } catch {
    return '';
  }
}
