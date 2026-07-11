import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const requiredFiles = [
  'src/api/config.js',
  'src/api/apiClient.js',
  'src/api/endpointMap.js',
  'src/services/authService.js',
  'src/services/patientService.js',
  'src/services/doctorService.js',
  'src/services/orderService.js',
  'src/services/receptionService.js',
  'src/services/labService.js',
  'src/services/scanService.js',
  'src/services/billingService.js',
  'src/services/financeService.js',
  'src/services/adminService.js',
  'src/services/resultService.js',
  'src/services/reportService.js',
  'src/services/notificationService.js',
  'src/services/fileService.js',
  'docs/frontend-stage-12-live-api-integration.md'
];

const requiredMarkers = [
  ['package.json', 'lint:live-api'],
  ['.env.example', 'VITE_API_MODE=live'],
  ['.env.example', 'VITE_API_BASE_URL=http://localhost:5000/api'],
  ['src/api/config.js', 'VITE_API_BASE_URL'],
  ['src/api/config.js', 'API_TOKEN_STORAGE_KEY'],
  ['src/api/apiClient.js', "credentials: 'include'"],
  ['src/api/apiClient.js', 'unwrapApiEnvelope'],
  ['src/api/apiClient.js', 'loginRequest'],
  ['src/api/endpointMap.js', 'GET /access/route-contracts'],
  ['src/api/endpointMap.js', 'POST /doctor/orders'],
  ['src/api/endpointMap.js', 'POST /reception/walk-ins'],
  ['src/api/endpointMap.js', 'POST /lab/results'],
  ['src/api/endpointMap.js', 'POST /scan/results'],
  ['src/api/endpointMap.js', 'POST /billing/invoices/:id/payments'],
  ['src/api/endpointMap.js', 'GET /finance/analytics'],
  ['src/api/endpointMap.js', 'GET /reports/dashboard'],
  ['src/api/endpointMap.js', 'GET /files/dicom/studies'],
  ['src/services/index.js', 'receptionService'],
  ['src/hooks/useApiReadiness.js', 'hasActiveSession'],
  ['src/pages/system/ApiReadinessPage.jsx', 'API Integration Console']
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing file: ${file}`);
}
for (const [file, marker] of requiredMarkers) {
  if (!existsSync(file)) {
    failures.push(`Missing marker file: ${file}`);
    continue;
  }
  const content = readFileSync(file, 'utf8');
  if (!content.includes(marker)) failures.push(`Missing marker ${marker} in ${file}`);
}

const result = {
  phase: 'Frontend Stage 12 - Live API Integration Ready',
  passed: failures.length === 0,
  checkedAt: new Date().toISOString(),
  checks: requiredFiles.length + requiredMarkers.length,
  failures
};
writeFileSync('docs/frontend-stage-12-live-api-qa-results.json', `${JSON.stringify(result, null, 2)}\n`);

if (failures.length) {
  console.error('Frontend live API integration static check failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Frontend live API integration static check passed.');
