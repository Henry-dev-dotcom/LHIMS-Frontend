import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  Edit3,
  FlaskConical,
  LayoutGrid,
  Plus,
  Save,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
  X
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';

const EMPTY_FACILITY = {
  name: '',
  code: '',
  type: 'Full Diagnostic Facility',
  status: 'Active',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  region: '',
  administrator: '',
  billingContact: '',
  departments: ['Reception', 'Laboratory', 'Imaging', 'Billing'],
  catalogItemIds: [],
  features: {
    clinicianRequests: true,
    receptionWalkins: true,
    laboratory: true,
    imaging: true,
    billing: true,
    resultsDelivery: true,
    reporting: true,
    apiAccess: false,
    patientMessaging: false,
    documentUpload: true
  },
  resultDelivery: {
    sendToClinician: true,
    sendToReception: false,
    allowPatientCopy: false,
    requireDigitalSignature: true
  },
  branding: {
    primaryColor: '#191816',
    accentColor: '#f2b35d',
    logoName: ''
  },
  limits: {
    maxUsers: 25,
    maxClinicians: 10,
    dailyOrderLimit: 250
  },
  notes: ''
};

const FEATURE_OPTIONS = [
  ['clinicianRequests', 'Clinician Requests', 'Allow clinicians to create and track requests.'],
  ['receptionWalkins', 'Reception Walk-ins', 'Enable front-desk walk-in registration and test requests.'],
  ['laboratory', 'Laboratory Workflow', 'Enable queue, accepted samples, result entry, and lab results archive.'],
  ['imaging', 'Scan / Imaging Workflow', 'Enable scan queue, imaging acceptance, reporting, and sign-off.'],
  ['billing', 'Billing / Finance', 'Enable invoices, payment tracking, floats, expenses, and ledgers.'],
  ['resultsDelivery', 'Results Delivery', 'Enable released result routing to the assigned clinician.'],
  ['reporting', 'Reports & Analytics', 'Enable facility-level reports, exports, and dashboard metrics.'],
  ['apiAccess', 'API Access', 'Allow API-ready integrations for this facility.'],
  ['patientMessaging', 'Patient Messaging', 'Allow safe patient-facing result notices.'],
  ['documentUpload', 'Document Uploads', 'Allow PDF, document, and image attachments on results.']
];

const DEPARTMENT_OPTIONS = ['Reception', 'Laboratory', 'Imaging', 'Billing', 'Reporting', 'Administration'];

function countEnabledFeatures(facility) {
  return Object.values(facility?.features || {}).filter(Boolean).length;
}

function normaliseFacility(facility) {
  return {
    ...EMPTY_FACILITY,
    ...(facility || {}),
    departments: facility?.departments || EMPTY_FACILITY.departments,
    catalogItemIds: facility?.catalogItemIds || [],
    features: { ...EMPTY_FACILITY.features, ...(facility?.features || {}) },
    resultDelivery: { ...EMPTY_FACILITY.resultDelivery, ...(facility?.resultDelivery || {}) },
    branding: { ...EMPTY_FACILITY.branding, ...(facility?.branding || {}) },
    limits: { ...EMPTY_FACILITY.limits, ...(facility?.limits || {}) }
  };
}

