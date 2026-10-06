import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessagesSquare, RefreshCw, Send } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { messageService } from '../../services/messageService';
import { formatDateTime } from '../../utils/formatters';

/*
  Talking to the other departments.

  One channel for the whole building and one for each department. Deliberately
  temporary: a message is gone after 24 hours, and the page says so on every
  message, because a conversation people think is permanent will be used for
  things that must be - and those belong on the patient's chart, where they can
  be found again.

  Messages are fetched here rather than loaded with the rest of the workspace.
  They expire, so caching them in the store would mean holding something that is
  already wrong; and a conversation has to arrive while it is still relevant, so
  the open channel is re-read every few seconds.
*/

const POLL_MS = 15_000;

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
      setActive((current) => current || list[0]?.key || '');
      setError('');
    } catch (caught) {
      setError(caught?.message || 'The channels could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (channel, { quiet = false } = {}) => {
    if (!channel) return;
    try {
      const result = await messageService.list(apiClient, channel);
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
    // Quietly, so a dropped poll on a bad connection does not fill the screen
    // with errors about a conversation that is still perfectly readable.
    const timer = window.setInterval(() => loadMessages(active, { quiet: true }), POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, loadMessages]);

  // New messages arrive at the bottom, which is where the eye already is.
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const activeChannel = useMemo(() => channels.find((channel) => channel.key === active) || null, [channels, active]);

  async function send(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await messageService.send(apiClient, { channel: active, body });
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
        description="Talk to the other departments. Messages are kept for 24 hours and then gone — anything that has to be kept belongs on the patient's record."
        actions={(
          <Button variant="secondary" onClick={() => { loadChannels(); loadMessages(active); }}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        )}
      />

      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
        <Card title="Channels" subtitle="Your department, and everyone." compact>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-1.5">
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
              {channels.length === 0 && <p className="text-sm text-slate-500">No channels are open to you.</p>}
            </div>
          )}
        </Card>

        <Card
          title={activeChannel?.name || 'Messages'}
          subtitle={activeChannel?.description}
        >
          <div className="flex h-[26rem] flex-col">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <MessagesSquare className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                    <p className="mt-2 font-bold text-slate-900">Nothing here yet.</p>
                    <p className="mt-1 text-sm text-slate-500">Say something — it stays for 24 hours.</p>
                  </div>
                </div>
              ) : messages.map((message) => {
                const mine = message.sender?.name === me;
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? 'bg-clinical-500 text-white' : 'bg-slate-100 text-slate-900'}`}>
                      <p className={`text-[11px] font-bold ${mine ? 'text-clinical-50' : 'text-slate-600'}`}>
                        {mine ? 'You' : message.sender?.name || 'Someone'}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                      <p className={`mt-1 text-[10px] font-semibold ${mine ? 'text-clinical-100' : 'text-slate-500'}`}>
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
                  // Enter sends, as it does everywhere else people type at each other.
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send(event);
                  }
                }}
                placeholder={activeChannel ? `Message ${activeChannel.name}…` : 'Choose a channel first'}
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
