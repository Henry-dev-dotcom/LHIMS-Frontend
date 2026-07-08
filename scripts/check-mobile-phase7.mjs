import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const app = read('src/app/App.jsx');
const appShell = read('src/layouts/AppShell.jsx');
const router = read('src/routes/AppRouter.jsx');
const errorBoundary = read('src/components/ui/ErrorBoundary.jsx');
const modal = read('src/components/ui/Modal.jsx');
const sidebar = read('src/layouts/Sidebar.jsx');
const bottomNav = read('src/components/ui/MobileBottomNav.jsx');
const toast = read('src/components/ui/ToastHost.jsx');
const button = read('src/components/ui/Button.jsx');
const dataTable = read('src/components/ui/DataTable.jsx');
const css = read('src/styles/index.css');

const checks = [
  {
    pass: /^12\.(19|[2-9][0-9])\.0$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version,
    message: 'Frontend package and lockfile versions must be bumped for Phase 7.'
  },
  {
    pass: app.includes('<ErrorBoundary>') && errorBoundary.includes('componentDidCatch') && errorBoundary.includes('Reset saved state') && errorBoundary.includes('role="alert"'),
    message: 'Phase 7 must include an app-level error boundary with mobile-friendly recovery actions.'
  },
  {
    pass: appShell.includes('skip-link') && appShell.includes('tabIndex={-1}') && router.includes('main.focus({ preventScroll: true })'),
    message: 'AppShell and router must support skip-to-content and route-focus recovery.'
  },
  {
    pass: button.includes('forwardRef') && button.includes('focus-visible:ring-4'),
    message: 'Button must forward refs and use focus-visible states for modal focus management.'
  },
  {
    pass: modal.includes('aria-labelledby') && modal.includes('aria-describedby') && modal.includes('focusableSelector') && modal.includes('previouslyFocused.focus'),
    message: 'Modal must use accessible labels, tab focus trapping and focus restoration.'
  },
  {
    pass: sidebar.includes('role="dialog"') && sidebar.includes('aria-modal="true"') && sidebar.includes('closeButtonRef') && sidebar.includes("aria-current={active ? 'page' : undefined}"),
    message: 'Mobile sidebar must expose dialog semantics, focus the close button and mark active navigation.'
  },
  {
    pass: bottomNav.includes('aria-current') && bottomNav.includes('Open full navigation menu') && toast.includes("'status'") && toast.includes("'polite'"),
    message: 'Mobile bottom navigation and toasts must include accessible current-state and live-region semantics.'
  },
  {
    pass: dataTable.includes("aria-label={caption || 'Records table'}") && dataTable.includes('Show more record details'),
    message: 'DataTable must provide accessible table/card labels for mobile record browsing.'
  },
  {
    pass: css.includes('Phase 7 deployment-grade mobile accessibility') && css.includes('prefers-reduced-motion') && css.includes(':focus-visible') && css.includes('.skip-link'),
    message: 'Global CSS must include Phase 7 focus, skip-link and reduced-motion guardrails.'
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error('Phase 7 mobile deployment QA failed:');
  for (const item of failed) console.error(`- ${item.message}`);
  process.exit(1);
}

console.log('Phase 7 mobile deployment QA passed.');
