import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { adminService } from '../../services/adminService';
import { ROLE_FROM_API, listItems } from '../../api/normalizers';
import { ROLES } from '../../data/roles';

// Custom roles build on a standard staff workspace (never Admin).
const BASE_ROLES = ['DOCTOR', 'NURSE', 'PHARMACIST', 'RECEPTIONIST', 'LAB_STAFF', 'SCAN_STAFF', 'BILLING_STAFF'];

const GROUP_LABELS = {
  system: 'System',
  access: 'Access',
  users: 'Users',
  patients: 'Patients',
  doctor: 'Clinician portal',
  orders: 'Orders',
  reception: 'Reception',
  lab: 'Laboratory',
  scan: 'Imaging',
  billing: 'Billing',
  finance: 'Finance',
  results: 'Results',
  reports: 'Reports',
  notifications: 'Notifications',
  files: 'Files',
  catalog: 'Catalog',
  pricing: 'Pricing',
  encounters: 'Outpatient visits',
  pharmacy: 'Pharmacy',
  inpatient: 'Wards & admissions',
  theatre: 'Theatre',
  maternity: 'Maternity',
  immunization: 'Immunisation',
  claims: 'Insurance claims',
  stores: 'Stores & procurement',
  bloodbank: 'Blood bank'
};

const EMPTY_FORM = { id: '', name: '', description: '', baseRole: 'LAB_STAFF', permissions: [] };

function baseRoleLabel(apiRole) {
  return ROLES.find((role) => role.id === ROLE_FROM_API[apiRole])?.label || apiRole;
}

