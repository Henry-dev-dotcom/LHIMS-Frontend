import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pageHeader = read('src/components/ui/PageHeader.jsx');
const header = read('src/layouts/Header.jsx');
const sidebar = read('src/layouts/Sidebar.jsx');
const metricCard = read('src/components/ui/MetricCard.jsx');

const failures = [];

if (!pageHeader.includes('PAGE_HEADER_EVENT') || !pageHeader.includes('return null')) {
  failures.push('PageHeader must publish page title metadata to the global header and render no in-page hero container.');
}
if (!header.includes('PAGE_HEADER_EVENT') || !header.includes('pageHeader') || !header.includes('Sparkles')) {
  failures.push('Header must render the active page header content in the top app bar.');
}
if (sidebar.includes('accessSummary') || sidebar.includes('Search menu...') || sidebar.includes('value={query}')) {
  failures.push('Sidebar must not show the removed workspace description/search block.');
}
if (!metricCard.includes('compact = true') || !metricCard.includes('min-h-18')) {
  failures.push('Metric cards must default to compact height for the moved stat section.');
}

if (failures.length > 0) {
  console.error('Stage 17 page shell refinement check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Stage 17 page shell refinement check passed.');
