import { useMemo, useState } from 'react';
import { Database, Download, Plus, ScanLine, Search, Settings, SlidersHorizontal, Trash2, UploadCloud } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { Modal } from '../../components/ui/Modal';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ResponsiveTabs } from '../../components/ui/ResponsiveTabs';
import { useAppStore } from '../../store/AppStore';
import { money } from '../../utils/formatters';

const blankCatalog = { id: '', type: 'Lab', name: '', department: 'Laboratory', modality: '', price: 0, expectedHours: 8, searchText: '', sampleType: '', parameters: [] };
const blankDepartment = { id: '', name: '', type: 'Laboratory', lead: '', notes: '' };
const blankEquipment = { id: '', room: '', machine: '', modality: 'X-ray', status: 'Available', serialNumber: '', serviceDue: '', notes: '' };
const blankParameter = { name: '', unit: '', low: '', high: '', criticalLow: '', criticalHigh: '', referenceRange: '', gender: 'All', ageMin: '', ageMax: '', method: '' };

const tabs = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'ranges', label: 'Reference Ranges' },
  { id: 'departments', label: 'Departments' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'exports', label: 'Config Export' }
];

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeParameter(parameter = {}) {
  const cleanNumber = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : '';
  };
  const low = cleanNumber(parameter.low);
  const high = cleanNumber(parameter.high);
  return {
    name: String(parameter.name || '').trim(),
    unit: String(parameter.unit || '').trim(),
    low,
    high,
    criticalLow: cleanNumber(parameter.criticalLow),
    criticalHigh: cleanNumber(parameter.criticalHigh),
    referenceRange: String(parameter.referenceRange || (low !== '' && high !== '' ? `${low} - ${high}` : '')).trim(),
    gender: parameter.gender || 'All',
    ageMin: cleanNumber(parameter.ageMin),
    ageMax: cleanNumber(parameter.ageMax),
    method: String(parameter.method || '').trim()
  };
}

