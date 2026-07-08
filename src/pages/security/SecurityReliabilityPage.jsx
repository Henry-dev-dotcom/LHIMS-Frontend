import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, Eye, LockKeyhole, RefreshCw, ShieldCheck, ShieldQuestion, Smartphone, WifiOff } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { buildAccessMatrix, exportSecurityDataset, getAuditCoverage, getReliabilityChecks, getSecuritySummary, scanSmsPrivacy } from '../../utils/securityMetrics';
import { formatDateTime } from '../../utils/formatters';
import { exportJson } from '../../utils/reportMetrics';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'access', label: 'Access Control' },
  { id: 'audit', label: 'Audit Coverage' },
  { id: 'privacy', label: 'SMS Privacy' },
  { id: 'reliability', label: 'Reliability' },
  { id: 'backup', label: 'Backup / Export' }
];

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${active ? 'bg-slate-950 text-white shadow-soft' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  );
}

function statusTone(status) {
  if (['Healthy', 'Safe', 'Covered', 'Allowed', 'Enabled'].includes(status)) return 'green';
  if (['Attention', 'Needs Review', 'Blocked', 'No Events Yet'].includes(status)) return 'yellow';
  return 'blue';
}

export function SecurityReliabilityPage() {
  const { state, dispatch } = useAppStore();
  const { data } = state;
  const [activeTab, setActiveTab] = useState('overview');

  const summary = useMemo(() => getSecuritySummary(data), [data]);
  const accessMatrix = useMemo(() => buildAccessMatrix(), []);
  const auditCoverage = useMemo(() => getAuditCoverage(data), [data]);
  const smsPrivacy = useMemo(() => scanSmsPrivacy(data), [data]);
  const reliabilityChecks = useMemo(() => getReliabilityChecks(data), [data]);
  const securityEvents = data.securityEvents || [];
  const failedNotifications = (data.notifications || []).filter((item) => ['Failed', 'Error'].includes(item.status) || Number(item.retryCount || 0) > 0 || item.status === 'Queued');

  const exportSecurity = () => {
    exportJson(`security-reliability-${new Date().toISOString().slice(0, 10)}.json`, exportSecurityDataset(data));
    dispatch({ type: 'SECURITY_EXPORT_RECORDED', scope: 'Security / Reliability dataset' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security & Reliability"
        title="Security, Audit & Reliability Layer"
        description="System controls and monitoring for role-based access, PHI-safe messaging, audit coverage, delivery failures, data integrity and backup/export readiness."
        actions={<Button onClick={exportSecurity}><Download className="h-4 w-4" /> Export security dataset</Button>}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Access denied events" value={summary.deniedAccessCount} icon={LockKeyhole} tone={summary.deniedAccessCount ? 'yellow' : 'green'} helper="Captured from protected route fallback" />
        <MetricCard label="Audit coverage" value={`${summary.auditCoveredModules}/${summary.auditTotalModules}`} icon={Eye} tone="blue" helper="Modules with recorded events" />
        <MetricCard label="SMS privacy review" value={summary.privacyReview} icon={Smartphone} tone={summary.privacyReview ? 'red' : 'green'} helper={`${summary.privacySafe} SMS alerts pass scan`} />
        <MetricCard label="Reliability attention" value={summary.reliabilityAttention} icon={WifiOff} tone={summary.reliabilityAttention ? 'yellow' : 'green'} helper={`${summary.reliabilityHealthy} checks healthy`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</TabButton>)}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card title="Security posture checklist" subtitle="Review role access, audit coverage, PHI-safe messaging, reliability checks and exports.">
            <div className="grid gap-3">
              {[
                ['Role-based access control', 'Enabled', 'Each role only sees allowed navigation and blocked routes show a protected fallback.'],
                ['Audit trail', 'Enabled', 'Create/edit/approve/delivery/security actions record actor, role, module, entity and timestamp.'],
                ['PHI-safe SMS', 'Enabled', 'SMS alerts are scanned to avoid patient names, clinical result terms and test names.'],
                ['Delivery retry visibility', 'Enabled', 'Queued, failed and retried email/SMS events are visible to Admin/Billing.'],
                ['Data integrity monitor', 'Enabled', 'Orders are checked for patient, invoice, result, report and delivery link consistency.']
              ].map(([name, status, detail]) => (
                <div key={name} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="font-bold text-slate-900">{name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
                  </div>
                  <StatusBadge status={status} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Recent security events" subtitle="Access-denied attempts and security exports are recorded here.">
            <DataTable
              columns={[
                { key: 'type', label: 'Type' },
                { key: 'actor', label: 'Actor' },
                { key: 'role', label: 'Role' },
                { key: 'target', label: 'Target' },
                { key: 'createdAt', label: 'Time', render: (row) => formatDateTime(row.createdAt) }
              ]}
              rows={securityEvents.slice(0, 8)}
              emptyMessage="No security events recorded yet."
            />
          </Card>
        </div>
      )}

      {activeTab === 'access' && (
        <Card title="Role permission matrix" subtitle="Routes are blocked unless the active role appears in the allowed roles list.">
          <DataTable
            columns={[
              { key: 'label', label: 'Page' },
              { key: 'section', label: 'Section' },
              { key: 'allowedRoles', label: 'Allowed Roles', render: (row) => <div className="flex flex-wrap gap-1">{row.allowedRoles.map((role) => <StatusBadge key={role} status={role} />)}</div> },
              { key: 'blockedRoles', label: 'Blocked Roles', render: (row) => <span className="text-xs text-slate-500">{row.blockedRoles.join(', ') || '—'}</span> }
            ]}
            rows={accessMatrix}
          />
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card title="Audit coverage by module" subtitle="Audit trail visibility for viewed, edited and approved actions.">
          <DataTable
            columns={[
              { key: 'module', label: 'Module' },
              { key: 'events', label: 'Events' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'lastEvent', label: 'Last Event', render: (row) => row.lastEvent ? formatDateTime(row.lastEvent) : '—' }
            ]}
            rows={auditCoverage}
          />
        </Card>
      )}

      {activeTab === 'privacy' && (
        <Card title="SMS PHI privacy scanner" subtitle="SMS alerts must not contain patient-identifying clinical data; they should only prompt the doctor to log in.">
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'entityId', label: 'Order' },
              { key: 'target', label: 'Target' },
              { key: 'privacyStatus', label: 'Privacy', render: (row) => <StatusBadge status={row.privacyStatus} /> },
              { key: 'findings', label: 'Findings', render: (row) => row.findings?.length ? row.findings.join(', ') : 'No PHI terms detected' },
              { key: 'body', label: 'Body', render: (row) => <span className="max-w-md whitespace-normal text-xs leading-5 text-slate-500">{row.body}</span> }
            ]}
            rows={smsPrivacy}
            emptyMessage="No SMS delivery events yet."
          />
        </Card>
      )}

      {activeTab === 'reliability' && (
        <div className="space-y-6">
          <Card title="Reliability and data-integrity checks" subtitle="Monitor workflow links that must remain consistent across orders, billing, results and reports.">
            <DataTable
              columns={[
                { key: 'name', label: 'Check' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'count', label: 'Count' },
                { key: 'detail', label: 'Detail', render: (row) => <span className="whitespace-normal text-sm text-slate-500">{row.detail}</span> }
              ]}
              rows={reliabilityChecks}
            />
          </Card>

          <Card title="Delivery retry monitor" subtitle="Email/SMS delivery failures should retry and remain visible to Admin.">
            <DataTable
              columns={[
                { key: 'id', label: 'ID' },
                { key: 'channel', label: 'Channel' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'retryCount', label: 'Retries' },
                { key: 'target', label: 'Target' },
                { key: 'entityId', label: 'Order' },
                { key: 'actions', label: 'Actions', render: (row) => <Button variant="secondary" onClick={() => dispatch({ type: 'RETRY_DELIVERY_NOTIFICATION', notificationId: row.id })}><RefreshCw className="h-4 w-4" /> Retry</Button> }
              ]}
              rows={failedNotifications}
              emptyMessage="No queued, failed or retried delivery events."
            />
          </Card>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card title="Backup and export readiness" subtitle="Export current security and reliability data for review.">
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-white"><DatabaseBackup className="h-6 w-6" /></div>
                <div>
                  <p className="font-bold text-slate-900">Security dataset export</p>
                  <p className="text-sm text-slate-600">Exports patients, orders, invoices, results, reports, notifications, audit logs and security events.</p>
                </div>
              </div>
              <Button className="mt-5 w-full" onClick={exportSecurity}><Download className="h-4 w-4" /> Export security dataset</Button>
            </div>
            <div className="mt-4 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              <strong>Security note:</strong> Store exports according to organizational backup, audit-log retention and delivery-retry policies.
            </div>
          </Card>

          <Card title="Non-functional requirement coverage" subtitle="Security controls mapped to workspace monitoring.">
            <div className="grid gap-3">
              {[
                ['Role access control', 'Implemented', ShieldCheck],
                ['Audit trail visibility', 'Implemented', Eye],
                ['Email/SMS failure visibility', 'Implemented', AlertTriangle],
                ['Data integrity warnings', 'Implemented', ShieldQuestion],
                ['Exportable security dataset', 'Implemented', Download],
                ['Encryption / at-rest controls', 'Server Required', LockKeyhole]
              ].map(([name, status, Icon]) => (
                <div key={name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-clinical-600" />
                    <p className="font-bold text-slate-900">{name}</p>
                  </div>
                  <StatusBadge status={status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
