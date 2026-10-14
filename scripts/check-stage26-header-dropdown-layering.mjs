import fs from 'node:fs';

const header = fs.readFileSync('src/layouts/Header.jsx', 'utf8');
const notificationDrawer = fs.readFileSync('src/components/ui/NotificationDrawer.jsx', 'utf8');
const modal = fs.readFileSync('src/components/ui/Modal.jsx', 'utf8');
const appShell = fs.readFileSync('src/layouts/AppShell.jsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  {
    pass: header.includes("import { createPortal } from 'react-dom';") && header.includes('createPortal(') && header.includes('document.body'),
    message: 'Header user menu must render through a React portal so it cannot sit under page content.'
  },
  {
    pass: header.includes('z-90') && header.includes('overflow-visible') && header.includes('z-130'),
    message: 'Header shell and user dropdown must use visible overflow and elevated z-index layering.'
  },
  {
    pass: header.includes('userDropdownRef') && header.includes('getBoundingClientRect') && header.includes('User session menu'),
    message: 'User menu must have its own outside-click ref and fixed viewport positioning.'
  },
  {
    pass: notificationDrawer.includes('createPortal(') && notificationDrawer.includes('document.body') && notificationDrawer.includes('z-130') && !notificationDrawer.includes('lg:absolute'),
    message: 'Notification drawer must be portal-rendered and fixed above the page, not absolute inside the header.'
  },
  {
    pass: appShell.includes('relative z-0') && modal.includes('z-150'),
    message: 'Main page and modal stacking order must keep header menus above content while preserving modal priority.'
  },
  {
    pass: /^12\.(1[6-9]|[2-9][0-9])\.0$/.test(pkg.version),
    message: 'Frontend version must be bumped to Stage 26 or newer.'
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error('Stage 26 header dropdown layering QA failed:');
  for (const item of failed) console.error(`- ${item.message}`);
  process.exit(1);
}

console.log('Stage 26 header dropdown layering QA passed.');
