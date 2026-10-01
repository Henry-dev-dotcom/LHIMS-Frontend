import { useMemo, useState } from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';

const defaultSettings = {
  emailProvider: 'SMTP Provider',
  smsProvider: 'SMS Gateway',
  retryAttempts: 3,
  emailTemplate: 'Result {{orderId}} is ready. Log in to view the finalized report.',
  smsTemplate: 'Your result is ready. Please log in, or contact the hospital, to view it.'
};

export function NotificationSettingsPage() {
  const { state, dispatch } = useAppStore();
  const notifications = state.data.notifications || [];
  const [form, setForm] = useState({ ...defaultSettings, ...(state.data.notificationSettings || {}) });
  const channels = useMemo(() => ({
    email: notifications.filter((note) => /email/i.test(note.channel)).length,
    sms: notifications.filter((note) => /sms/i.test(note.channel)).length,
    inPlatform: notifications.filter((note) => /platform/i.test(note.channel)).length
  }), [notifications]);

  const save = (event) => {
    event.preventDefault();
    dispatch({ type: 'ADMIN_UPDATE_NOTIFICATION_SETTINGS', payload: form });
  };

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Notification settings" description="Configure email/SMS providers, result-release templates and delivery logs." />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Delivery Events" value={notifications.length} icon={Bell} tone="blue" />
        <MetricCard label="Email" value={channels.email} icon={Mail} tone="green" />
        <MetricCard label="SMS" value={channels.sms} icon={MessageSquare} tone="purple" />
        <MetricCard label="In-Platform" value={channels.inPlatform} icon={Bell} tone="yellow" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card title="Provider configuration" subtitle="Configure delivery providers and message templates.">
          <form onSubmit={save} className="space-y-4">
            <FormField label="Email provider"><input className={inputClass} value={form.emailProvider} onChange={(event) => setForm({ ...form, emailProvider: event.target.value })} /></FormField>
            <FormField label="SMS provider"><input className={inputClass} value={form.smsProvider} onChange={(event) => setForm({ ...form, smsProvider: event.target.value })} /></FormField>
            <FormField label="Retry attempts"><input type="number" min="0" className={inputClass} value={form.retryAttempts} onChange={(event) => setForm({ ...form, retryAttempts: Number(event.target.value) })} /></FormField>
            <FormField label="Email result template"><textarea className={`${inputClass} min-h-28`} value={form.emailTemplate} onChange={(event) => setForm({ ...form, emailTemplate: event.target.value })} /></FormField>
            <FormField label="SMS result template" help="SMS must not include patient-identifying clinical data."><textarea className={`${inputClass} min-h-24`} value={form.smsTemplate} onChange={(event) => setForm({ ...form, smsTemplate: event.target.value })} /></FormField>
            <Button type="submit">Save notification settings</Button>
          </form>
        </Card>
        <Card title="Delivery log" subtitle="Email/SMS delivery attempts and failures remain visible to Admin.">
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'title', label: 'Title' },
              { key: 'audience', label: 'Audience' },
              { key: 'channel', label: 'Channel', render: (row) => <StatusBadge status={row.channel} /> },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) }
            ]}
            rows={notifications}
          />
        </Card>
      </div>
    </div>
  );
}
