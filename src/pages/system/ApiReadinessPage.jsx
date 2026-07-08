import { useState } from 'react';
import { Activity, CheckCircle2, Database, Layers, ListChecks, PlugZap, ServerCog, Settings2, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MetricCard } from '../../components/ui/MetricCard';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { API_MODES } from '../../api/config';
import { useApiReadiness } from '../../hooks/useApiReadiness';

const readinessSections = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Activity,
    helper: 'Mode, services, endpoints and model summary.'
  },
  {
    id: 'connection',
    label: 'Connection',
    icon: Settings2,
    helper: 'API URL, timeout and connection status.'
  },
  {
    id: 'services',
    label: 'Services & Models',
    icon: Layers,
    helper: 'Service boundaries and payload mappers.'
  },
  {
    id: 'endpoints',
    label: 'Endpoints',
    icon: ServerCog,
    helper: 'API route contracts by module.'
  },
  {
    id: 'checklist',
    label: 'Checklist',
    icon: ListChecks,
    helper: 'Connection and service checks.'
  }
];

function SectionNav({ activeSection, counts, onChange }) {
  return (
    <Card compact className="mb-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {readinessSections.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(section.id)}
              className={`rounded-[1.2rem] border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lift ${active ? 'border-clinical-400 bg-clinical-50 ring-4 ring-clinical-100' : 'border-slate-200 bg-white hover:border-clinical-200'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-2xl ${active ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-4 w-4" /></span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{counts[section.id]}</span>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-900">{section.label}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{section.helper}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function CompactInfoBox({ label, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-bold text-slate-800">{children}</div>
    </div>
  );
}

export function ApiReadinessPage() {
  const { config, endpoints, readiness, updateMode } = useApiReadiness();
  const [activeSection, setActiveSection] = useState('overview');

  const endpointRows = endpoints.map((endpoint, index) => ({ id: `${endpoint.module}-${endpoint.name}-${index}`, ...endpoint }));
  const serviceRows = readiness.services.map((service) => ({ id: service, service, status: 'Mapped', mode: readiness.apiMode }));
  const modelRows = readiness.mappedModels.map((model) => ({ id: model, model, status: 'Mapped', purpose: model === 'Catalog Item' ? 'Catalog and reference-range contract' : `${model} payload mapper` }));
  const sectionCounts = {
    overview: 4,
    connection: 3,
    services: readiness.serviceCount + readiness.mappedModels.length,
    endpoints: readiness.endpointCount,
    checklist: 11
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System Integration"
        title="API Integration Console"
        description="Review API mode, service files, endpoint contracts, token storage, and mapped data models from one organized console."
        actions={
          <>
            <Button variant={readiness.apiMode === API_MODES.MOCK ? 'primary' : 'secondary'} onClick={() => updateMode(API_MODES.MOCK)}>Mock API Mode</Button>
            <Button variant={readiness.apiMode === API_MODES.LIVE ? 'primary' : 'secondary'} onClick={() => updateMode(API_MODES.LIVE)}>Live API Mode</Button>
          </>
        }
      />

      <SectionNav activeSection={activeSection} counts={sectionCounts} onChange={setActiveSection} />

      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard compact label="API Mode" value={readiness.apiMode.toUpperCase()} icon={PlugZap} tone={readiness.apiMode === API_MODES.MOCK ? 'yellow' : 'green'} helper="Mock mode uses local data; live mode calls the API." />
            <MetricCard compact label="Service Files" value={readiness.serviceCount} icon={Layers} tone="blue" helper="Auth, patient, doctor, lab, scan, billing, admin and more." />
            <MetricCard compact label="Endpoint Contracts" value={readiness.endpointCount} icon={ServerCog} tone="purple" helper="Mapped API routes." />
            <MetricCard compact label="Mapped Models" value={readiness.mappedModels.length} icon={Database} tone="green" helper="Core objects normalized for API payloads." />
          </div>

          <Card compact title="Integration summary" subtitle="Review the API mode, service boundary, route coverage and mapped payload objects in focused sections.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Mode control', readiness.apiMode.toUpperCase(), 'Switch between local and live API data sources.'],
                ['Service boundary', `${readiness.serviceCount} files`, 'Pages call organized service modules.'],
                ['Route coverage', `${readiness.endpointCount} endpoints`, 'Endpoint contracts are organized by module.'],
                ['Mapper coverage', `${readiness.mappedModels.length} models`, 'Core payload objects are normalized before requests.']
              ].map(([label, value, detail]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'connection' && (
        <div className="space-y-6">
          <Card compact title="API connection settings" subtitle="Review live-mode connection values and request settings.">
            <div className="grid gap-4 md:grid-cols-3">
              <CompactInfoBox label="Base URL"><p className="break-all">{config.baseUrl}</p></CompactInfoBox>
              <CompactInfoBox label="Timeout"><p>{config.timeoutMs}ms</p></CompactInfoBox>
              <CompactInfoBox label="Status"><StatusBadge status={readiness.apiMode === API_MODES.MOCK ? 'Local mode selected' : 'Live mode selected'} /></CompactInfoBox>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              <strong>Important:</strong> Use mock mode for local data and live mode for server requests. Confirm <code className="rounded bg-white/70 px-1 py-0.5">VITE_API_BASE_URL</code> before switching to Live API Mode.
            </div>
          </Card>

          <Card compact title="Runtime environment values" subtitle="Key environment values used by the API client.">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ['VITE_API_MODE', readiness.apiMode],
                ['VITE_API_BASE_URL', config.baseUrl],
                ['VITE_API_TIMEOUT_MS', `${config.timeoutMs}`]
              ].map(([name, value]) => (
                <div key={name} className="rounded-2xl bg-slate-950 p-4 text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{name}</p>
                  <p className="mt-2 break-all text-sm font-bold">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'services' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card compact title="Service readiness" subtitle="Each service file groups requests for a specific module.">
            <DataTable
              dense
              columns={[
                { key: 'service', label: 'Service' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'mode', label: 'Current Mode' }
              ]}
              rows={serviceRows}
            />
          </Card>

          <Card compact title="Model mappers" subtitle="Core objects are mapped into API-friendly payload contracts.">
            <DataTable
              dense
              columns={[
                { key: 'model', label: 'Model' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'purpose', label: 'Purpose' }
              ]}
              rows={modelRows}
            />
          </Card>
        </div>
      )}

      {activeSection === 'endpoints' && (
        <Card compact title="Endpoint contract map" subtitle="API contracts grouped by application module.">
          <DataTable
            dense
            columns={[
              { key: 'module', label: 'Module', render: (row) => <span className="font-bold capitalize text-slate-800">{row.module}</span> },
              { key: 'name', label: 'Action' },
              { key: 'signature', label: 'Endpoint Contract' }
            ]}
            rows={endpointRows}
          />
        </Card>
      )}

      {activeSection === 'checklist' && (
        <div className="space-y-6">
          <Card compact title="Integration readiness checklist">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                'API client configured for server requests',
                'Mock adapter available for local data mode',
                'Service files created for every major module',
                'Patient, order, result, invoice and catalog mappers created',
                'Endpoint map grouped by application module',
                'Mock/live API mode switch available',
                'Local data mode available for offline review',
                'API integration stays inside organized service modules'
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm font-semibold text-emerald-800">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card compact title="API module summary" subtitle="Core platform modules covered by the integration map.">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['Foundation', 'Express/TypeScript, PostgreSQL, Prisma, health checks, Swagger'],
                ['Auth + Roles', 'JWT login, refresh tokens, role middleware and permission guards'],
                ['Core APIs', 'Patients, orders, lab, scan, billing, finance, admin and results']
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><CheckCircle2 className="h-4 w-4 text-clinical-600" /> {title}</div>
                  <p className="text-sm leading-6 text-slate-500">{body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
