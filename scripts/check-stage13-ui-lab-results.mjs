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

const forbidden = [
  'FRONTEND STABILIZED',
  'PRE-BACKEND',
  'Same flow as SUNKWA HTML',
  'Phase 5 —',
  'Phase 6 —',
  'Phase 7 —',
  'Phase 8 —',
  'Business Stage'
];

const failures = [];
for (const [file, text] of visibleSource) {
  for (const needle of forbidden) {
    if (text.includes(needle)) failures.push(`${file} contains visible dev marker: ${needle}`);
  }
}

const checks = [
  ['src/pages/lab/LabResultsPage.jsx', 'Laboratory result archive'],
  ['src/data/roles.js', "id: 'lab-results'"],
  ['src/routes/AppRouter.jsx', 'LabResultsPage'],
  ['src/routes/routeRegistry.js', "'lab-results'"],
  ['src/store/commands.js', 'UPDATE_LAB_RESULT_ARCHIVE'],
  ['src/store/commands.js', 'Laboratory result corrected']
];

for (const [file, needle] of checks) {
  if (!read(file).includes(needle)) failures.push(`${file} missing ${needle}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Stage 13 UI cleanup and laboratory results archive check passed.');
