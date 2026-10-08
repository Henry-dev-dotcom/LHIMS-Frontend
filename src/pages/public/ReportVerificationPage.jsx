import { ShieldCheck, AlertTriangle, QrCode } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime } from '../../utils/formatters';
import { getPatientPortalUrl, getQrCodeUrl, getReportVerificationUrl } from '../../utils/reporting';

function getSecureId() {
  const match = String(window.location.hash || '').match(/verify-report\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function maskName(name = '') {
  return name.split(' ').filter(Boolean).map((part) => `${part[0] || ''}***`).join(' ') || 'Masked patient';
}

export function ReportVerificationPage() {
  const { state } = useAppStore();
  const secureId = getSecureId();
  const result = (state.data.results || []).find((item) => item.secureId === secureId || item.id === secureId);
  const order = (state.data.orders || []).find((item) => item.id === result?.orderId);
  const patient = (state.data.patients || []).find((item) => item.id === order?.patientId);
  const valid = Boolean(result?.reportHash && result?.signatureStatus === 'Signed');
  const verificationUrl = getReportVerificationUrl(result || { secureId });

  return (
    <main className="public-ambient min-h-screen px-3 py-4 text-slate-900 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <Card title="Report Verification" subtitle="Public read-only integrity check for reports issued through CurataMed." actions={valid ? <ShieldCheck className="h-6 w-6 text-emerald-600" /> : <AlertTriangle className="h-6 w-6 text-amber-600" />}>
          {result ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                  <img className="mx-auto h-28 w-28 rounded-xl sm:h-36 sm:w-36" src={getQrCodeUrl(verificationUrl)} alt="Verification QR" />
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500"><QrCode className="mr-1 inline h-3 w-3" /> Secure QR</p>
                </div>
                <div className="space-y-3">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Verification Status</p><StatusBadge status={valid ? 'Authentic / Signed' : 'Not fully signed'} /></div>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Patient</p><p className="text-lg font-bold">{maskName(patient?.fullName)}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Report</p><p className="font-mono text-sm font-bold">{result.id} · {result.orderId}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Signed By</p><p className="font-bold">{result.signedBy || result.approvedBy || 'Unsigned'} · {formatDateTime(result.signedAt || result.approvedAt)}</p></div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Tamper-evident hash</p>
                <p className="mt-2 break-all font-mono text-xs font-semibold">{result.reportHash || 'No report hash generated yet.'}</p>
              </div>
              <div className="rounded-2xl bg-clinical-50 p-4 text-sm font-semibold text-clinical-800">
                Clinical values are hidden on this public verification page. Use the secure patient portal or contact the referring doctor/reception to view the full report.
              </div>
              <Button className="w-full sm:w-auto" onClick={() => { const target = getPatientPortalUrl(result).split('#')[1]; window.location.hash = target ? `#${target}` : '#/'; window.location.reload(); }}>Open Secure Patient Portal</Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 p-5 text-sm font-semibold text-amber-800">No report was found for secure ID <span className="font-mono">{secureId || 'missing'}</span>. Confirm the QR code or secure link and try again.</div>
          )}
        </Card>
        <div className="text-center"><Button className="w-full sm:w-auto" variant="secondary" onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>Return to system login</Button></div>
      </div>
    </main>
  );
}
