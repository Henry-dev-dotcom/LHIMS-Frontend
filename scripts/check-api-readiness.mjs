import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/api/apiClient.js',
  'src/api/config.js',
  'src/api/endpointMap.js',
  'src/api/normalizers.js',
  'src/store/commands.js',
  'src/store/hydrate.js',
  'src/hooks/useApiReadiness.js',
  'src/services/authService.js',
  'src/services/patientService.js',
  'src/services/doctorService.js',
  'src/services/orderService.js',
  'src/services/labService.js',
  'src/services/scanService.js',
  'src/services/billingService.js',
  'src/services/financeService.js',
  'src/services/adminService.js',
  'src/services/resultService.js',
  'src/services/reportService.js',
  'src/services/notificationService.js',
  'src/services/fileService.js',
  'src/pages/system/ApiReadinessPage.jsx'
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missingFiles.length) {
  console.error('API readiness check failed. Missing files:\n' + missingFiles.join('\n'));
  process.exit(1);
}

const allSource = requiredFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const requiredMarkers = [
  'API_MODES',
  'createApiClient',
  'endpointMap',
  'normalizePatient',
  'normalizeOrder',
  'normalizeLabResult',
  'normalizeInvoice',
  'runCommand',
  'live',
  'hydrateWorkspace',
  'VITE_API_BASE_URL',
  'useApiReadiness'
];
const missingMarkers = requiredMarkers.filter((marker) => !allSource.includes(marker));
if (missingMarkers.length) {
  console.error('API readiness check failed. Missing markers:\n' + missingMarkers.join('\n'));
  process.exit(1);
}
console.log(`API readiness check passed: ${requiredFiles.length} files and ${requiredMarkers.length} markers verified.`);
