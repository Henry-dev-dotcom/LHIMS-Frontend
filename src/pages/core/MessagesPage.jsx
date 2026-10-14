import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, MessagesSquare, RefreshCw, Send } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { messageService } from '../../services/messageService';
import { formatDateTime } from '../../utils/formatters';

/*
  Shared channels keep their existing role-aware access. Private department
  threads make it possible to contact another team without exposing unrelated
  departments' conversation history. All messages expire after 24 hours.
*/

const POLL_MS = 15_000;
const DEPARTMENT_PREFIX = 'DEPARTMENT:';

/** How long this message has left, in the words a person would use. */
function expiresIn(expiresAt) {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return 'expiring now';
  const minutes = Math.round(remaining / 60_000);
  if (minutes < 60) return `expires in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `expires in ${hours} h`;
}

export function MessagesPage() {
  const { state } = useAppStore();
  const [channels, setChannels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [ownDepartment, setOwnDepartment] = useState(null);
  const [active, setActive] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  const me = state.auth?.userName || '';

  const loadChannels = useCallback(async () => {
    try {
      const result = await messageService.channels(apiClient);
      const list = result?.channels || [];
      setChannels(list);
      setDepartments(result?.directDepartments || []);
      setOwnDepartment(result?.ownDepartment || null);
      setActive((current) => current || list[0]?.key || '');
      setError('');
    } catch (caught) {
      setError(caught?.message || 'The channels could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (selection, { quiet = false } = {}) => {
    if (!selection) return;
    try {
      const isDepartmentThread = selection.startsWith(DEPARTMENT_PREFIX);
      const result = isDepartmentThread
        ? await messageService.listDepartment(apiClient, selection.slice(DEPARTMENT_PREFIX.length))
        : await messageService.list(apiClient, selection);
      setMessages(result?.messages || []);
      if (!quiet) setError('');
    } catch (caught) {
      // A failed refresh must not wipe what is already on screen.
      if (!quiet) setError(caught?.message || 'The conversation could not be loaded.');
    }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  useEffect(() => {
    if (!active) return undefined;
    setMessages([]);
    loadMessages(active);
    const timer = window.setInterval(() => loadMessages(active, { quiet: true }), POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, loadMessages]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const activeChannel = useMemo(() => channels.find((channel) => channel.key === active) || null, [channels, active]);
  const activeDepartment = useMemo(() => {
    if (!active.startsWith(DEPARTMENT_PREFIX)) return null;
    const key = active.slice(DEPARTMENT_PREFIX.length);
    return departments.find((department) => department.key === key) || null;
  }, [active, departments]);
  const activeName = activeDepartment
    ? `Conversation with ${activeDepartment.name}`
    : activeChannel?.name || 'Messages';
  const activeDescription = activeDepartment
    ? `Private to ${ownDepartment?.name || 'your department'} and ${activeDepartment.name}. Messages expire after 24 hours.`
    : activeChannel?.description;

  async function send(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await messageService.send(apiClient, activeDepartment
        ? { recipientDepartment: activeDepartment.key, body }
        : { channel: active, body });
      setDraft('');
      setError('');
      await loadMessages(active);
      await loadChannels();
    } catch (caught) {
      setError(caught?.message || 'The message was not sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Messages"
        title="Department messages"
        description="Talk in shared channels or start a private conversation with another department. Messages are kept for 24 hours; anything that must be kept belongs on the patient's record."
        actions={(
          <Button variant="secondary" onClick={() => { loadChannels(); loadMessages(active); }}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        )}
      />

      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
        <Card title="Channels & departments" subtitle="Choose a shared space or contact another team." compact>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-3">
              <section className="space-y-1.5" aria-labelledby="shared-message-channels-heading">
                <h3 id="shared-message-channels-heading" className="px-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">Channels</h3>
                {channels.map((channel) => (
                  <button
                    key={channel.key}
                    type="button"
                    onClick={() => setActive(channel.key)}
                    aria-pressed={channel.key === active}
                    className={`block w-full rounded-2xl border p-3 text-left transition ${channel.key === active ? 'border-clinical-400 bg-clinical-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{channel.name}</span>
                      {channel.messageCount > 0 && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">{channel.messageCount}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{channel.description}</span>
                  </button>
                ))}
                {channels.length === 0 && <p className="px-2 text-sm text-slate-600">No shared channels are open to you.</p>}
              </section>

              <section className="space-y-1.5 border-t border-slate-200 pt-3" aria-labelledby="other-departments-heading">
                <h3 id="other-departments-heading" className="px-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">Message another department</h3>
                {departments.map((department) => {
                  const key = `${DEPARTMENT_PREFIX}${department.key}`;
                  const selected = active === key;
                  return (
                    <button
                      key={department.key}
                      type="button"
                      onClick={() => setActive(key)}
                      aria-pressed={selected}
                      className={`flex w-full items-start gap-2 rounded-2xl border p-3 text-left transition ${selected ? 'border-clinical-400 bg-clinical-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-clinical-700" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-bold text-slate-900">{department.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-600">{department.description}</span>
                      </span>
                    </button>
                  );
                })}
                {departments.length === 0 && <p className="px-2 text-sm text-slate-600">No other departments are available.</p>}
              </section>
            </div>
          )}
        </Card>

        <Card title={activeName} subtitle={activeDescription}>
          <div className="flex h-104 flex-col">
            <div
              className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
              role="log"
              aria-label={activeDepartment ? `${activeDepartment.name} conversation` : `${activeChannel?.name || 'Selected channel'} conversation`}
              aria-live="polite"
              aria-relevant="additions text"
              aria-atomic="false"
              tabIndex={0}
            >
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <MessagesSquare className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                    <p className="mt-2 font-bold text-slate-900">Nothing here yet.</p>
                    <p className="mt-1 text-sm text-slate-600">{activeDepartment ? `Start a private conversation with ${activeDepartment.name}.` : 'Say something — it stays for 24 hours.'}</p>
                  </div>
                </div>
              ) : messages.map((message) => {
                const mine = message.sender?.name === me;
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? 'bg-clinical-700 text-white' : 'bg-slate-100 text-slate-900'}`}>
                      <p className={`text-[11px] font-bold ${mine ? 'text-white' : 'text-slate-600'}`}>
                        {mine ? 'You' : message.sender?.name || 'Someone'}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                      <p className={`mt-1 text-[10px] font-semibold ${mine ? 'text-white' : 'text-slate-600'}`}>
                        {formatDateTime(message.createdAt)} · {expiresIn(message.expiresAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="mt-3 flex items-end gap-2 border-t border-slate-200 pt-3">
              <textarea
                className={`${inputClass} min-h-[44px] flex-1`}
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send(event);
                  }
                }}
                placeholder={activeDepartment ? `Message ${activeDepartment.name}…` : activeChannel ? `Message ${activeChannel.name}…` : 'Choose a channel or department first'}
                aria-label="Message"
                disabled={!active}
              />
              <Button type="submit" disabled={!active || sending || !draft.trim()}>
                <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send'}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
