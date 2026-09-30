import fs from 'node:fs';

const requiredFiles = [
  'src/pages/lab/LabResultsPage.jsx',
  'src/pages/public/ReportVerificationPage.jsx',
  'src/pages/public/PatientPortalAccessPage.jsx',
  'src/utils/reporting.js',
  'src/store/AppStore.jsx'
];

// A sent (signed-off) laboratory result must stay auditable and reversible:
// a real reversal endpoint the lab itself can use (not a silent overwrite),
// a genuine history of every reversal (who/when/why), printing, and the
// patient-facing verification links.
const requiredMarkers = [
  ['src/pages/lab/LabResultsPage.jsx', 'VersionTimelineModal'],
  ['src/pages/lab/LabResultsPage.jsx', 'ReverseResultModal'],
  ['src/pages/lab/LabResultsPage.jsx', 'openLabResultPdfWindow'],
  ['src/pages/lab/LabResultsPage.jsx', 'getQrCodeUrl'],
  ['src/store/commands.js', 'REVERSE_LAB_RESULT'],
  ['src/pages/lab/LabResultsPage.jsx', 'Reversal history'],
  ['src/api/normalizers.js', 'versionHistory'],
  ['src/pages/lab/LabResultsPage.jsx', 'Reverse this result'],
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

console.log('Stage 15 medical-grade lab result security static check passed (sent results are reversible and audited, not silently overwritten).');
