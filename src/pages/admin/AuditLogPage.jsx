import { useMemo, useState } from 'react';
import { Download, Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { inputClass } from '../../components/ui/FormField';

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AuditLogPage() {
  const { state } = useAppStore();
  const logs = state.data.auditLogs || [];
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const modules = [...new Set(logs.map((item) => item.module).filter(Boolean))];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((item) => {
      const matchModule = !moduleFilter || item.module === moduleFilter;
      const matchText = !q || [item.id, item.actor, item.role, item.action, item.module, item.entityId, item.details].some((value) => String(value || '').toLowerCase().includes(q));
      return matchModule && matchText;
    });
  }, [logs, query, moduleFilter]);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Who changed what and when across all modules, including patient records, orders, results, billing, admin settings and notifications."
        actions={<Button onClick={() => downloadJson('diagnosis-center-audit-log.json', filtered)}><Download className="h-4 w-4" /> Export audit</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Audit Events" value={logs.length} icon={ShieldCheck} tone="green" />
        <MetricCard label="Modules Covered" value={modules.length} icon={ShieldCheck} tone="blue" />
        <MetricCard label="Latest Event" value={logs[0]?.action || '—'} icon={ShieldCheck} tone="purple" />
      </div>
      <Card title="System audit trail" subtitle="Filter, review and export event history for security and quality control.">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_260px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input aria-label="Search audit log" className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action, module, entity or detail" />
          </div>
          <select className={inputClass} value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="">All modules</option>
            {modules.map((module) => <option key={module}>{module}</option>)}
          </select>
        </div>
        <DataTable
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'actor', label: 'Actor' },
            { key: 'role', label: 'Role', render: (row) => <StatusBadge status={row.role} /> },
            { key: 'action', label: 'Action' },
            { key: 'module', label: 'Module' },
            { key: 'entityId', label: 'Entity' },
            { key: 'details', label: 'Details', render: (row) => row.details || '—' },
            { key: 'timestamp', label: 'Timestamp', render: (row) => formatDateTime(row.timestamp) }
          ]}
          rows={filtered}
        />
      </Card>
    </div>
  );
}
