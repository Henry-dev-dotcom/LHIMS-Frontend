import fs from 'node:fs';

const checks = [
  ['src/styles/index.css', 'clinical-panel'],
  ['src/components/ui/Button.jsx', 'shadow-lift'],
  ['src/layouts/Header.jsx', 'Sparkles'],
  ['src/layouts/Header.jsx', 'Role notifications'],
  ['src/layouts/Sidebar.jsx', 'Hospital management system'],
  ['src/components/ui/DataTable.jsx', 'md:hidden'],
  ['src/components/ui/WorkflowTimeline.jsx', 'Order workflow'],
  ['src/components/ui/NotificationDrawer.jsx', 'Delivery & role notifications'],
  ['docs/section-14-ui-ux-polish.md', 'Final UI/UX Polish']
];

const missing = [];
for (const [file, needle] of checks) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(needle)) missing.push(`${file} missing ${needle}`);
}

if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}

console.log(`UI polish check passed: ${checks.length} visual-system markers found.`);
