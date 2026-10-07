import { formatDateTime, money } from './formatters';
import { getStoredSession } from '../api/config';
import { armPrintButtons } from './printDocument';

/**
 * The name at the top of anything printed: the facility's own, since the report
 * is theirs. Falls back to the product name on public pages with no session.
 */
export function reportBrand() {
  try {
    return getStoredSession()?.user?.facility?.name || 'CurataMed';
  } catch {
    return 'CurataMed';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function formatFileSize(size = 0) {
  const value = Number(size || 0);
  if (!value) return '0 KB';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function openReportPrintWindow(input) {
  const order = input.order || input;
  const patient = input.patient || order.patient;
  const doctor = input.doctor || order.doctor;
  const hospital = input.hospital || order.hospital;
  const items = input.items || order.items || [];
  const results = input.results || order.results || [];
  const invoice = input.invoice || order.invoice;
  const resultReport = input.resultReport || order.resultReport;

  const rows = results.flatMap((result) => {
    if (result.parameters?.length) {
      return result.parameters.map((parameter) => `
        <tr>
          <td>${escapeHtml(result.department)}</td>
          <td>${escapeHtml(parameter.name)}</td>
          <td>${escapeHtml(parameter.value)} ${escapeHtml(parameter.unit)}</td>
          <td>${escapeHtml(parameter.referenceRange)}</td>
          <td class="${parameter.flag === 'Normal' ? 'normal' : 'abnormal'}">${escapeHtml(parameter.flag || '—')}</td>
        </tr>`);
    }
    return [`
      <tr>
        <td>${escapeHtml(result.department)}</td>
        <td colspan="3">${escapeHtml(result.reportText || 'Report attached')}</td>
        <td class="normal">Final</td>
      </tr>`];
  }).join('');

  const html = `<!doctype html>
  <html><head><title>${escapeHtml(order.id)} Report</title><style>
  body{font-family:Inter,Arial,sans-serif;margin:40px;color:#0f172a}.letterhead{border-bottom:4px solid #0ea5e9;padding-bottom:18px;margin-bottom:24px}.brand{font-size:28px;font-weight:900;color:#0369a1}.muted{color:#64748b;font-size:13px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}.box{border:1px solid #e2e8f0;border-radius:16px;padding:14px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #e2e8f0;padding:10px;text-align:left;font-size:13px}th{background:#f8fafc;text-transform:uppercase;font-size:11px;color:#64748b}.abnormal{color:#dc2626;font-weight:800}.normal{color:#059669;font-weight:800}.footer{margin-top:32px;font-size:12px;color:#64748b}@media print{button{display:none}body{margin:24px}}</style></head>
  <body>
    <button data-print style="float:right;padding:10px 16px;border:0;border-radius:12px;background:#0284c7;color:white;font-weight:800">Print / Save as PDF</button>
    <div class="letterhead"><div class="brand">${escapeHtml(reportBrand())}</div><div class="muted">Final diagnostic report · ${escapeHtml(order.id)}${resultReport?.id ? ` · Report ${escapeHtml(resultReport.id)}` : ''}</div></div>
    <div class="grid">
      <div class="box"><strong>Patient</strong><br>${escapeHtml(patient?.fullName)}<br><span class="muted">${escapeHtml(patient?.id)} · ${escapeHtml(patient?.gender)} · DOB ${escapeHtml(patient?.dateOfBirth)}</span></div>
      <div class="box"><strong>Referring Doctor</strong><br>${escapeHtml(doctor?.name)}<br><span class="muted">${escapeHtml(doctor?.specialty)} · License ${escapeHtml(doctor?.licenseNumber)}</span></div>
      <div class="box"><strong>Hospital</strong><br>${escapeHtml(hospital?.name)}<br><span class="muted">Billing: ${escapeHtml(hospital?.billingContact)}</span></div>
      <div class="box"><strong>Order Details</strong><br>${escapeHtml(items.map((item) => item.name).join(', '))}<br><span class="muted">Released: ${escapeHtml(formatDateTime(order.updatedAt))} · Invoice: ${escapeHtml(money(invoice?.amount || 0))}</span></div>
    </div>
    <h2>Results</h2>
    <table><thead><tr><th>Department</th><th>Parameter / Report</th><th>Value</th><th>Reference Range</th><th>Flag</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No final result parameters available.</td></tr>'}</tbody></table>
    <div class="footer">Generated from CurataMed.${resultReport?.secureToken ? ` Secure report token: ${escapeHtml(resultReport.secureToken)}.` : ''} SMS notifications must not include patient-identifying clinical data.</div>
  </body></html>`;
  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  armPrintButtons(win);
}

export function getReportVerificationUrl(result = {}) {
  const secureId = result.secureId || result.id || 'UNSIGNED';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  return `${origin}${pathname}#/verify-report/${encodeURIComponent(secureId)}`;
}

export function getPatientPortalUrl(result = {}) {
  const secureId = result.secureId || result.id || 'UNSIGNED';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  return `${origin}${pathname}#/patient/results/${encodeURIComponent(secureId)}`;
}

export function getQrCodeUrl(value = '') {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(value)}`;
}

export function openLabResultPdfWindow({ data, result }) {
  const order = (data.orders || []).find((item) => item.id === result?.orderId);
  const patient = (data.patients || []).find((item) => item.id === order?.patientId);
  const doctor = (data.doctors || []).find((item) => item.id === order?.doctorId);
  const hospital = (data.hospitals || []).find((item) => item.id === order?.hospitalId);
  const items = (order?.itemIds || []).map((itemId) => (data.catalog || []).find((item) => item.id === itemId)).filter(Boolean);
  const verificationUrl = getReportVerificationUrl(result);
  const patientPortalUrl = getPatientPortalUrl(result);
  const qrUrl = getQrCodeUrl(verificationUrl);

  const rows = (result?.parameters || []).map((parameter) => `
    <tr>
      <td>${escapeHtml(parameter.testName || parameter.testId)}</td>
      <td>${escapeHtml(parameter.name)}</td>
      <td><strong>${escapeHtml(parameter.value)} ${escapeHtml(parameter.unit)}</strong></td>
      <td>${escapeHtml(parameter.referenceRange)}</td>
      <td class="${['High','Low','Critical'].includes(parameter.flag) ? 'abnormal' : 'normal'}">${escapeHtml(parameter.flag || '—')}</td>
    </tr>`).join('');
  const attachmentRows = (result?.files || []).map((file) => `
    <tr>
      <td>${escapeHtml(file.testName || 'Laboratory')}</td>
      <td>${escapeHtml(file.name || file.fileName || 'Imported document')}</td>
      <td>${escapeHtml(file.type || file.fileType || 'Document')}</td>
      <td>${escapeHtml(formatFileSize(file.size || file.fileSize))}</td>
      <td>${escapeHtml(formatDateTime(file.uploadedAt))}</td>
    </tr>`).join('');

  const html = `<!doctype html>
  <html><head><title>${escapeHtml(result?.id || 'Lab Report')} PDF</title><style>
  body{font-family:Inter,Arial,sans-serif;margin:34px;color:#0f172a}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:4px solid #0ea5e9;padding-bottom:16px}.brand{font-size:27px;font-weight:900;color:#0369a1}.muted{color:#64748b;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.box{border:1px solid #e2e8f0;border-radius:14px;padding:12px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #e2e8f0;padding:9px;text-align:left;font-size:12px;vertical-align:top}th{background:#f8fafc;text-transform:uppercase;font-size:10px;color:#64748b}.abnormal{color:#dc2626;font-weight:900}.normal{color:#059669;font-weight:900}.signature{display:grid;grid-template-columns:1fr 220px;gap:16px;margin-top:24px}.sigbox{border:1px solid #cbd5e1;border-radius:14px;min-height:120px;padding:12px}.sigbox img{max-height:72px;max-width:100%}.integrity{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;word-break:break-all}.qr{text-align:center}.qr img{width:150px;height:150px}.footer{margin-top:20px;font-size:11px;color:#64748b}.button{float:right;padding:10px 16px;border:0;border-radius:12px;background:#0284c7;color:white;font-weight:900}@media print{.button{display:none}body{margin:20px}.box{break-inside:avoid}}</style></head>
  <body>
    <button class="button" data-print>Generate PDF / Save</button>
    <div class="top"><div><div class="brand">${escapeHtml(reportBrand())}</div><div class="muted">Official laboratory report · ${escapeHtml(result?.id)} · ${escapeHtml(order?.id)}</div></div><div class="qr"><img src="${escapeHtml(qrUrl)}" alt="QR verification code"><div class="muted">Scan to verify</div></div></div>
    <div class="grid">
      <div class="box"><strong>Patient</strong><br>${escapeHtml(patient?.fullName)}<br><span class="muted">${escapeHtml(patient?.id)} · ${escapeHtml(patient?.gender)} · DOB ${escapeHtml(patient?.dateOfBirth)}</span></div>
      <div class="box"><strong>Referring Doctor</strong><br>${escapeHtml(doctor?.name)}<br><span class="muted">${escapeHtml(doctor?.specialty)} · ${escapeHtml(hospital?.name)}</span></div>
      <div class="box"><strong>Requested Tests</strong><br>${escapeHtml(items.filter((item) => item.department === 'Laboratory').map((item) => item.name).join(', ') || 'Laboratory panel')}<br><span class="muted">Urgency: ${escapeHtml(order?.urgency || 'Routine')}</span></div>
      <div class="box"><strong>Report Status</strong><br>${escapeHtml(result?.status)}<br><span class="muted">Signed: ${escapeHtml(formatDateTime(result?.signedAt || result?.approvedAt))}</span></div>
    </div>
    <h2>Laboratory Results</h2>
    <table><thead><tr><th>Test</th><th>Parameter</th><th>Value</th><th>Reference Range</th><th>Flag</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No structured result values available.</td></tr>'}</tbody></table>
    ${attachmentRows ? `<h2>Imported Result Documents</h2><table><thead><tr><th>Test</th><th>File</th><th>Type</th><th>Size</th><th>Imported</th></tr></thead><tbody>${attachmentRows}</tbody></table>` : ''}
    ${result?.reportText ? `<div class="box"><strong>Report Comment</strong><br>${escapeHtml(result.reportText).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="signature">
      <div class="sigbox"><strong>Digital Signature</strong><br>${result?.digitalSignature ? `<img src="${escapeHtml(result.digitalSignature)}" alt="Digital signature">` : '<span class="muted">No signature captured.</span>'}<br><span class="muted">${escapeHtml(result?.signedBy || result?.approvedBy || 'Unsigned')} · ${escapeHtml(formatDateTime(result?.signedAt || result?.approvedAt))}</span></div>
      <div class="sigbox"><strong>Integrity</strong><p class="integrity">Hash: ${escapeHtml(result?.reportHash || 'Pending')}</p><p class="integrity">Previous: ${escapeHtml(result?.previousHash || 'None')}</p><p class="integrity">Secure ID: ${escapeHtml(result?.secureId || 'Unsigned')}</p></div>
    </div>
    <div class="footer">Verification: ${escapeHtml(verificationUrl)}<br>Patient portal: ${escapeHtml(patientPortalUrl)}<br>SMS/WhatsApp notifications are privacy-safe and do not include clinical values or diagnosis.</div>
  </body></html>`;
  const win = window.open('', '_blank', 'width=1000,height=850');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  armPrintButtons(win);
}
