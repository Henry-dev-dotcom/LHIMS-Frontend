import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { onboardingService } from '../../services/onboardingService';
import { listItems } from '../../api/normalizers';
import { formatDateTime, money } from '../../utils/formatters';

const formatDate = (value) => (value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : '—');
const monthLabel = (key) => new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(`${key}-01T00:00:00Z`));
const DEMO_STATUS = { NEW: 'New', CONTACTED: 'Contacted', CLOSED: 'Closed' };

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function PlatformDashboardPage() {
  const { dispatch } = useAppStore();
  const [metrics, setMetrics] = useState(null);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [m, r] = await Promise.all([onboardingService.metrics(apiClient), onboardingService.demoRequests(apiClient)]);
      setMetrics(m);
      setRequests(listItems(r));
    } catch (e) {
      setError(e?.message || 'The dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setRequestStatus(row, status) {
    try {
      await onboardingService.updateDemoRequest(apiClient, row.id, { status });
      toast('success', `${row.organisation}: marked ${DEMO_STATUS[status].toLowerCase()}.`);
      await load();
    } catch (e) {
      toast('error', e?.message || 'The request could not be updated.');
    }
  }

  const maxRevenue = Math.max(1, ...(metrics?.revenueByMonth || []).map((m) => m.revenue));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Platform" title="Business overview" description="Recurring revenue, subscriptions, sign-ups and follow-ups across every facility. Amounts in GHS." />
      <div className="flex justify-end"><Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button></div>
      {error && <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      {metrics && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Monthly recurring revenue" value={money(metrics.mrr)} hint={`${money(metrics.arr)} a year`} />
            <Stat label="Paid in the last 30 days" value={money(metrics.revenue30)} />
            <Stat label="Paying subscriptions" value={(metrics.subscriptions.ACTIVE || 0) + (metrics.subscriptions.PAST_DUE || 0)} hint={`${metrics.subscriptions.TRIALING || 0} on trial · ${metrics.subscriptions.PAST_DUE || 0} overdue`} />
            <Stat label="Churn (30 days)" value={`${metrics.churn30.rate}%`} hint={`${metrics.churn30.cancelled} cancelled`} />
            <Stat label="Facilities" value={metrics.facilities.total} hint={`${metrics.facilities.active} active · ${metrics.facilities.platformManaged} managed directly`} />
            <Stat label="New in 30 days" value={metrics.facilities.new30} hint={`${metrics.facilities.selfService} signed up online in total`} />
            <Stat label="Read-only (unpaid or ended)" value={(metrics.subscriptions.SUSPENDED || 0) + (metrics.subscriptions.CANCELLED || 0)} />
            <Stat label="New demo requests" value={metrics.demoRequestsNew} />
          </div>

          <Card title="Subscription revenue by month" subtitle="Paid subscription invoices.">
            <div className="flex h-44 items-end gap-3" role="img" aria-label={metrics.revenueByMonth.map((m) => `${monthLabel(m.month)} ${money(m.revenue)}`).join(', ')}>
              {metrics.revenueByMonth.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-600">{m.revenue ? money(m.revenue) : ''}</span>
                  <div className="w-full rounded-t-xl bg-clinical-500" style={{ height: `${Math.max(2, (m.revenue / maxRevenue) * 120)}px` }} />
                  <span className="text-xs font-semibold text-slate-500">{monthLabel(m.month)}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Trials ending within a week" subtitle="A good moment to check in.">
              <DataTable
                caption="Trials ending"
                emptyMessage="No trials end this week."
                rows={metrics.trialsEnding.map((t) => ({ ...t, id: t.facility.id }))}
                columns={[
                  { key: 'facility', label: 'Facility', mobilePrimary: true, render: (r) => `${r.facility.name} (${r.facility.code})` },
                  { key: 'plan', label: 'Plan' },
                  { key: 'trialEndsAt', label: 'Ends', render: (r) => formatDate(r.trialEndsAt) }
                ]}
              />
            </Card>
            <Card title="Failed renewal payments" subtitle="Retried daily until the grace period ends.">
              <DataTable
                caption="Failed payments"
                emptyMessage="No failed payments."
                rows={metrics.failedPayments.map((f) => ({ ...f, id: f.invoiceNumber }))}
                columns={[
                  { key: 'facility', label: 'Facility', mobilePrimary: true, render: (r) => `${r.facility.name} (${r.facility.code})` },
                  { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
                  { key: 'attempts', label: 'Tries' },
                  { key: 'grace', label: 'Read-only from', render: (r) => (r.subscription.status === 'SUSPENDED' ? 'Now' : formatDate(r.subscription.graceEndsAt)) },
                  { key: 'lastError', label: 'Reason', render: (r) => r.lastError || '—' }
                ]}
              />
            </Card>
          </div>
        </>
      )}

      <Card title="Demo requests" subtitle="From the website's Request a demo form.">
        <DataTable
          caption="Demo requests"
          emptyMessage={loading ? 'Loading…' : 'No requests yet.'}
          rows={requests}
          columns={[
            { key: 'organisation', label: 'Organisation', mobilePrimary: true },
            { key: 'name', label: 'Contact', render: (r) => <span>{r.name}<br /><a className="text-clinical-700 underline" href={`mailto:${r.email}`}>{r.email}</a>{r.phone ? ` · ${r.phone}` : ''}</span> },
            { key: 'message', label: 'Message', render: (r) => r.message || '—' },
            { key: 'createdAt', label: 'Received', render: (r) => formatDateTime(r.createdAt) },
            { key: 'status', label: 'Status', render: (r) => DEMO_STATUS[r.status] },
            {
              key: 'actions', label: '', render: (r) => (
                <div className="flex flex-wrap gap-1.5">
                  {r.status !== 'CONTACTED' && <Button size="sm" variant="secondary" onClick={() => setRequestStatus(r, 'CONTACTED')}>Contacted</Button>}
                  {r.status !== 'CLOSED' && <Button size="sm" variant="ghost" onClick={() => setRequestStatus(r, 'CLOSED')}>Close</Button>}
                </div>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}
