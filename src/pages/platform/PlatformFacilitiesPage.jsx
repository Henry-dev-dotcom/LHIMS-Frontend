import { useCallback, useEffect, useState } from 'react';
import { Building2, Pause, Play, Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { platformService } from '../../services/platformService';
import { listItems } from '../../api/normalizers';
import { formatDateTime } from '../../utils/formatters';

const EMPTY_FORM = {
  code: '',
  name: '',
  phone: '',
  email: '',
  address: '',
  adminName: '',
  adminUsername: 'admin',
  adminEmail: '',
  adminPassword: ''
};

const STATUS_LABEL = { ACTIVE: 'Active', SUSPENDED: 'Suspended', DISABLED: 'Disabled' };

function toPayload(form) {
  const optional = (value) => (value.trim() ? value.trim() : undefined);
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    phone: optional(form.phone),
    email: optional(form.email),
    address: optional(form.address),
    admin: {
      name: form.adminName.trim(),
      username: form.adminUsername.trim(),
      email: optional(form.adminEmail),
      password: form.adminPassword
    }
  };
}

export function PlatformFacilitiesPage() {
  const { dispatch } = useAppStore();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState('');

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setFacilities(listItems(await platformService.facilities(apiClient)));
    } catch (error) {
      setLoadError(error?.message || 'Facilities could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function createFacility(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const result = await platformService.createFacility(apiClient, toPayload(form));
      toast('success', `${result?.facility?.name || 'Facility'} created. Its administrator can now sign in with code ${result?.facility?.code}.`);
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (error) {
      setFormError(error?.message || 'The facility could not be created.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(facility, status) {
    setBusyId(facility.id);
    try {
      await platformService.updateFacility(apiClient, facility.id, { status });
      toast('success', status === 'ACTIVE' ? `${facility.name} reactivated.` : `${facility.name} suspended. Its users are signed out on their next action.`);
      await load();
    } catch (error) {
      toast('error', error?.message || 'The facility could not be updated.');
    } finally {
      setBusyId('');
    }
  }

  const canSubmit = form.code.trim().length >= 3 && form.name.trim().length >= 2 && form.adminName.trim().length >= 2
    && form.adminUsername.trim().length >= 3 && form.adminPassword.length >= 8;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Facilities"
        description="Every hospital, clinic or diagnostic centre on LHIMS. Each facility's data is kept separate from every other."
      />

      <Card
        title="Subscribing facilities"
        subtitle={loading ? 'Loading…' : `${facilities.length} ${facilities.length === 1 ? 'facility' : 'facilities'}`}
        actions={(
          <>
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button onClick={() => { setFormError(''); setModalOpen(true); }}><Plus className="h-4 w-4" /> New facility</Button>
          </>
        )}
      >
        {loadError ? (
          <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</div>
        ) : (
          <DataTable
            caption="Subscribing facilities"
            emptyMessage={loading ? 'Loading facilities…' : 'No facilities yet. Create the first one to get started.'}
            rows={facilities}
            columns={[
              { key: 'name', label: 'Facility', mobilePrimary: true },
              { key: 'code', label: 'Sign-in code' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={STATUS_LABEL[row.status] || row.status} /> },
              { key: 'users', label: 'Staff', render: (row) => row._count?.users ?? 0 },
              { key: 'patients', label: 'Patients', render: (row) => row._count?.patients ?? 0 },
              { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => row.status === 'ACTIVE' ? (
                  <Button size="sm" variant="secondary" disabled={busyId === row.id} onClick={() => setStatus(row, 'SUSPENDED')}>
                    <Pause className="h-3.5 w-3.5" /> Suspend
                  </Button>
                ) : (
                  <Button size="sm" variant="success" disabled={busyId === row.id} onClick={() => setStatus(row, 'ACTIVE')}>
                    <Play className="h-3.5 w-3.5" /> Reactivate
                  </Button>
                )
              }
            ]}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        title="New facility"
        description="Creates the facility and its first administrator, who then adds the rest of the staff."
        onClose={() => setModalOpen(false)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="new-facility-form" disabled={!canSubmit || saving}>
              <Building2 className="h-4 w-4" /> {saving ? 'Creating…' : 'Create facility'}
            </Button>
          </>
        )}
      >
        <form id="new-facility-form" onSubmit={createFacility} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Facility name" required><input className={inputClass} value={form.name} onChange={set('name')} /></FormField>
          <FormField label="Sign-in code" required help="3-16 letters or digits. Staff type this when signing in.">
            <input className={`${inputClass} uppercase`} value={form.code} onChange={(event) => setForm((c) => ({ ...c, code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} maxLength={16} />
          </FormField>
          <FormField label="Phone"><input className={inputClass} value={form.phone} onChange={set('phone')} /></FormField>
          <FormField label="Email"><input type="email" className={inputClass} value={form.email} onChange={set('email')} /></FormField>
          <FormField label="Address" className="sm:col-span-2"><input className={inputClass} value={form.address} onChange={set('address')} /></FormField>

          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:col-span-2">First administrator</p>
          <FormField label="Full name" required><input className={inputClass} value={form.adminName} onChange={set('adminName')} /></FormField>
          <FormField label="Username" required><input className={inputClass} autoComplete="off" value={form.adminUsername} onChange={set('adminUsername')} /></FormField>
          <FormField label="Email"><input type="email" className={inputClass} value={form.adminEmail} onChange={set('adminEmail')} /></FormField>
          <FormField label="Temporary password" required help="At least 8 characters. Share it privately; they should change it after signing in.">
            <input type="password" className={inputClass} autoComplete="new-password" value={form.adminPassword} onChange={set('adminPassword')} />
          </FormField>
          {formError && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}