export function RolesPage() {
  const { dispatch } = useAppStore();
  const [catalog, setCatalog] = useState([]);
  const [system, setSystem] = useState([]);
  const [custom, setCustom] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [permissions, roles] = await Promise.all([adminService.permissions(apiClient), adminService.roles(apiClient)]);
      setCatalog(listItems(permissions));
      setSystem(roles?.system || []);
      setCustom(roles?.custom || []);
    } catch (error) {
      toast('error', error?.message || 'Roles could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const byGroup = new Map();
    for (const permission of catalog) {
      if (!byGroup.has(permission.group)) byGroup.set(permission.group, []);
      byGroup.get(permission.group).push(permission);
    }
    return [...byGroup.entries()];
  }, [catalog]);

  function defaultsFor(baseRole) {
    const assignable = new Set(catalog.map((p) => p.key));
    return (system.find((s) => s.role === baseRole)?.permissions || []).filter((p) => assignable.has(p));
  }

  function openNew() {
    setFormError('');
    // Start from the base workspace's standard permissions, then narrow or widen.
    setForm({ ...EMPTY_FORM, permissions: defaultsFor(EMPTY_FORM.baseRole) });
  }

  function openEdit(role) {
    setFormError('');
    setForm({ id: role.id, name: role.name, description: role.description || '', baseRole: role.baseRole, permissions: role.permissions });
  }

  function togglePermission(key) {
    setForm((current) => {
      const next = new Set(current.permissions);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...current, permissions: [...next] };
    });
  }

  function toggleGroup(items, allOn) {
    setForm((current) => {
      const next = new Set(current.permissions);
      for (const item of items) {
        if (allOn) next.delete(item.key);
        else next.add(item.key);
      }
      return { ...current, permissions: [...next] };
    });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || undefined, permissions: form.permissions };
      if (form.id) await adminService.updateRole(apiClient, form.id, payload);
      else await adminService.createRole(apiClient, { ...payload, baseRole: form.baseRole });
      toast('success', form.id ? `${payload.name} updated. Users on it get the change on their next action.` : `${payload.name} created.`);
      setForm(null);
      await load();
    } catch (error) {
      setFormError(error?.message || 'The role could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(role) {
    if (!window.confirm(`Delete the role "${role.name}"?`)) return;
    try {
      await adminService.deleteRole(apiClient, role.id);
      toast('success', `${role.name} deleted.`);
      await load();
    } catch (error) {
      toast('error', error?.message || 'The role could not be deleted.');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Administration"
        title="Roles & permissions"
        description="Create roles for your staff, such as Senior Nurse or Pharmacist, by choosing exactly what each one can do."
      />

      <Card
        title="Custom roles"
        subtitle={loading ? 'Loading…' : 'Each custom role builds on a standard workspace and replaces its permissions with the ones you choose.'}
        actions={<Button onClick={openNew} disabled={loading}><Plus className="h-4 w-4" /> New role</Button>}
      >
        <DataTable
          caption="Custom roles"
          emptyMessage={loading ? 'Loading roles…' : 'No custom roles yet. Staff use the standard roles until you create one.'}
          rows={custom}
          columns={[
            { key: 'name', label: 'Role', mobilePrimary: true },
            { key: 'baseRole', label: 'Workspace', render: (row) => baseRoleLabel(row.baseRole) },
            { key: 'permissions', label: 'Permissions', render: (row) => row.permissions.length },
            { key: 'users', label: 'Staff', render: (row) => row._count?.users ?? 0 },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="secondary" onClick={() => remove(row)} disabled={(row._count?.users ?? 0) > 0} title={(row._count?.users ?? 0) > 0 ? 'Move its staff to another role first' : undefined}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              )
            }
          ]}
        />
      </Card>

      <Card title="Standard roles" subtitle="Built in and read-only. Admin always has full access within this facility.">
        <DataTable
          caption="Standard roles"
          rows={system.map((s) => ({ id: s.role, ...s }))}
          columns={[
            { key: 'role', label: 'Role', mobilePrimary: true, render: (row) => baseRoleLabel(row.role) },
            { key: 'permissions', label: 'Permissions', render: (row) => (row.permissions.includes('*') ? 'All' : row.permissions.length) }
          ]}
        />
      </Card>

      <Modal
        open={Boolean(form)}
        title={form?.id ? `Edit ${form.name || 'role'}` : 'New role'}
        description="Permissions take effect on each user's next action."
        onClose={() => setForm(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
            <Button type="submit" form="role-form" disabled={saving || !form || form.name.trim().length < 2}>
              <KeyRound className="h-4 w-4" /> {saving ? 'Saving…' : 'Save role'}
            </Button>
          </>
        )}
      >
        {form && (
          <form id="role-form" onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Role name" required><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} /></FormField>
              <FormField label="Workspace" help={form.id ? 'Fixed once the role exists.' : 'Decides the menus and dashboard this role starts from.'}>
                <select
                  className={inputClass}
                  value={form.baseRole}
                  disabled={Boolean(form.id)}
                  onChange={(e) => setForm({ ...form, baseRole: e.target.value, permissions: defaultsFor(e.target.value) })}
                >
                  {BASE_ROLES.map((role) => <option key={role} value={role}>{baseRoleLabel(role)}</option>)}
                </select>
              </FormField>
              <FormField label="Description" className="sm:col-span-2"><input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={240} /></FormField>
            </div>

            <div className="space-y-3">
              {groups.map(([group, items]) => {
                const onCount = items.filter((item) => form.permissions.includes(item.key)).length;
                const allOn = onCount === items.length;
                return (
                  <fieldset key={group} className="rounded-2xl border border-slate-200 p-3">
                    <legend className="flex w-full items-center justify-between gap-2 px-1 text-sm font-semibold text-slate-900">
                      <span>{GROUP_LABELS[group] || group} <span className="font-normal text-slate-500">({onCount}/{items.length})</span></span>
                      <button type="button" className="text-xs font-semibold text-clinical-700 hover:underline" onClick={() => toggleGroup(items, allOn)}>
                        {allOn ? 'Clear' : 'Select all'}
                      </button>
                    </legend>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {items.map((item) => (
                        <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" className="h-4 w-4 accent-clinical-600" checked={form.permissions.includes(item.key)} onChange={() => togglePermission(item.key)} />
                          <span className="capitalize">{item.action || item.key}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
            {formError && <p role="alert" className="text-sm font-semibold text-red-600">{formError}</p>}
          </form>
        )}
      </Modal>
    </div>
  );
}
