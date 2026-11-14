import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const exists = (file) => fs.existsSync(file);
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const index = read('index.html');
const app = read('src/app/App.jsx');
const main = read('src/app/main.jsx');
const appShell = read('src/layouts/AppShell.jsx');
const bottomNav = read('src/components/ui/MobileBottomNav.jsx');
const toast = read('src/components/ui/ToastHost.jsx');
const hook = read('src/hooks/useMobileViewportMetrics.js');
const swRegistration = read('src/utils/registerServiceWorker.js');
const css = read('src/styles/index.css');
const manifest = read('public/manifest.webmanifest');
const sw = read('public/sw.js');

const checks = [
  {
    pass: /^12\.(20|2[1-9]|[3-9][0-9])\.0$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version,
    message: 'Frontend package and lockfile versions must be bumped for Phase 8.'
  },
  {
    pass: pkg.scripts?.['lint:mobile']?.includes('check-mobile-phase8.mjs'),
    message: 'Phase 8 mobile QA script must be included in lint:mobile.'
  },
  {
    pass: index.includes('viewport-fit=cover') && index.includes('theme-color') && index.includes('manifest.webmanifest') && index.includes('apple-mobile-web-app-capable'),
    message: 'index.html must include mobile viewport, theme, install and manifest metadata.'
  },
  {
    pass: exists('public/manifest.webmanifest') && manifest.includes('display') && manifest.includes('standalone') && manifest.includes('orientation') && (manifest.includes('/icons/icon.svg') || manifest.includes('/icons/app-icon-192.png')),
    message: 'A web app manifest with install/mobile metadata and an icon must exist.'
  },
  {
    pass: exists('public/sw.js') && exists('public/offline.html') && sw.includes('CACHE_VERSION') && sw.includes('offline.html') && sw.includes('skipWaiting'),
    message: 'A conservative service worker and offline fallback page must exist.'
  },
  {
    pass: main.includes('registerServiceWorker') && swRegistration.includes('serviceWorker') && swRegistration.includes('https:') && swRegistration.includes('localhost'),
    message: 'Service worker registration must be guarded and imported by the app entrypoint.'
  },
  {
    pass: app.includes('useMobileViewportMetrics') && hook.includes('visualViewport') && hook.includes('--app-vh') && hook.includes('mobile-keyboard-open') && hook.includes('mobile-compact-landscape'),
    message: 'The app must install visualViewport metrics for keyboard and orientation handling.'
  },
  {
    pass: appShell.includes('--mobile-bottom-nav-space') && bottomNav.includes('mobile-bottom-nav') && toast.includes('mobile-toast'),
    message: 'AppShell, bottom nav and toast must use Phase 8 mobile spacing hooks/classes.'
  },
  {
    pass: css.includes('Phase 8 real-device mobile') && css.includes('.mobile-keyboard-open .mobile-bottom-nav') && css.includes('.mobile-compact-landscape') && css.includes('@media (display-mode: standalone)'),
    message: 'Global CSS must include keyboard, landscape and standalone-mode hardening.'
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error('Phase 8 mobile real-device QA failed:');
  for (const item of failed) console.error(`- ${item.message}`);
  process.exit(1);
}

console.log('Phase 8 mobile real-device QA passed.');
