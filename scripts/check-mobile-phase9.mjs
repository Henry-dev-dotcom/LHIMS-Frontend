import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const exists = (file) => fs.existsSync(file);
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const appShell = read('src/layouts/AppShell.jsx');
const networkHook = exists('src/hooks/useNetworkStatus.js') ? read('src/hooks/useNetworkStatus.js') : '';
const networkBanner = exists('src/components/ui/NetworkStatusBanner.jsx') ? read('src/components/ui/NetworkStatusBanner.jsx') : '';
const updateBanner = exists('src/components/ui/ServiceWorkerUpdateBanner.jsx') ? read('src/components/ui/ServiceWorkerUpdateBanner.jsx') : '';
const swRegistration = read('src/utils/registerServiceWorker.js');
const sw = read('public/sw.js');
const css = read('src/styles/index.css');
const offline = read('public/offline.html');

const checks = [
  {
    pass: pkg.version === '12.21.0' && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version,
    message: 'Frontend package and lockfile versions must be bumped for Phase 9.'
  },
  {
    pass: pkg.scripts?.['lint:mobile']?.includes('check-mobile-phase9.mjs'),
    message: 'Phase 9 mobile QA script must be included in lint:mobile.'
  },
  {
    pass: appShell.includes('NetworkStatusBanner') && appShell.includes('ServiceWorkerUpdateBanner'),
    message: 'AppShell must mount the network and update banners below the mobile header.'
  },
  {
    pass: networkHook.includes('navigator.onLine') && networkHook.includes('effectiveType') && networkHook.includes('saveData') && networkHook.includes('slowConnection'),
    message: 'useNetworkStatus must track offline, slow-network and data-saver states.'
  },
  {
    pass: networkBanner.includes('role="status"') && networkBanner.includes('aria-live="polite"') && networkBanner.includes('You are offline') && networkBanner.includes('Low-bandwidth mode detected'),
    message: 'NetworkStatusBanner must expose accessible offline and low-bandwidth warnings.'
  },
  {
    pass: updateBanner.includes('diagnosis-sw-update-ready') && updateBanner.includes('SKIP_WAITING') && updateBanner.includes('Update now') && updateBanner.includes('diagnosis-sw-controller-changed'),
    message: 'ServiceWorkerUpdateBanner must expose an install/update flow for newly cached builds.'
  },
  {
    pass: swRegistration.includes('updatefound') && swRegistration.includes('diagnosis-sw-update-ready') && swRegistration.includes('controllerchange') && swRegistration.includes('diagnosis-sw-controller-changed'),
    message: 'Service worker registration must notify the UI when a new production build is ready.'
  },
  {
    pass: sw.includes('diagnosis-center-phase9-') && sw.includes("event.data?.type === 'SKIP_WAITING'") && sw.includes('url.pathname.startsWith(`${BASE_PATH}api/`)') && sw.includes('canCacheResponse') && sw.includes('response.ok'),
    message: 'Service worker must use the Phase 9 cache, support skip-waiting, avoid API caching and only cache safe responses.'
  },
  {
    pass: css.includes('Phase 9 hosted-mobile reliability') && css.includes('.mobile-system-banner') && css.includes('.mobile-keyboard-open .mobile-system-banner'),
    message: 'Global CSS must include Phase 9 mobile system-banner and keyboard guardrails.'
  },
  {
    pass: offline.includes('Reconnect and reload') && offline.includes('env(safe-area-inset-bottom)') && offline.includes('payment actions'),
    message: 'Offline fallback must be mobile safe and explain that live clinical/payment actions require network access.'
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error('Phase 9 mobile reliability QA failed:');
  for (const item of failed) console.error(`- ${item.message}`);
  process.exit(1);
}

console.log('Phase 9 mobile reliability QA passed.');
