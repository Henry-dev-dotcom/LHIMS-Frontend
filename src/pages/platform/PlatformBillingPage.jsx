import { useCallback, useEffect, useState } from 'react';
import { Pencil, Play, Plus, RefreshCw, Save } from 'lucide-react';
import { ModulePicker } from './ModulePicker';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { ResponsiveTabs } from '../../components/ui/ResponsiveTabs';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { platformService } from '../../services/platformService';
import { INTERVAL_LABEL, SUBSCRIPTION_STATUS, subscriptionService } from '../../services/subscriptionService';
import { listItems } from '../../api/normalizers';
import { money } from '../../utils/formatters';
import { Pill } from '../subscription/Pill';

const TABS = [
  { id: 'subscriptions', label: 'Subscribers' },
  { id: 'plans', label: 'Plans' },
  { id: 'prices', label: 'Add-on prices' }
];
const formatDate = (value) => (value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : '—');
const EMPTY_PLAN = { code: '', name: '', description: '', monthlyPrice: '', yearlyDiscountPercent: '15', maxUsers: '', maxPatientsPerMonth: '', maxStorageMb: '', trialDays: '14', sortOrder: '0', isActive: true, isPublic: true, modules: [] };

export function PlatformBillingPage() {
  const { dispatch } = useAppStore();
  const [tab, setTab] = useState('subscriptions');
  const [data, setData] = useState({ subscriptions: [], plans: [], prices: [], catalog: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // plan being created/edited
  const [priceDraft, setPriceDraft] = useState({});
  const [running, setRunning] = useState(false);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [subscriptions, plans, prices, catalog] = await Promise.all([
        subscriptionService.subscriptions(apiClient), subscriptionService.plans(apiClient), subscriptionService.modulePrices(apiClient), platformService.modules(apiClient)
      ]);
      setData({ subscriptions: listItems(subscriptions), plans: listItems(plans), prices: listItems(prices), catalog: listItems(catalog) });
      setPriceDraft({});
    } catch (error) {
      setLoadError(error?.message || 'Billing data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runCycle() {
    setRunning(true);
    try {
      const result = await subscriptionService.runBilling(apiClient);
      toast('success', result?.outcomes?.length ? `Billing run: ${result.outcomes.map((o) => o.action).join(', ')}.` : 'Billing run: nothing was due.');
      await load();
    } catch (error) {
      toast('error', error?.message || 'The billing run failed.');
    } finally {
      setRunning(false);
    }
  }

  async function savePrice(row) {
    const value = Number(priceDraft[row.moduleKey]);
    if (!Number.isFinite(value) || value < 0) return toast('error', 'Enter a price of 0 or more.');
    try {
      await subscriptionService.setModulePrice(apiClient, row.moduleKey, value);
      toast('success', `${row.name}: ${money(value)} a month as an add-on.`);
      await load();
    } catch (error) {
      toast('error', error?.message || 'The price could not be saved.');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Platform" title="Plans & billing" description="Subscription plans, add-on department prices, and every facility's subscription. Prices are in GHS." />
      <ResponsiveTabs tabs={TABS} activeTab={tab} onChange={setTab} ariaLabel="Billing sections" />
      {loadError && <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</div>}

      {tab === 'subscriptions' && (
        <Card
          title="Subscribers"
          subtitle={loading ? 'Loading…' : `${data.subscriptions.length} on a plan. Facilities not listed are managed directly (departments set by hand).`}
          actions={(
            <>
              <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
              <Button variant="secondary" onClick={runCycle} disabled={running}><Play className="h-4 w-4" /> {running ? 'Running…' : 'Run billing now'}</Button>
            </>
          )}
        >
          <DataTable
            caption="Subscriptions"
            emptyMessage={loading ? 'Loading…' : 'No facility is on a plan yet.'}
            rows={data.subscriptions}
            columns={[
              { key: 'facility', label: 'Facility', mobilePrimary: true, render: (row) => `${row.facility.name} (${row.facility.code})` },
              { key: 'plan', label: 'Plan', render: (row) => `${row.plan.name} · ${INTERVAL_LABEL[row.interval]}` },
              { key: 'addOns', label: 'Add-ons', render: (row) => row.addOnModules.length || '—' },
              { key: 'status', label: 'Status', render: (row) => <Pill map={SUBSCRIPTION_STATUS} value={row.status} /> },
              { key: 'until', label: 'Until', render: (row) => formatDate(row.status === 'TRIALING' ? row.trialEndsAt : row.status === 'PAST_DUE' ? row.graceEndsAt : row.currentPeriodEnd) },
              { key: 'owing', label: 'Unpaid', render: (row) => (row.openInvoices.length ? money(row.openInvoices.reduce((t, i) => t + i.amount, 0)) : '—') },
              { key: 'card', label: 'Saved method', render: (row) => (row.hasSavedPaymentMethod ? 'Yes' : 'No') },
              { key: 'usage', label: 'Use this month', render: (row) => (row.usage ? <span className={row.usage.overFairUse ? 'font-semibold text-amber-700' : ''}>{row.usage.users} staff · {row.usage.patientsThisMonth} patients · {row.usage.storageMb} MB{row.usage.overFairUse ? ' · over plan' : ''}</span> : '—') },
              { key: 'cancel', label: 'Cancelling', render: (row) => (row.cancelAtPeriodEnd ? 'At period end' : '') }
            ]}
          />
        </Card>
      )}

      {tab === 'plans' && (
        <Card title="Plans" subtitle="Changing a plan's departments applies to its subscribers at once; price changes apply from each subscriber's next renewal." actions={<Button onClick={() => setEditing({ ...EMPTY_PLAN })}><Plus className="h-4 w-4" /> New plan</Button>}>
          <DataTable
            caption="Plans"
            emptyMessage={loading ? 'Loading…' : 'No plans yet.'}
            rows={data.plans}
            columns={[
              { key: 'name', label: 'Plan', mobilePrimary: true, render: (row) => `${row.name} (${row.code})` },
              { key: 'monthlyPrice', label: 'Per month', render: (row) => money(row.monthlyPrice) },
              { key: 'yearly', label: 'Yearly discount', render: (row) => `${row.yearlyDiscountPercent}%` },
              { key: 'modules', label: 'Departments', render: (row) => row.modules.length },
              { key: 'maxUsers', label: 'Staff', render: (row) => row.maxUsers ?? 'Unlimited' },
              { key: 'trialDays', label: 'Trial', render: (row) => `${row.trialDays} days` },
              { key: 'state', label: 'Shown', render: (row) => (!row.isActive ? 'Retired' : row.isPublic ? 'Public' : 'Private') },
              { key: 'actions', label: '', render: (row) => <Button size="sm" variant="secondary" onClick={() => setEditing({ ...row, monthlyPrice: String(row.monthlyPrice), yearlyDiscountPercent: String(row.yearlyDiscountPercent), maxUsers: row.maxUsers ? String(row.maxUsers) : '', maxPatientsPerMonth: row.maxPatientsPerMonth ? String(row.maxPatientsPerMonth) : '', maxStorageMb: row.maxStorageMb ? String(row.maxStorageMb) : '', trialDays: String(row.trialDays), sortOrder: String(row.sortOrder), description: row.description || '' })}><Pencil className="h-3.5 w-3.5" /> Edit</Button> }
            ]}
          />
        </Card>
      )}

      {tab === 'prices' && (
        <Card title="Add-on prices" subtitle="The monthly price of a department added to any plan. Departments without a price cannot be bought as add-ons.">
          <DataTable
            caption="Add-on prices"
            rows={data.prices.map((p) => ({ ...p, id: p.moduleKey }))}
            columns={[
              { key: 'name', label: 'Department', mobilePrimary: true },
              { key: 'current', label: 'Current', render: (row) => (row.priced ? money(row.monthlyPrice) : 'Not sold') },
              {
                key: 'edit', label: 'New price / month', render: (row) => (
                  <div className="flex items-center gap-2">
                    <input aria-label={`Price for ${row.name}`} type="number" min="0" step="1" className={`${inputClass} w-28`} value={priceDraft[row.moduleKey] ?? ''} placeholder={row.priced ? String(row.monthlyPrice) : ''} onChange={(e) => setPriceDraft((d) => ({ ...d, [row.moduleKey]: e.target.value }))} />
                    <Button size="sm" variant="secondary" disabled={priceDraft[row.moduleKey] === undefined || priceDraft[row.moduleKey] === ''} onClick={() => savePrice(row)}><Save className="h-3.5 w-3.5" /> Save</Button>
                  </div>
                )
              }
            ]}
          />
        </Card>
      )}

      {editing && <PlanEditor key={editing.id || 'new'} plan={editing} catalog={data.catalog} onClose={() => setEditing(null)} onSaved={async (name) => { setEditing(null); toast('success', `${name} saved.`); await load(); }} />}
    </div>
  );
}

function PlanEditor({ plan, catalog, onClose, onSaved }) {
  const [form, setForm] = useState(plan);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = !plan.id;
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      monthlyPrice: Number(form.monthlyPrice),
      yearlyDiscountPercent: Number(form.yearlyDiscountPercent || 0),
      maxUsers: form.maxUsers ? Number(form.maxUsers) : null,
      maxPatientsPerMonth: form.maxPatientsPerMonth ? Number(form.maxPatientsPerMonth) : null,
      maxStorageMb: form.maxStorageMb ? Number(form.maxStorageMb) : null,
      trialDays: Number(form.trialDays || 0),
      sortOrder: Number(form.sortOrder || 0),
      isActive: form.isActive,
      isPublic: form.isPublic,
      modules: form.modules
    };
    try {
      if (isNew) await subscriptionService.createPlan(apiClient, { ...payload, code: form.code.trim() });
      else await subscriptionService.updatePlan(apiClient, plan.id, payload);
      await onSaved(payload.name);
    } catch (e) {
      setError(e?.message || 'The plan could not be saved.');
      setSaving(false);
    }
  }

  const canSave = form.name.trim().length >= 2 && form.monthlyPrice !== '' && form.modules.length > 0 && (!isNew || form.code.trim().length >= 2);

  return (
    <Modal
      open
      title={isNew ? 'New plan' : `Edit ${plan.name}`}
      description="Subscribers keep their plan; they see changes to its departments straight away."
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="plan-editor" disabled={!canSave || saving}><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save plan'}</Button>
        </>
      )}
    >
      <form id="plan-editor" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {isNew && <FormField label="Code" required help="Short and unique, e.g. CLINIC."><input className={`${inputClass} uppercase`} value={form.code} onChange={set('code')} maxLength={20} /></FormField>}
        <FormField label="Name" required><input className={inputClass} value={form.name} onChange={set('name')} /></FormField>
        <FormField label="Description" className="sm:col-span-2"><input className={inputClass} value={form.description} onChange={set('description')} /></FormField>
        <FormField label="Price per month (GHS)" required><input type="number" min="0" className={inputClass} value={form.monthlyPrice} onChange={set('monthlyPrice')} /></FormField>
        <FormField label="Yearly discount (%)"><input type="number" min="0" max="60" className={inputClass} value={form.yearlyDiscountPercent} onChange={set('yearlyDiscountPercent')} /></FormField>
        <FormField label="Staff accounts" help="Leave empty for unlimited."><input type="number" min="1" className={inputClass} value={form.maxUsers} onChange={set('maxUsers')} /></FormField>
        <FormField label="New patients a month (fair use)" help="Warned about, never blocked. Empty for none."><input type="number" min="1" className={inputClass} value={form.maxPatientsPerMonth} onChange={set('maxPatientsPerMonth')} /></FormField>
        <FormField label="File storage, MB (fair use)" help="Warned about, never blocked. Empty for none."><input type="number" min="1" className={inputClass} value={form.maxStorageMb} onChange={set('maxStorageMb')} /></FormField>
        <FormField label="Free trial (days)"><input type="number" min="0" max="90" className={inputClass} value={form.trialDays} onChange={set('trialDays')} /></FormField>
        <FormField label="Order on the pricing page"><input type="number" min="0" className={inputClass} value={form.sortOrder} onChange={set('sortOrder')} /></FormField>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Available to choose</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPublic} onChange={set('isPublic')} /> Shown on the public pricing page</label>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:col-span-2">Departments included</p>
        <div className="sm:col-span-2"><ModulePicker catalog={catalog} value={form.modules} onChange={(modules) => setForm((f) => ({ ...f, modules }))} idPrefix="plan-module" /></div>
        {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
