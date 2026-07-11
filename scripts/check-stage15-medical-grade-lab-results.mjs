import fs from 'node:fs';

const requiredFiles = [
  'src/pages/lab/LabResultsPage.jsx',
  'src/pages/public/ReportVerificationPage.jsx',
  'src/pages/public/PatientPortalAccessPage.jsx',
  'src/utils/reporting.js',
  'src/store/AppStore.jsx'
];

const requiredMarkers = [
  ['src/pages/lab/LabResultsPage.jsx', 'VersionTimelineModal'],
  ['src/pages/lab/LabResultsPage.jsx', 'CompareChangesModal'],
  ['src/pages/lab/LabResultsPage.jsx', 'SignatureModal'],
  ['src/pages/lab/LabResultsPage.jsx', 'openLabResultPdfWindow'],
  ['src/pages/lab/LabResultsPage.jsx', 'getQrCodeUrl'],
  ['src/store/commands.js', 'SIGN_LAB_RESULT_WITH_SIGNATURE'],
  ['src/pages/lab/LabResultsPage.jsx', 'reportHash'],
  ['src/api/normalizers.js', 'versionHistory'],
  ['src/pages/lab/LabResultsPage.jsx', 'Needs re-sign after correction'],
  ['src/utils/reporting.js', 'getReportVerificationUrl'],
  ['src/utils/reporting.js', 'getPatientPortalUrl'],
  ['src/utils/reporting.js', 'openLabResultPdfWindow'],
  ['src/pages/public/ReportVerificationPage.jsx', 'ReportVerificationPage'],
  ['src/pages/public/PatientPortalAccessPage.jsx', 'PatientPortalAccessPage']
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
}

for (const [file, marker] of requiredMarkers) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(marker)) {
    console.error(`Missing marker ${marker} in ${file}`);
    process.exit(1);
  }
}

console.log('Stage 15 medical-grade lab result security static check passed.');
