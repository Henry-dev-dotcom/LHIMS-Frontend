import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Link2, Mail, RefreshCw, ShieldCheck, Trash2, UserRoundPlus, UserX } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField, inputClass } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../store/AppStore';
import { apiClient } from '../../store/commands';
import { vendorPortalService } from '../../services/vendorPortalService';

export function VendorPortalAdminPage() {
  const { dispatch } = useAppStore();
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '' });
  const [invitation, setInvitation] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const toast = useCallback((type, message) => dispatch({ type: 'SHOW_TOAST', toast: { type, message } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const partners = await vendorPortalService.listPartners(apiClient);
      setPartner(partners.find((item) => item.code === 'GUSTAV_BIOMED') || partners[0] || null);
    } catch (requestError) {
      setError(requestError?.message || 'Vendor access could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createInvite = async (event) => {
    event.preventDefault();
    if (!partner) return;
    setSaving(true);
    setError('');
    setInvitation(null);
    try {
      const result = await vendorPortalService.createInvitation(apiClient, partner.id, form);
      setInvitation(result);
      setForm({ fullName: '', email: '' });
      toast('success', 'One-time vendor setup link created. Share it securely.');
      await load();
    } catch (requestError) {
      setError(requestError?.message || 'The invitation could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!invitation?.setupUrl) return;
    try {
      await navigator.clipboard.writeText(invitation.setupUrl);
      setNotice('Invitation link copied. Share it only with the intended account holder.');
    } catch {
      setNotice('Copy was blocked by this browser. Select and copy the invitation link below.');
    }
  };

  const changeUserStatus = async (user) => {
    const next = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (next === 'INACTIVE' && !window.confirm(`Deactivate ${user.fullName} and revoke their active vendor sessions?`)) return;
    try {
      await vendorPortalService.setUserStatus(apiClient, user.id, next);
      toast('success', `${user.fullName} is now ${next.toLowerCase()}.`);
      await load();
    } catch (requestError) {
      toast('error', requestError?.message || 'Vendor access could not be changed.');
    }
  };

  const openDeleteConfirmation = (user) => {
    setPendingDelete(user);
    setDeleteConfirmation('');
    setError('');
  };

  const deleteUser = async (event) => {
    event.preventDefault();
    if (!pendingDelete || deleteConfirmation.trim().toLowerCase() !== pendingDelete.email.toLowerCase()) return;
    setDeleting(true);
    try {
      await vendorPortalService.deleteUser(apiClient, pendingDelete.id);
      toast('success', 'Vendor login removed. Request and audit history were retained.');
      setPendingDelete(null);
      setDeleteConfirmation('');
      await load();
    } catch (requestError) {
      toast('error', requestError?.message || 'The vendor account could not be deleted.');
    } finally {
      setDeleting(false);
    }
  };

  const deleteMatches = Boolean(pendingDelete && deleteConfirmation.trim().toLowerCase() === pendingDelete.email.toLowerCase());

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Platform · Partner access"
        title="Gustav Biomed portal access"
        description="Issue a time-limited setup link, suspend access, or remove a vendor login while keeping its business history."
        actions={<Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>}
      />
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p>Vendor accounts can see only requests assigned to Gustav Biomed across facilities. They cannot access patient records, internal facility notes, or unrelated vendors’ requests. Status changes are limited to acknowledge, schedule, complete, or decline.</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card title="Partner profile" subtitle={loading ? 'Loading…' : partner?.code || 'Partner unavailable'}>
          {partner ? (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-bold text-slate-950">{partner.name}</p>
                <p className="mt-1 text-sm text-slate-600">Company contact: <a className="font-semibold text-clinical-800 hover:underline" href={`tel:${(partner.contactPhone || '').replace(/\s+/g, '')}`}>{partner.contactPhone || 'Not provided'}</a></p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-bold ${partner.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{partner.isActive ? 'Portal active' : 'Portal paused'}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{partner.users?.length || 0} account{partner.users?.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          ) : <p className="text-sm text-slate-500">{loading ? 'Loading partner profile…' : 'No active Gustav Biomed partner profile was found.'}</p>}
        </Card>

        <Card title="Invite the account holder" subtitle="A setup link expires after 24 hours and is shown only once.">
          <form onSubmit={createInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" required>
                <input className={inputClass} maxLength={120} required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Account holder’s name" />
              </FormField>
              <FormField label="Work email" required help="This becomes the sign-in email.">
                <input className={inputClass} type="email" maxLength={254} required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@company.com" />
              </FormField>
            </div>
            <Button type="submit" disabled={!partner?.isActive || saving || !form.fullName.trim() || !form.email.trim()}><UserRoundPlus className="h-4 w-4" />{saving ? 'Creating link…' : 'Create one-time setup link'}</Button>
          </form>
          {invitation && (
            <div className="mt-5 rounded-2xl border border-clinical-200 bg-clinical-25 p-4">
              <p className="flex items-center gap-2 font-bold text-clinical-950"><Link2 className="h-4 w-4" />Link ready for {invitation.fullName}</p>
              <p className="mt-1 text-xs text-clinical-900">For {invitation.email} · expires {new Date(invitation.expiresAt).toLocaleString()}</p>
              <div className="mt-3 break-all rounded-xl border border-clinical-100 bg-white p-3 font-mono text-xs text-slate-700">{invitation.setupUrl}</div>
              <Button className="mt-3" size="sm" onClick={copyLink}><Copy className="h-4 w-4" />Copy setup link</Button>
              <a className="ml-3 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-clinical-800 hover:underline" href={invitation.setupUrl} target="_blank" rel="noreferrer">Open link <ExternalLink className="h-3.5 w-3.5" /></a>
              <p className="mt-3 text-xs leading-5 text-slate-600">This link is a secret credential until it is redeemed. Send it directly to the intended account holder; do not post it in a shared channel.</p>
            </div>
          )}
          {partner?.invites?.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Outstanding invitations</p>
              <ul className="space-y-2">
                {partner.invites.map((invite) => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="font-semibold text-slate-800">{invite.fullName} · {invite.email}</span><span className="text-slate-500">expires {new Date(invite.expiresAt).toLocaleDateString()}</span></li>)}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card title="Vendor accounts" subtitle="Deleting removes the login, revokes sessions, and expires outstanding invitations. Vendor requests and audit history remain.">
        {!partner?.users?.length ? (
          <p className="text-sm text-slate-500">No vendor accounts have been activated yet. Create a setup link for the verified account holder.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {partner.users.map((user) => (
              <div key={user.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">{user.fullName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600"><Mail className="h-3.5 w-3.5" />{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.lastLoginAt ? `Last sign-in ${new Date(user.lastLoginAt).toLocaleString()}` : 'Has not signed in yet'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{user.status}</span>
                  <Button size="sm" variant={user.status === 'ACTIVE' ? 'secondary' : 'primary'} onClick={() => changeUserStatus(user)}>{user.status === 'ACTIVE' ? <><UserX className="h-4 w-4" />Deactivate</> : 'Reactivate'}</Button>
                  <Button size="sm" variant="danger" onClick={() => openDeleteConfirmation(user)}><Trash2 className="h-4 w-4" />Delete account</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(pendingDelete)}
        title="Delete vendor account?"
        description={pendingDelete ? `This permanently removes the sign-in for ${pendingDelete.fullName}. Active sessions are revoked and unused setup links are expired. Existing request records and audit history are retained.` : undefined}
        onClose={() => { if (!deleting) { setPendingDelete(null); setDeleteConfirmation(''); } }}
        footer={pendingDelete && <>
          <Button variant="secondary" onClick={() => { setPendingDelete(null); setDeleteConfirmation(''); }} disabled={deleting}>Cancel</Button>
          <Button variant="danger" type="submit" form="delete-vendor-account-form" disabled={!deleteMatches || deleting}><Trash2 className="h-4 w-4" />{deleting ? 'Deleting…' : 'Delete account permanently'}</Button>
        </>}
      >
        {pendingDelete && <form id="delete-vendor-account-form" onSubmit={deleteUser} className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/70 p-3 text-sm leading-6 text-rose-950">
            <Trash2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>Type the account email exactly to confirm: <strong className="break-all">{pendingDelete.email}</strong></p>
          </div>
          <FormField label="Account email confirmation" required help="This step prevents accidental removal of the vendor login.">
            <input className={inputClass} type="email" autoComplete="off" spellCheck={false} required value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />
          </FormField>
        </form>}
      </Modal>
    </div>
  );
}
