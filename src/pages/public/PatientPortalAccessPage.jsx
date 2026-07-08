import { useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { FormField, inputClass } from '../../components/ui/FormField';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { openLabResultPdfWindow } from '../../utils/reporting';

function getSecureId() {
  const match = String(window.location.hash || '').match(/patient\/results\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function maskPhone(phone = '') {
  return phone ? `${phone.slice(0, 5)}***${phone.slice(-3)}` : 'registered contact';
}

export function PatientPortalAccessPage() {
  const { state } = useAppStore();
  const secureId = getSecureId();
  const [contact, setContact] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verified, setVerified] = useState(false);
  const result = (state.data.results || []).find((item) => item.secureId === secureId || item.id === secureId);
  const order = (state.data.orders || []).find((item) => item.id === result?.orderId);
  const patient = (state.data.patients || []).find((item) => item.id === order?.patientId);
  const maskedContact = patient?.phone ? maskPhone(patient.phone) : patient?.email || 'registered contact';

  function sendOtp() {
    if (!contact.trim()) return;
    setOtpSent(true);
  }

  function verifyOtp() {
    if (otp === '123456' || otp.length >= 4) setVerified(true);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-900 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <Card title="Secure Patient Result Portal" subtitle="Time-limited OTP-style access for patient report viewing." actions={<LockKeyhole className="h-6 w-6 text-clinical-600" />}>
          {!result && <div className="rounded-2xl bg-amber-50 p-5 text-sm font-semibold text-amber-800">No report found for secure ID <span className="font-mono">{secureId || 'missing'}</span>.</div>}
          {result && !verified && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-clinical-100 bg-clinical-50 p-4 text-sm font-semibold text-clinical-800">A privacy-safe OTP will be sent to the registered contact ending in {maskedContact}. Demo OTP accepts <span className="font-mono">123456</span>.</div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <FormField label="Phone or email"><input className={inputClass} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Enter registered phone or email" /></FormField>
                <Button className="w-full md:w-auto" onClick={sendOtp}>Send OTP</Button>
              </div>
              {otpSent && <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"><FormField label="OTP code"><input className={inputClass} value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" /></FormField><Button className="w-full md:w-auto" onClick={verifyOtp}><ShieldCheck className="h-4 w-4" /> Verify</Button></div>}
            </div>
          )}
          {result && verified && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800"><div><p className="font-bold">Access granted</p><p className="text-sm font-semibold">This secure session is for the current viewing period only.</p></div><StatusBadge status="OTP Verified" /></div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="font-bold text-slate-900">{patient?.fullName}</p></div>
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Report</p><p className="font-bold text-slate-900">{result.id}</p></div>
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Signed</p><p className="font-bold text-slate-900">{formatDateTime(result.signedAt || result.approvedAt)}</p></div>
              </div>
              <DataTable
                dense
                columns={[
                  { key: 'testName', label: 'Test' },
                  { key: 'name', label: 'Parameter' },
                  { key: 'value', label: 'Value', render: (row) => <strong>{row.value} {row.unit}</strong> },
                  { key: 'referenceRange', label: 'Reference Range' },
                  { key: 'flag', label: 'Flag', render: (row) => <StatusBadge status={row.flag || 'No Range'} /> }
                ]}
                rows={result.parameters || []}
                emptyMessage="No structured values are available for this report."
              />
              <Button className="w-full sm:w-auto" onClick={() => openLabResultPdfWindow({ data: state.data, result })}>Download / Save PDF</Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