function ParameterRangeEditor({ parameters, onChange, disabled }) {
  const rows = parameters?.length ? parameters : [];
  const updateRow = (index, patch) => {
    const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    onChange(next);
  };
  const addRow = () => onChange([...rows, { ...blankParameter }]);
  const removeRow = (index) => onChange(rows.filter((_, rowIndex) => rowIndex !== index));

  if (disabled) {
    return <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">Reference ranges are only required for laboratory tests. Scan items do not need parameter ranges.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-bold">Structured result parameters and reference ranges</p>
        <p className="mt-1 leading-6">These values appear inside the Lab result-entry modal, the Accepted Samples result page, reports, and patient trends. Low/High and Critical limits power automatic flagging.</p>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm font-semibold text-slate-500">
            No parameters defined yet. Add each result parameter for this lab test.
          </div>
        ) : rows.map((parameter, index) => (
          <div key={`${parameter.name || 'parameter'}-${index}-mobile`} className="rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Parameter {index + 1}</p>
                <p className="mt-1 truncate text-sm font-bold text-slate-900">{parameter.name || 'Unnamed parameter'}</p>
              </div>
              <Button type="button" size="sm" variant="danger" onClick={() => removeRow(index)}><Trash2 className="h-4 w-4" /> Remove</Button>
            </div>

            <div className="grid gap-3">
              <FormField label="Parameter"><input className={inputClass} value={parameter.name || ''} onChange={(event) => updateRow(index, { name: event.target.value })} placeholder="e.g. Hemoglobin" /></FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Unit"><input className={inputClass} value={parameter.unit || ''} onChange={(event) => updateRow(index, { unit: event.target.value })} placeholder="g/dL" /></FormField>
                <FormField label="Gender"><select className={inputClass} value={parameter.gender || 'All'} onChange={(event) => updateRow(index, { gender: event.target.value })}><option>All</option><option>Male</option><option>Female</option><option>Other</option></select></FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Low"><input className={inputClass} type="number" step="any" value={parameter.low ?? ''} onChange={(event) => updateRow(index, { low: event.target.value })} /></FormField>
                <FormField label="High"><input className={inputClass} type="number" step="any" value={parameter.high ?? ''} onChange={(event) => updateRow(index, { high: event.target.value })} /></FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Critical Low"><input className={inputClass} type="number" step="any" value={parameter.criticalLow ?? ''} onChange={(event) => updateRow(index, { criticalLow: event.target.value })} /></FormField>
                <FormField label="Critical High"><input className={inputClass} type="number" step="any" value={parameter.criticalHigh ?? ''} onChange={(event) => updateRow(index, { criticalHigh: event.target.value })} /></FormField>
              </div>
              <FormField label="Displayed Range"><input className={inputClass} value={parameter.referenceRange || ''} onChange={(event) => updateRow(index, { referenceRange: event.target.value })} placeholder="12.0 - 16.0" /></FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Age Min"><input className={inputClass} type="number" min="0" value={parameter.ageMin ?? ''} onChange={(event) => updateRow(index, { ageMin: event.target.value })} placeholder="0" /></FormField>
                <FormField label="Age Max"><input className={inputClass} type="number" min="0" value={parameter.ageMax ?? ''} onChange={(event) => updateRow(index, { ageMax: event.target.value })} placeholder="200" /></FormField>
              </div>
              <FormField label="Method"><input className={inputClass} value={parameter.method || ''} onChange={(event) => updateRow(index, { method: event.target.value })} placeholder="Analyzer/manual" /></FormField>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
        <table className="min-w-[1180px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left">Parameter</th>
              <th className="px-3 py-3 text-left">Unit</th>
              <th className="px-3 py-3 text-left">Low</th>
              <th className="px-3 py-3 text-left">High</th>
              <th className="px-3 py-3 text-left">Critical Low</th>
              <th className="px-3 py-3 text-left">Critical High</th>
              <th className="px-3 py-3 text-left">Displayed Range</th>
              <th className="px-3 py-3 text-left">Gender</th>
              <th className="px-3 py-3 text-left">Age Min</th>
              <th className="px-3 py-3 text-left">Age Max</th>
              <th className="px-3 py-3 text-left">Method</th>
              <th className="px-3 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((parameter, index) => (
              <tr key={`${parameter.name}-${index}`}>
                <td className="px-3 py-2"><input className={inputClass} value={parameter.name || ''} onChange={(event) => updateRow(index, { name: event.target.value })} placeholder="e.g. Hemoglobin" /></td>
                <td className="px-3 py-2"><input className={inputClass} value={parameter.unit || ''} onChange={(event) => updateRow(index, { unit: event.target.value })} placeholder="g/dL" /></td>
                <td className="px-3 py-2"><input className={inputClass} type="number" step="any" value={parameter.low ?? ''} onChange={(event) => updateRow(index, { low: event.target.value })} /></td>
                <td className="px-3 py-2"><input className={inputClass} type="number" step="any" value={parameter.high ?? ''} onChange={(event) => updateRow(index, { high: event.target.value })} /></td>
                <td className="px-3 py-2"><input className={inputClass} type="number" step="any" value={parameter.criticalLow ?? ''} onChange={(event) => updateRow(index, { criticalLow: event.target.value })} /></td>
                <td className="px-3 py-2"><input className={inputClass} type="number" step="any" value={parameter.criticalHigh ?? ''} onChange={(event) => updateRow(index, { criticalHigh: event.target.value })} /></td>
                <td className="px-3 py-2"><input className={inputClass} value={parameter.referenceRange || ''} onChange={(event) => updateRow(index, { referenceRange: event.target.value })} placeholder="12.0 - 16.0" /></td>
                <td className="px-3 py-2"><select className={inputClass} value={parameter.gender || 'All'} onChange={(event) => updateRow(index, { gender: event.target.value })}><option>All</option><option>Male</option><option>Female</option><option>Other</option></select></td>
                <td className="px-3 py-2"><input className={inputClass} type="number" min="0" value={parameter.ageMin ?? ''} onChange={(event) => updateRow(index, { ageMin: event.target.value })} placeholder="0" /></td>
                <td className="px-3 py-2"><input className={inputClass} type="number" min="0" value={parameter.ageMax ?? ''} onChange={(event) => updateRow(index, { ageMax: event.target.value })} placeholder="200" /></td>
                <td className="px-3 py-2"><input className={inputClass} value={parameter.method || ''} onChange={(event) => updateRow(index, { method: event.target.value })} placeholder="Analyzer/manual" /></td>
                <td className="px-3 py-2"><Button type="button" variant="danger" onClick={() => removeRow(index)}><Trash2 className="h-4 w-4" /> Remove</Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="12" className="px-4 py-6 text-center text-sm font-semibold text-slate-500">No parameters defined yet. Add each result parameter for this lab test.</td></tr>}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="secondary" className="w-full md:w-auto" onClick={addRow}><Plus className="h-4 w-4" /> Add parameter</Button>
    </div>
  );
}

