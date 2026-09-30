import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Download, FileUp, ImagePlus, ListChecks, Sparkles, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { authService } from '../../services/authService';
import { normalizeAuthUser } from '../../api/normalizers';
import { STARTER_PRICE_LIST, onboardingService, parseCsv, priceListTemplateCsv } from '../../services/onboardingService';
import { getApiConfig } from '../../api/config';

const MAX_LOGO_BYTES = 200 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/** Facility setup checklist: details and logo, departments, staff, price list, first patient. */
export function SetupPage() {
  const { state, dispatch } = useAppStore();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const fileRef = useRef(null);

  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);
  const navigate = (pageId) => dispatch({ type: 'NAVIGATE', pageId });

  const refreshSession = useCallback(async () => {
    try {
      const user = await authService.me(apiClient);
      const auth = normalizeAuthUser(user?.user || user);
      if (auth) dispatch({ type: 'SET_AUTH', auth });
    } catch { /* ignored */ }
  }, [dispatch]);

  const load = useCallback(async () => {
    try {
      const result = await onboardingService.status(apiClient);
      setData(result);
      setProfile((current) => current || {
        name: result.facility.name || '',
        phone: result.facility.phone || '',
        email: result.facility.email || '',
        address: result.facility.address || '',
        logoDataUrl: result.facility.logoDataUrl || null,
        allowSupportAccess: result.facility.allowSupportAccess
      });
      setLoadError('');
    } catch (error) {
      setLoadError(error?.message || 'The setup checklist could not be loaded.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    try {
      await onboardingService.saveProfile(apiClient, profile);
      toast('success', 'Facility details saved.');
      await load();
      await refreshSession();
    } catch (error) {
      setProfileError(error?.message || 'The details could not be saved.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function chooseLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setProfileError('Choose a PNG, JPEG or WebP image.');
    if (file.size > MAX_LOGO_BYTES) return setProfileError('The logo must be 200 KB or smaller. Try a smaller image.');
    setProfileError('');
    const dataUrl = await readFileAsDataUrl(file);
    setProfile((p) => ({ ...p, logoDataUrl: dataUrl }));
  }

  async function importRows(rows, label) {
    setImporting(true);
    setImportErrors([]);
    try {
      const result = await onboardingService.importPriceList(apiClient, rows);
      toast('success', `${label}: ${result.created} added, ${result.updated} updated. Check the prices in Price Catalog.`);
      // New items must appear straight away wherever tests and fees are picked.
      dispatch({ type: 'REFRESH_COLLECTIONS', names: ['catalog'] });
      await load();
    } catch (error) {
      const rowsWithErrors = error?.details?.errors || [];
      setImportErrors(rowsWithErrors.length ? rowsWithErrors : [{ field: '', message: error?.message || 'The price list could not be imported.' }]);
    } finally {
      setImporting(false);
    }
  }

  async function chooseCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const { rows, error } = parseCsv(await file.text());
    if (error) return setImportErrors([{ field: '', message: error }]);
    await importRows(rows, file.name);
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([priceListTemplateCsv()], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lhims-price-list-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const [exporting, setExporting] = useState(false);
  async function downloadExport() {
    setExporting(true);
    try {
      const response = await fetch(`${getApiConfig().baseUrl}/admin/data-export`, { credentials: 'include' });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'The export could not be made.');
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') || '')?.[1] || 'lhims-export.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast('success', 'Your data was downloaded. Keep the file somewhere safe: it contains patient records.');
    } catch (error) {
      toast('error', error?.message || 'The export could not be made.');
    } finally {
      setExporting(false);
    }
  }

  async function finish() {
    try {
      await onboardingService.complete(apiClient);
      await refreshSession();
      toast('success', 'Setup finished. You can come back to Facility Setup at any time.');
      navigate('admin-dashboard');
    } catch (error) {
      toast('error', error?.message || 'Setup could not be finished.');
    }
  }

  if (loadError) return <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</div>;
  if (!data || !profile) return <div className="p-6 text-sm text-slate-500">Loading setup…</div>;

  const step = Object.fromEntries(data.steps.map((s) => [s.key, s]));
  const doneCount = data.steps.filter((s) => s.done).length;
  const modules = state.auth?.modules || [];
  const starter = STARTER_PRICE_LIST.filter((r) => !r.module || modules.includes(r.module)).map(({ module: _m, ...row }) => row);
  const Tick = ({ done }) => (done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Done" /> : <Circle className="h-5 w-5 text-slate-300" aria-label="Not done yet" />);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Admin"
        title={data.completed ? 'Facility setup' : `Welcome to LHIMS, ${state.auth?.userName?.split(' ')[0] || ''}`}
        description={data.completed ? 'Your facility details, logo and support access.' : `Five short steps to get ${data.facility.name} ready. Only the first is needed — you can start working at any time.`}
      />

      {!data.completed && (
        <Card title={`${doneCount} of ${data.steps.length} done`} subtitle={`Staff sign in with facility code ${data.facility.code}. Share this link with them: ${window.location.origin}${window.location.pathname}#/login/${data.facility.code}`}>
          <ol className="grid gap-2 sm:grid-cols-5">
            {data.steps.map((s, i) => (
              <li key={s.key} className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${s.done ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-700'}`}>
                <Tick done={s.done} /> {i + 1}. {s.title}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title={<span className="flex items-center gap-2"><Tick done={step.profile.done} /> 1. Facility details</span>} subtitle="Shown on bills, reports and in the app header.">
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Facility name" required><input className={inputClass} value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} /></FormField>
          <FormField label="Phone" required><input className={inputClass} value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} /></FormField>
          <FormField label="Email"><input type="email" className={inputClass} value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} /></FormField>
          <FormField label="Address" required><input className={inputClass} value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} /></FormField>
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold text-slate-700">Logo</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {profile.logoDataUrl ? <img src={profile.logoDataUrl} alt="Facility logo" className="h-14 w-14 rounded-2xl border border-slate-200 bg-white object-contain p-1" /> : <div className="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-slate-300 text-slate-400"><ImagePlus className="h-5 w-5" /></div>}
              <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-clinical-300">
                Choose image<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={chooseLogo} />
              </label>
              {profile.logoDataUrl && <Button variant="ghost" size="sm" onClick={() => setProfile((p) => ({ ...p, logoDataUrl: null }))}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>}
              <span className="text-xs text-slate-500">PNG, JPEG or WebP, up to 200 KB. A square image works best.</span>
            </div>
          </div>
          <label className="flex items-start gap-3 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={profile.allowSupportAccess} onChange={(e) => setProfile((p) => ({ ...p, allowSupportAccess: e.target.checked }))} />
            <span><strong>Allow LHIMS support to look in when you ask for help.</strong> Support can then open a 30-minute, read-only view of your facility. Every visit, with the reason, appears in your Audit Log. Untick to refuse all support access.</span>
          </label>
          {profileError && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{profileError}</p>}
          <div className="sm:col-span-2"><Button type="submit" disabled={savingProfile || !profile.name.trim()}>{savingProfile ? 'Saving…' : 'Save details'}</Button></div>
        </form>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Tick done /> 2. Departments and plan</span>} subtitle={data.subscription ? `${data.subscription.plan.name} plan${data.subscription.status === 'TRIALING' ? ' — free trial' : ''}.` : 'Your departments are set by your LHIMS provider.'}>
        <p className="text-sm text-slate-600">{modules.length} departments are switched on. Add more, or choose how you will pay, under Subscription &amp; Billing.</p>
        <div className="mt-3"><Button variant="secondary" onClick={() => navigate('subscription')}>Open Subscription &amp; Billing</Button></div>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Tick done={step.staff.done} /> 3. Staff accounts</span>} subtitle={`${data.counts.users} active account${data.counts.users === 1 ? '' : 's'} so far.`}>
        <p className="text-sm text-slate-600">Create an account for each person — doctors, nurses, reception, lab, pharmacy, cashiers. Each sees only the screens for their job.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('users')}>Add staff</Button>
          <Button variant="ghost" onClick={() => navigate('roles')}>Custom roles</Button>
        </div>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Tick done={step.prices.done} /> 4. Price list</span>} subtitle={`${data.counts.prices} priced item${data.counts.prices === 1 ? '' : 's'}: consultations, lab tests, scans and procedures.`}>
        <p className="text-sm text-slate-600">Import your prices from a spreadsheet saved as CSV (columns: code, name, type = SERVICE, LAB or SCAN, price, and optionally sampleType, modality, tariffCode). Items with a code you already have are updated.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={importing} onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" /> {importing ? 'Importing…' : 'Import CSV file'}</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={chooseCsv} aria-label="Price list CSV file" />
          <Button variant="ghost" onClick={downloadTemplate}><Download className="h-4 w-4" /> Download template</Button>
          <Button variant="ghost" disabled={importing} onClick={() => importRows(starter, 'Starter price list')}><Sparkles className="h-4 w-4" /> Add a starter list ({starter.length} items)</Button>
          <Button variant="ghost" onClick={() => navigate('price-catalog')}><ListChecks className="h-4 w-4" /> Price Catalog</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">The starter list has example prices only — set your own in Price Catalog after adding it.</p>
        {importErrors.length > 0 && (
          <div role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold">Nothing was imported. Fix these rows and try again:</p>
            <ul className="mt-1 list-disc pl-5">
              {importErrors.slice(0, 20).map((e, i) => <li key={`${e.field}-${i}`}>{e.field ? `${e.field.replace('rows.', 'Row ')}: ` : ''}{e.message}</li>)}
            </ul>
            {importErrors.length > 20 && <p className="mt-1">…and {importErrors.length - 20} more.</p>}
          </div>
        )}
      </Card>

      <Card title={<span className="flex items-center gap-2"><Tick done={step['first-patient'].done} /> 5. Your first patient</span>} subtitle="Register a patient and open a visit to see the whole flow.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate(modules.includes('reception') ? 'reception-walkins' : 'patients')}>Register a patient</Button>
          {modules.includes('opd') && <Button variant="ghost" onClick={() => navigate('opd-queue')}>Then open a visit in OPD Visits</Button>}
        </div>
      </Card>

      <Card title="Your data" subtitle="Everything this facility holds in LHIMS, as one file.">
        <p className="text-sm text-slate-600">Download a complete copy for your own records, to move to another system, or to answer a patient's data request under the Data Protection Act. Passwords and payment details are left out. Each download is recorded in the audit log.</p>
        <div className="mt-3"><Button variant="secondary" onClick={downloadExport} disabled={exporting}><Download className="h-4 w-4" /> {exporting ? 'Preparing…' : 'Download all data (JSON)'}</Button></div>
      </Card>

      {!data.completed && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!step.profile.done && <span className="text-sm text-slate-500">Save your phone and address to finish.</span>}
          <Button onClick={finish} disabled={!step.profile.done}><CheckCircle2 className="h-4 w-4" /> Finish setup</Button>
        </div>
      )}
    </div>
  );
}
