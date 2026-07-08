import { useMemo, useState } from 'react';
import { Plus, Search, UserCog } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { Modal } from '../../components/ui/Modal';
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { ROLES } from '../../data/roles';
import { formatDateTime } from '../../utils/formatters';

const blankUser = {
  id: '',
  name: '',
  role: 'receptionist',
  status: 'Active',
  email: '',
  phone: '',
  linkedDoctorId: '',
  hospitalId: ''
};

export function UserManagementPage() {
  const { state, dispatch } = useAppStore();
  const { users = [], doctors = [], hospitals = [] } = state.data;
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankUser);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchText = !q || [user.id, user.name, user.role, user.email, user.phone].some((value) => String(value || '').toLowerCase().includes(q));
      const matchRole = !roleFilter || user.role === roleFilter;
      return matchText && matchRole;
    });
  }, [users, query, roleFilter]);

  const openNew = () => {
    setForm(blankUser);
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setForm({ ...blankUser, ...user });
    setModalOpen(true);
  };

  const save = (event) => {
    event.preventDefault();
    dispatch({ type: form.id ? 'ADMIN_UPDATE_USER' : 'ADMIN_CREATE_USER', userId: form.id, payload: form });
    setModalOpen(false);
  };

  const activeCount = users.filter((user) => user.status === 'Active').length;
  const inactiveCount = users.filter((user) => user.status !== 'Active').length;

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="User management"
        description="Create, edit, deactivate and assign role permissions for all platform accounts."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Create user</Button>}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Users" value={users.length} icon={UserCog} tone="blue" />
        <MetricCard label="Active" value={activeCount} icon={UserCog} tone="green" />
        <MetricCard label="Inactive" value={inactiveCount} icon={UserCog} tone="red" />
        <MetricCard label="Roles Covered" value={new Set(users.map((user) => user.role)).size} icon={UserCog} tone="purple" />
      </div>

      <Card title="Account registry" subtitle="Role assignment controls which dashboard and modules a user can access.">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user name, ID, role, email or phone" />
          </div>
          <select className={inputClass} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
          </select>
        </div>
        <DataTable
          columns={[
            { key: 'id', label: 'User ID' },
            { key: 'name', label: 'Name' },
            { key: 'role', label: 'Role', render: (row) => <StatusBadge status={ROLES.find((role) => role.id === row.role)?.label || row.role} /> },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'email', label: 'Email', render: (row) => row.email || '—' },
            { key: 'updatedAt', label: 'Updated', render: (row) => formatDateTime(row.updatedAt || row.createdAt) },
            { key: 'actions', label: 'Actions', render: (row) => (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                <Button variant={row.status === 'Active' ? 'danger' : 'secondary'} onClick={() => dispatch({ type: 'ADMIN_UPDATE_USER', userId: row.id, payload: { ...row, status: row.status === 'Active' ? 'Inactive' : 'Active' } })}>
                  {row.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            ) }
          ]}
          rows={filtered}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={form.id ? 'Edit user account' : 'Create user account'}
        description="Assign the user to a system role. Doctor users can be linked to a registered doctor and hospital."
        onClose={() => setModalOpen(false)}
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="admin-user-form">Save user</Button>
          </>
        )}
      >
        <form id="admin-user-form" onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <FormField label="Full name"><input required className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
          <FormField label="Role">
            <select className={inputClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </FormField>
          <FormField label="Email"><input type="email" className={inputClass} value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FormField>
          <FormField label="Phone"><input className={inputClass} value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormField>
          <FormField label="Linked doctor">
            <select className={inputClass} value={form.linkedDoctorId || ''} onChange={(event) => setForm({ ...form, linkedDoctorId: event.target.value })}>
              <option value="">Not linked</option>
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
            </select>
          </FormField>
          <FormField label="Hospital">
            <select className={inputClass} value={form.hospitalId || ''} onChange={(event) => setForm({ ...form, hospitalId: event.target.value })}>
              <option value="">No hospital</option>
              {hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}
            </select>
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