function ConfigReadinessCard({ label, ok, detail }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-900">{label}</p>
        <StatusBadge status={ok ? 'Ready' : 'Needs Setup'} />
      </div>
      <p className="mt-1.5 text-[11px] font-semibold leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export function AdminSettingsPage() {
  const { state, dispatch } = useAppStore();
  const { catalog = [], departments = [], scanEquipment = [], labAnalyzers = [], hospitals = [], doctors = [], users = [] } = state.data;
  const [activeTab, setActiveTab] = useState('catalog');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogType, setCatalogType] = useState('');
  const [catalogModal, setCatalogModal] = useState(false);
  const [departmentModal, setDepartmentModal] = useState(false);
  const [equipmentModal, setEquipmentModal] = useState(false);
  const [catalogForm, setCatalogForm] = useState(blankCatalog);
  const [departmentForm, setDepartmentForm] = useState(blankDepartment);
  const [equipmentForm, setEquipmentForm] = useState(blankEquipment);

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return catalog.filter((item) => {
      const matchesType = !catalogType || item.type === catalogType;
      const text = [item.id, item.name, item.department, item.modality, item.searchText].join(' ').toLowerCase();
      return matchesType && (!q || text.includes(q));
    });
  }, [catalog, catalogQuery, catalogType]);

  const labCatalog = catalog.filter((item) => item.type === 'Lab');
  const scanCatalog = catalog.filter((item) => item.type === 'Scan');
  const missingRanges = labCatalog.filter((item) => !item.parameters?.length);
  const parameterCount = labCatalog.reduce((sum, item) => sum + (item.parameters?.length || 0), 0);
  const unavailableEquipment = scanEquipment.filter((item) => item.status !== 'Available');

  const openCatalog = (item = blankCatalog) => {
    setCatalogForm({ ...blankCatalog, ...item, parameters: (item.parameters || []).map((parameter) => ({ ...blankParameter, ...parameter })) });
    setCatalogModal(true);
  };
  const openDepartment = (department = blankDepartment) => {
    setDepartmentForm({ ...blankDepartment, ...department });
    setDepartmentModal(true);
  };
  const openEquipment = (equipment = blankEquipment) => {
    setEquipmentForm({ ...blankEquipment, ...equipment });
    setEquipmentModal(true);
  };
  const saveCatalog = (event) => {
    event.preventDefault();
    const parameters = catalogForm.type === 'Lab' ? (catalogForm.parameters || []).map(normalizeParameter).filter((parameter) => parameter.name) : [];
    const payload = { ...catalogForm, price: Number(catalogForm.price || 0), expectedHours: Number(catalogForm.expectedHours || 0), parameters };
    dispatch({ type: catalogForm.id ? 'ADMIN_UPDATE_CATALOG_ITEM' : 'ADMIN_CREATE_CATALOG_ITEM', itemId: catalogForm.id, payload });
    setCatalogModal(false);
  };
  const saveDepartment = (event) => {
    event.preventDefault();
    dispatch({ type: departmentForm.id ? 'ADMIN_UPDATE_DEPARTMENT' : 'ADMIN_CREATE_DEPARTMENT', departmentId: departmentForm.id, payload: departmentForm });
    setDepartmentModal(false);
  };
  const saveEquipment = (event) => {
    event.preventDefault();
    dispatch({ type: equipmentForm.id ? 'ADMIN_UPDATE_EQUIPMENT' : 'ADMIN_CREATE_EQUIPMENT', equipmentId: equipmentForm.id, payload: equipmentForm });
    setEquipmentModal(false);
  };

  const exportConfig = () => downloadJson('diagnosis-center-admin-configuration.json', {
    exportedAt: new Date().toISOString(),
    catalog,
    departments,
    scanEquipment,
    labAnalyzers,
    hospitals,
    doctors,
    users: users.map(({ email, phone, ...user }) => ({ ...user, email: email || '', phone: phone || '' }))
  });

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Admin settings and catalog control"
        description="Configure operational master data: test catalog, reference ranges, departments, equipment, users, doctors and partner facilities."
        actions={<Button onClick={exportConfig}><Download className="h-4 w-4" /> Export configuration</Button>}
      />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <MetricCard compact label="Catalog Items" value={catalog.length} icon={Database} tone="blue" />
        <MetricCard compact label="Lab Parameters" value={parameterCount} icon={SlidersHorizontal} tone="green" />
        <MetricCard compact label="Scan Items" value={scanCatalog.length} icon={ScanLine} tone="purple" />
        <MetricCard compact label="Equipment Alerts" value={unavailableEquipment.length} icon={Settings} tone="yellow" />
      </div>

      <ResponsiveTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-5" ariaLabel="Admin settings sections" />

      {activeTab === 'catalog' && (
        <Card compact className="mb-5" title="Test / scan catalog" subtitle="Search, add and edit investigations. Prices remain for reception/billing/admin only; clinical roles do not see them.">
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input aria-label="Search catalog" className={`${inputClass} pl-10`} value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search by ID, name, abbreviation, department or modality" />
            </div>
            <select className={inputClass} value={catalogType} onChange={(event) => setCatalogType(event.target.value)}>
              <option value="">All types</option>
              <option>Lab</option>
              <option>Scan</option>
            </select>
            <Button onClick={() => openCatalog()}><Plus className="h-4 w-4" /> Add item</Button>
          </div>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Item' },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge status={row.type} /> },
              { key: 'department', label: 'Department' },
              { key: 'modality', label: 'Modality', render: (row) => row.modality || '—' },
              { key: 'price', label: 'Price', render: (row) => money(row.price) },
              { key: 'expectedHours', label: 'Expected', render: (row) => `${row.expectedHours || 0}h` },
              { key: 'parameters', label: 'Ranges', render: (row) => row.type === 'Lab' ? `${row.parameters?.length || 0} parameter(s)` : 'Scan report' },
              { key: 'actions', label: 'Actions', render: (row) => <Button variant="secondary" onClick={() => openCatalog(row)}>Edit</Button> }
            ]}
            rows={filteredCatalog}
          />
        </Card>
      )}

      {activeTab === 'ranges' && (
        <Card compact className="mb-5" title="Reference range workbench" subtitle="A focused list of lab tests and their configured result parameters. Use this before lab result-entry testing.">
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <ConfigReadinessCard label="Lab tests configured" ok={labCatalog.length > 0} detail={`${labCatalog.length} lab tests available for result entry.`} />
            <ConfigReadinessCard label="Parameter coverage" ok={missingRanges.length === 0} detail={missingRanges.length ? `${missingRanges.length} lab test(s) still have no parameter ranges.` : 'Every lab test has at least one parameter.'} />
            <ConfigReadinessCard label="Flagging engine" ok={parameterCount > 0} detail="Low, high and critical limits feed the live flagging system in Accepted Samples." />
          </div>
          <DataTable
            columns={[
              { key: 'id', label: 'Test ID' },
              { key: 'name', label: 'Lab Test' },
              { key: 'parameters', label: 'Parameters', render: (row) => row.parameters?.length || 0 },
              { key: 'coverage', label: 'Coverage', render: (row) => <StatusBadge status={row.parameters?.length ? 'Ready' : 'Needs Setup'} /> },
              { key: 'preview', label: 'Range Preview', render: (row) => row.parameters?.slice(0, 3).map((parameter) => `${parameter.name}: ${parameter.referenceRange || 'No range'}`).join(' • ') || 'No ranges defined' },
              { key: 'actions', label: 'Actions', render: (row) => <Button variant="secondary" onClick={() => openCatalog(row)}>Edit ranges</Button> }
            ]}
            rows={labCatalog}
          />
        </Card>
      )}

      {activeTab === 'departments' && (
        <Card compact title="Department management" subtitle="Configure lab/scan sub-units, finance and reception teams.">
          <div className="mb-4 grid justify-stretch md:flex md:justify-end"><Button onClick={() => openDepartment()}><Plus className="h-4 w-4" /> Add department</Button></div>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Department' },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge status={row.type || 'General'} /> },
              { key: 'lead', label: 'Lead', render: (row) => row.lead || '—' },
              { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
              { key: 'actions', label: 'Actions', render: (row) => <Button variant="secondary" onClick={() => openDepartment(row)}>Edit</Button> }
            ]}
            rows={departments}
          />
        </Card>
      )}

      {activeTab === 'equipment' && (
        <Card compact title="Equipment and analyzers" subtitle="Track imaging rooms/machines and lab analyzer references used by result workflows.">
          <div className="mb-4 grid justify-stretch md:flex md:justify-end"><Button onClick={() => openEquipment()}><Plus className="h-4 w-4" /> Add equipment</Button></div>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'room', label: 'Room' },
              { key: 'machine', label: 'Machine' },
              { key: 'modality', label: 'Modality', render: (row) => <StatusBadge status={row.modality} /> },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'serialNumber', label: 'Serial', render: (row) => row.serialNumber || '—' },
              { key: 'serviceDue', label: 'Service Due', render: (row) => row.serviceDue || '—' },
              { key: 'actions', label: 'Actions', render: (row) => <Button variant="secondary" onClick={() => openEquipment(row)}>Edit</Button> }
            ]}
            rows={scanEquipment}
          />
          <div className="mt-4 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Lab analyzers</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">{labAnalyzers.join(' • ') || 'No analyzers configured yet'}</p>
          </div>
        </Card>
      )}

      {activeTab === 'exports' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card compact title="Configuration export" subtitle="Export current configuration for system setup and record keeping.">
            <div className="space-y-3 text-sm font-semibold text-slate-600">
              <p>Included: catalog, reference ranges, departments, imaging equipment, hospitals, doctors and user-role mappings.</p>
              <p>The export contains current configuration data for review and setup.</p>
            </div>
            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
              <Button onClick={exportConfig}><Download className="h-4 w-4" /> Export JSON</Button>
              <Button variant="secondary" onClick={() => dispatch({ type: 'ADMIN_CONFIGURATION_EXPORT_RECORDED' })}><UploadCloud className="h-4 w-4" /> Mark export reviewed</Button>
            </div>
          </Card>
          <Card compact title="Configuration checklist" subtitle="These checks identify setup gaps in the current configuration.">
            <div className="grid gap-3">
              <ConfigReadinessCard label="Users and roles" ok={users.length > 0} detail={`${users.length} users configured across system roles.`} />
              <ConfigReadinessCard label="Hospitals and doctors" ok={hospitals.length > 0 && doctors.length > 0} detail={`${hospitals.length} hospitals and ${doctors.length} affiliated doctors configured.`} />
              <ConfigReadinessCard label="Catalog and ranges" ok={catalog.length > 0 && missingRanges.length === 0} detail={`${catalog.length} catalog items; ${missingRanges.length} lab tests missing ranges.`} />
              <ConfigReadinessCard label="Imaging equipment" ok={scanEquipment.length > 0} detail={`${scanEquipment.length} imaging rooms/machines available for booking.`} />
            </div>
          </Card>
        </div>
      )}

      <Modal open={catalogModal} title={catalogForm.id ? 'Edit catalog item and ranges' : 'Add catalog item'} description="Admin changes here control what doctors can order, what finance can price, and what lab staff can enter as structured results." onClose={() => setCatalogModal(false)} footer={<><Button variant="secondary" onClick={() => setCatalogModal(false)}>Cancel</Button><Button type="submit" form="catalog-form">Save catalog item</Button></>}>
        <form id="catalog-form" onSubmit={saveCatalog} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Catalog ID"><input className={inputClass} value={catalogForm.id || 'Auto-generated for new items'} readOnly /></FormField>
            <FormField label="Name"><input required className={inputClass} value={catalogForm.name} onChange={(event) => setCatalogForm({ ...catalogForm, name: event.target.value })} /></FormField>
            <FormField label="Type"><select className={inputClass} value={catalogForm.type} onChange={(event) => setCatalogForm({ ...catalogForm, type: event.target.value, department: event.target.value === 'Lab' ? 'Laboratory' : 'Imaging', parameters: event.target.value === 'Lab' ? catalogForm.parameters : [] })}><option>Lab</option><option>Scan</option></select></FormField>
            <FormField label="Department"><input className={inputClass} value={catalogForm.department} onChange={(event) => setCatalogForm({ ...catalogForm, department: event.target.value })} /></FormField>
            <FormField label="Modality"><input className={inputClass} value={catalogForm.modality || ''} onChange={(event) => setCatalogForm({ ...catalogForm, modality: event.target.value })} placeholder="CT, X-ray, Ultrasound, Analyzer" /></FormField>
            <FormField label="Search aliases"><input className={inputClass} value={catalogForm.searchText || ''} onChange={(event) => setCatalogForm({ ...catalogForm, searchText: event.target.value })} placeholder="FBC CBC Full Blood Count" /></FormField>
            <FormField label="Price"><input type="number" min="0" className={inputClass} value={catalogForm.price} onChange={(event) => setCatalogForm({ ...catalogForm, price: event.target.value })} /></FormField>
            <FormField label="Expected hours"><input type="number" min="1" className={inputClass} value={catalogForm.expectedHours} onChange={(event) => setCatalogForm({ ...catalogForm, expectedHours: event.target.value })} /></FormField>
            <FormField label="Sample type"><input className={inputClass} value={catalogForm.sampleType || ''} onChange={(event) => setCatalogForm({ ...catalogForm, sampleType: event.target.value })} placeholder="Blood, urine, swab, imaging" /></FormField>
          </div>
          <ParameterRangeEditor disabled={catalogForm.type !== 'Lab'} parameters={catalogForm.parameters || []} onChange={(parameters) => setCatalogForm({ ...catalogForm, parameters })} />
        </form>
      </Modal>

      <Modal open={departmentModal} title={departmentForm.id ? 'Edit department' : 'Add department'} onClose={() => setDepartmentModal(false)} footer={<><Button variant="secondary" onClick={() => setDepartmentModal(false)}>Cancel</Button><Button type="submit" form="department-form">Save department</Button></>}>
        <form id="department-form" onSubmit={saveDepartment} className="grid gap-4 md:grid-cols-2">
          <FormField label="Name"><input required className={inputClass} value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} /></FormField>
          <FormField label="Type"><select className={inputClass} value={departmentForm.type || 'Laboratory'} onChange={(event) => setDepartmentForm({ ...departmentForm, type: event.target.value })}><option>Laboratory</option><option>Imaging</option><option>Reception</option><option>Billing / Finance</option><option>Admin</option></select></FormField>
          <FormField label="Lead"><input className={inputClass} value={departmentForm.lead} onChange={(event) => setDepartmentForm({ ...departmentForm, lead: event.target.value })} /></FormField>
          <FormField label="Notes"><input className={inputClass} value={departmentForm.notes || ''} onChange={(event) => setDepartmentForm({ ...departmentForm, notes: event.target.value })} /></FormField>
        </form>
      </Modal>

      <Modal open={equipmentModal} title={equipmentForm.id ? 'Edit equipment' : 'Add equipment'} onClose={() => setEquipmentModal(false)} footer={<><Button variant="secondary" onClick={() => setEquipmentModal(false)}>Cancel</Button><Button type="submit" form="equipment-form">Save equipment</Button></>}>
        <form id="equipment-form" onSubmit={saveEquipment} className="grid gap-4 md:grid-cols-2">
          <FormField label="Room"><input required className={inputClass} value={equipmentForm.room} onChange={(event) => setEquipmentForm({ ...equipmentForm, room: event.target.value })} /></FormField>
          <FormField label="Machine"><input required className={inputClass} value={equipmentForm.machine} onChange={(event) => setEquipmentForm({ ...equipmentForm, machine: event.target.value })} /></FormField>
          <FormField label="Modality"><select className={inputClass} value={equipmentForm.modality} onChange={(event) => setEquipmentForm({ ...equipmentForm, modality: event.target.value })}><option>X-ray</option><option>Ultrasound</option><option>CT</option><option>MRI</option><option>Echo</option></select></FormField>
          <FormField label="Status"><select className={inputClass} value={equipmentForm.status} onChange={(event) => setEquipmentForm({ ...equipmentForm, status: event.target.value })}><option>Available</option><option>In Use</option><option>Maintenance</option><option>Offline</option></select></FormField>
          <FormField label="Serial number"><input className={inputClass} value={equipmentForm.serialNumber || ''} onChange={(event) => setEquipmentForm({ ...equipmentForm, serialNumber: event.target.value })} /></FormField>
          <FormField label="Service due"><input type="date" className={inputClass} value={equipmentForm.serviceDue || ''} onChange={(event) => setEquipmentForm({ ...equipmentForm, serviceDue: event.target.value })} /></FormField>
          <FormField label="Notes"><textarea className={`${inputClass} min-h-24`} value={equipmentForm.notes || ''} onChange={(event) => setEquipmentForm({ ...equipmentForm, notes: event.target.value })} /></FormField>
        </form>
      </Modal>
    </div>
  );
}
