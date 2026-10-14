import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const files = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? files(full) : [full];
});

const sourceFiles = files('src').filter((file) => /\.(jsx|js)$/.test(file));
const visibleSource = sourceFiles
  .filter((file) => !file.includes('/api/') && !file.includes('/services/'))
  .map((file) => [file, read(file)]);

const forbiddenVisibleMarkers = [
  'FRONTEND STABILIZED',
  'PRE-BACKEND',
  'PRE-BACKEND QA',
  'Clinical operations workspace',
  'Same flow as SUNKWA HTML'
];

const failures = [];
for (const [file, text] of visibleSource) {
  for (const marker of forbiddenVisibleMarkers) {
    if (text.includes(marker)) failures.push(`${file} contains visible shell/development marker: ${marker}`);
  }
}

const header = read('src/layouts/Header.jsx');
if (header.includes('currentPageLabel') || header.includes('getRoleLabel') || header.includes('NAV_ITEMS')) {
  failures.push('src/layouts/Header.jsx still contains old workspace-label logic.');
}
if (!header.includes('PAGE_HEADER_EVENT') || !header.includes('pageHeader')) {
  failures.push('src/layouts/Header.jsx is not using the global page-header layout.');
}

const metricCard = read('src/components/ui/MetricCard.jsx');
if (!metricCard.includes('compact = true') || !metricCard.includes('min-h-[4.5rem]')) {
  failures.push('src/components/ui/MetricCard.jsx does not contain the compact Stage 17 sizing.');
}

const doctorActive = read('src/pages/doctor/DoctorActiveOrdersPage.jsx');
if (!doctorActive.includes('rounded-2xl border border-slate-200 bg-white p-3 shadow-xs')) {
  failures.push('Doctor active-order summary cards were not reduced.');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Stage 16 shell header and stat card refinement check passed.');