function buildDefaultFacility(data) {
  return normaliseFacility({
    id: 'FAC-DEMO-001',
    name: 'Main Diagnostic Facility',
    code: 'MAIN',
    type: 'Full Diagnostic Facility',
    status: 'Active',
    contactPerson: 'System Admin',
    phone: data?.settings?.phone || '',
    email: data?.settings?.email || '',
    address: data?.settings?.address || '',
    region: '',
    administrator: 'System Admin',
    billingContact: 'Main Finance Desk',
    departments: ['Reception', 'Laboratory', 'Imaging', 'Billing', 'Reporting', 'Administration'],
    catalogItemIds: (data?.catalog || []).map((item) => item.id),
    createdAt: data?.settings?.createdAt || new Date().toISOString(),
    updatedAt: data?.settings?.updatedAt || new Date().toISOString(),
    notes: 'Default facility generated from the current system configuration.'
  });
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="getlabs-lab-card flex min-h-[78px] items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-clinical-50 text-clinical-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function TogglePill({ enabled, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[92px] w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${enabled ? 'border-clinical-200 bg-clinical-50/80' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
    >
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${enabled ? 'bg-clinical-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
        {enabled ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function FacilityCard({ facility, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${selected ? 'border-clinical-300 bg-clinical-50/70 ring-2 ring-clinical-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-lg font-bold leading-tight text-slate-900">{facility.name}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{facility.code || facility.id} · {facility.type}</p>
        </div>
        <StatusBadge status={facility.status || 'Active'} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Features</p>
          <p className="mt-1 font-bold text-slate-900">{countEnabledFeatures(facility)}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Departments</p>
          <p className="mt-1 font-bold text-slate-900">{facility.departments?.length || 0}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Services</p>
          <p className="mt-1 font-bold text-slate-900">{facility.catalogItemIds?.length || 0}</p>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 break-words text-sm text-slate-500">{facility.address || 'No address added yet.'}</p>
    </button>
  );
}

function FacilityForm({ value, catalog, onChange }) {
  const update = (field, fieldValue) => onChange({ ...value, [field]: fieldValue });
  const updateNested = (group, field, fieldValue) => onChange({ ...value, [group]: { ...(value[group] || {}), [field]: fieldValue } });
  const toggleListItem = (field, item) => {
    const set = new Set(value[field] || []);
    if (set.has(item)) set.delete(item);
    else set.add(item);
    update(field, Array.from(set));
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-3 lg:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Facility name</span>
          <input className={inputClass} value={value.name || ''} onChange={(event) => update('name', event.target.value)} placeholder="e.g., East Legon Diagnostic Center" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Facility code</span>
          <input className={inputClass} value={value.code || ''} onChange={(event) => update('code', event.target.value)} placeholder="e.g., ELDC" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Facility type</span>
          <select className={inputClass} value={value.type || 'Full Diagnostic Facility'} onChange={(event) => update('type', event.target.value)}>
            <option>Full Diagnostic Facility</option>
            <option>Laboratory Only</option>
            <option>Imaging Only</option>
            <option>Collection Point</option>
            <option>Hospital Partner</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Status</span>
          <select className={inputClass} value={value.status || 'Active'} onChange={(event) => update('status', event.target.value)}>
            <option>Active</option>
            <option>Pending Setup</option>
            <option>Suspended</option>
            <option>Inactive</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Contact person</span>
          <input className={inputClass} value={value.contactPerson || ''} onChange={(event) => update('contactPerson', event.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Administrator</span>
          <input className={inputClass} value={value.administrator || ''} onChange={(event) => update('administrator', event.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Phone</span>
          <input className={inputClass} value={value.phone || ''} onChange={(event) => update('phone', event.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Email</span>
          <input className={inputClass} value={value.email || ''} onChange={(event) => update('email', event.target.value)} />
        </label>
        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Address</span>
          <input className={inputClass} value={value.address || ''} onChange={(event) => update('address', event.target.value)} />
        </label>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-900">Features to enable</p>
            <p className="text-sm text-slate-500">Customize which workflows this facility can use.</p>
          </div>
          <span className="rounded-full bg-clinical-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-clinical-700">{countEnabledFeatures(value)} enabled</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {FEATURE_OPTIONS.map(([key, title, description]) => (
            <TogglePill
              key={key}
              title={title}
              description={description}
              enabled={Boolean(value.features?.[key])}
              onClick={() => updateNested('features', key, !value.features?.[key])}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="font-bold text-slate-900">Departments</p>
          <p className="text-sm text-slate-500">Choose departments available at this facility.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {DEPARTMENT_OPTIONS.map((department) => (
              <button
                type="button"
                key={department}
                onClick={() => toggleListItem('departments', department)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${value.departments?.includes(department) ? 'border-clinical-200 bg-clinical-50 text-clinical-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}
              >
                {department}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="font-bold text-slate-900">Result routing rules</p>
          <p className="text-sm text-slate-500">Control where completed results go after release.</p>
          <div className="mt-4 space-y-2">
            {[
              ['sendToClinician', 'Send directly to clinician'],
              ['sendToReception', 'Also copy reception'],
              ['allowPatientCopy', 'Allow patient notice/copy'],
              ['requireDigitalSignature', 'Require digital signature']
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => updateNested('resultDelivery', key, !value.resultDelivery?.[key])}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-white"
              >
                <span className="text-sm font-bold text-slate-800">{label}</span>
                <StatusBadge status={value.resultDelivery?.[key] ? 'Enabled' : 'Disabled'} />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <p className="font-bold text-slate-900">Available tests and scans</p>
        <p className="text-sm text-slate-500">Select the catalog items this facility can request, process, or bill.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => update('catalogItemIds', catalog.map((item) => item.id))}>Select all</Button>
          <Button type="button" variant="ghost" onClick={() => update('catalogItemIds', [])}>Clear</Button>
        </div>
        <div className="mt-4 grid max-h-[360px] gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.map((item) => {
            const selected = value.catalogItemIds?.includes(item.id);
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => toggleListItem('catalogItemIds', item.id)}
                className={`rounded-2xl border p-3 text-left transition ${selected ? 'border-clinical-200 bg-clinical-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
              >
                <span className="block break-words text-sm font-bold text-slate-900">{item.name}</span>
                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{item.department || item.type}</span>
              </button>
            );
          })}
          {!catalog.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No catalog items are available yet.</p>}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="font-bold text-slate-900">Branding</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Primary color</span>
              <input className={inputClass} value={value.branding?.primaryColor || ''} onChange={(event) => updateNested('branding', 'primaryColor', event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Accent color</span>
              <input className={inputClass} value={value.branding?.accentColor || ''} onChange={(event) => updateNested('branding', 'accentColor', event.target.value)} />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Logo / display name</span>
              <input className={inputClass} value={value.branding?.logoName || ''} onChange={(event) => updateNested('branding', 'logoName', event.target.value)} placeholder="Optional facility logo/name reference" />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="font-bold text-slate-900">Limits</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Users</span>
              <input type="number" className={inputClass} value={value.limits?.maxUsers ?? 25} onChange={(event) => updateNested('limits', 'maxUsers', event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Clinicians</span>
              <input type="number" className={inputClass} value={value.limits?.maxClinicians ?? 10} onChange={(event) => updateNested('limits', 'maxClinicians', event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Daily orders</span>
              <input type="number" className={inputClass} value={value.limits?.dailyOrderLimit ?? 250} onChange={(event) => updateNested('limits', 'dailyOrderLimit', event.target.value)} />
            </label>
          </div>
        </div>
      </section>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Setup notes</span>
        <textarea className={`${inputClass} min-h-[120px] resize-y`} value={value.notes || ''} onChange={(event) => update('notes', event.target.value)} placeholder="Add implementation notes, facility-specific conditions, or rollout instructions." />
      </label>
    </div>
  );
}

export function HospitalsPage() {
  const { state, dispatch } = useAppStore();
  const { data } = state;
  const [query, setQuery] = useState('');
  const savedFacilities = (data.facilities || []).map(normaliseFacility);
  const facilities = savedFacilities.length ? savedFacilities : [buildDefaultFacility(data)];
  const [selectedId, setSelectedId] = useState(facilities[0]?.id || '');
  const selectedFacility = facilities.find((facility) => facility.id === selectedId) || facilities[0] || buildDefaultFacility(data);
  const [mode, setMode] = useState('view');
  const [draft, setDraft] = useState(normaliseFacility(selectedFacility));

  const catalog = useMemo(() => (data.catalog || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))), [data.catalog]);
  const filteredFacilities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return facilities;
    return facilities.filter((facility) => [facility.name, facility.code, facility.type, facility.status, facility.address, facility.contactPerson, facility.phone, facility.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)));
  }, [facilities, query]);

  const activeCount = facilities.filter((facility) => facility.status === 'Active').length;
  const totalEnabledFeatures = facilities.reduce((sum, facility) => sum + countEnabledFeatures(facility), 0);
  const totalServices = facilities.reduce((sum, facility) => sum + (facility.catalogItemIds?.length || 0), 0);

  const startCreate = () => {
    setMode('create');
    setDraft({ ...EMPTY_FACILITY, catalogItemIds: catalog.map((item) => item.id) });
  };

  const startEdit = (facility) => {
    setMode('edit');
    setSelectedId(facility.id);
    setDraft(normaliseFacility(facility));
  };

  const cancelEdit = () => {
    setMode('view');
    setDraft(normaliseFacility(selectedFacility));
  };

  const saveFacility = () => {
    if (mode === 'create') {
      dispatch({ type: 'ADMIN_CREATE_FACILITY', payload: draft });
    } else if (mode === 'edit') {
      dispatch({ type: 'ADMIN_UPDATE_FACILITY', facilityId: selectedFacility.id, payload: draft });
    }
    setMode('view');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin Configuration"
        title="Facilities / Partners"
        description="Add diagnostic facilities, configure the workflows available to each one, and control result routing, departments, services, branding, and operational limits."
        actions={(
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" /> Add Facility
          </Button>
        )}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Facilities" value={facilities.length} />
        <StatCard icon={ShieldCheck} label="Active" value={activeCount} />
        <StatCard icon={LayoutGrid} label="Enabled features" value={totalEnabledFeatures} />
        <StatCard icon={ClipboardList} label="Mapped services" value={totalServices} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(290px,0.95fr)_minmax(0,1.7fr)]">
        <section className="space-y-4">
          <Card title="Facility List" subtitle="Search and select a facility to customize." compact>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input aria-label="Search facilities" className={`${inputClass} pl-11`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search facility, code, region, contact..." />
            </div>
            <div className="mt-4 space-y-3">
              {filteredFacilities.map((facility) => (
                <FacilityCard
                  key={facility.id}
                  facility={facility}
                  selected={facility.id === selectedFacility.id && mode !== 'create'}
                  onSelect={() => {
                    setSelectedId(facility.id);
                    setDraft(normaliseFacility(facility));
                    setMode('view');
                  }}
                />
              ))}
              {!filteredFacilities.length && <p className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">No facility matches your search.</p>}
            </div>
          </Card>

          <Card title="Existing Hospital Partners" subtitle="Current referring hospitals remain available for clinician linkage." compact>
            <div className="space-y-2">
              {(data.hospitals || []).map((hospital) => (
                <div key={hospital.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-bold text-slate-900">{hospital.name}</p>
                      <p className="text-xs font-bold text-slate-500">{hospital.id}</p>
                    </div>
                    <StatusBadge status={hospital.accountStatus || 'Active'} />
                  </div>
                  <p className="mt-2 break-words text-xs text-slate-500">{hospital.billingContact || hospital.phone || hospital.address || 'No contact added.'}</p>
                </div>
              ))}
              {!(data.hospitals || []).length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No hospital partners have been added yet.</p>}
            </div>
          </Card>
        </section>

        <section className="min-w-0">
          {mode === 'view' ? (
            <Card
              title={selectedFacility.name || 'Facility Details'}
              subtitle="Review enabled workflows and facility-specific settings."
              actions={<Button variant="secondary" onClick={() => startEdit(selectedFacility)}><Edit3 className="h-4 w-4" /> Customize</Button>}
              compact
            >
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-2xl font-bold leading-tight text-slate-900">{selectedFacility.name}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{selectedFacility.code || selectedFacility.id} · {selectedFacility.type}</p>
                    </div>
                    <StatusBadge status={selectedFacility.status || 'Active'} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contact</p>
                      <p className="mt-1 break-words font-bold text-slate-900">{selectedFacility.contactPerson || 'Not added'}</p>
                      <p className="break-words text-xs text-slate-500">{selectedFacility.phone || selectedFacility.email || '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Admin lead</p>
                      <p className="mt-1 break-words font-bold text-slate-900">{selectedFacility.administrator || 'Not assigned'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Departments</p>
                      <p className="mt-1 font-bold text-slate-900">{selectedFacility.departments?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Updated</p>
                      <p className="mt-1 text-xs font-bold text-slate-900">{formatDateTime(selectedFacility.updatedAt || selectedFacility.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Settings2 className="h-5 w-5 text-clinical-700" />
                      <p className="font-bold text-slate-900">Enabled workflows</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {FEATURE_OPTIONS.map(([key, title]) => (
                        <div key={key} className={`rounded-2xl px-3 py-2 text-sm font-bold ${selectedFacility.features?.[key] ? 'bg-clinical-50 text-clinical-800' : 'bg-slate-50 text-slate-500'}`}>{title}</div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Database className="h-5 w-5 text-clinical-700" />
                      <p className="font-bold text-slate-900">Departments & services</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(selectedFacility.departments || []).map((department) => (
                        <span key={department} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">{department}</span>
                      ))}
                      {!(selectedFacility.departments || []).length && <span className="text-sm font-semibold text-slate-500">No departments configured yet.</span>}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-clinical-700"><FlaskConical className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.08em]">Lab services</span></div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{catalog.filter((item) => selectedFacility.catalogItemIds?.includes(item.id) && item.department === 'Laboratory').length}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-clinical-700"><ScanLine className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.08em]">Scan services</span></div>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{catalog.filter((item) => selectedFacility.catalogItemIds?.includes(item.id) && item.department === 'Imaging').length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <UsersRound className="h-5 w-5 text-clinical-700" />
                    <p className="font-bold text-slate-900">Operational limits</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Users</p><p className="mt-1 text-xl font-bold text-slate-900">{selectedFacility.limits?.maxUsers}</p></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Clinicians</p><p className="mt-1 text-xl font-bold text-slate-900">{selectedFacility.limits?.maxClinicians}</p></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Daily Orders</p><p className="mt-1 text-xl font-bold text-slate-900">{selectedFacility.limits?.dailyOrderLimit}</p></div>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card
              title={mode === 'create' ? 'Add New Diagnostic Facility' : `Customize ${selectedFacility.name}`}
              subtitle="Configure the facility profile, enabled modules, result routing, departments, services, branding, and limits."
              actions={(
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={cancelEdit}><X className="h-4 w-4" /> Cancel</Button>
                  <Button onClick={saveFacility}><Save className="h-4 w-4" /> Save Facility</Button>
                </div>
              )}
              compact
            >
              <FacilityForm value={draft} catalog={catalog} onChange={setDraft} />
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
