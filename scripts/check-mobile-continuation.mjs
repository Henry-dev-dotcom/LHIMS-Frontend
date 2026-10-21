import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const toast = read('src/components/ui/ToastHost.jsx');
const header = read('src/layouts/Header.jsx');
const modal = read('src/components/ui/Modal.jsx');
const tabs = read('src/components/ui/ResponsiveTabs.jsx');
const css = read('src/styles/index.css');
const bottomNav = read('src/components/ui/MobileBottomNav.jsx');

const checks = [
  {
    pass: /^12\.(18|19|[2-9][0-9])\.0$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version,
    message: 'Frontend package and lockfile versions must be bumped for Phase 6 continuation.'
  },
  {
    pass: toast.includes('bottom-[calc(6.25rem+env(safe-area-inset-bottom))]') && toast.includes('wrap-break-word'),
    message: 'ToastHost must sit above the mobile bottom nav and wrap long messages.'
  },
  {
    pass: header.includes("document.body.style.overflow = 'hidden'") && header.includes('pointerdown') && header.includes('Close user menu') && header.includes('backdrop-blur-xs md:hidden'),
    message: 'Mobile user menu must lock background scroll, close on pointer/outside interaction, and include a mobile backdrop.'
  },
  {
    pass: modal.includes('w-full min-w-0 grid-rows') && modal.includes('**:min-w-0') && modal.includes('grid min-w-0 gap-2'),
    message: 'Mobile modal content and footers must prevent nested overflow.'
  },
  {
    pass: tabs.includes('max-w-[72vw]') && tabs.includes('title={tab.label}') && tabs.includes('block truncate'),
    message: 'ResponsiveTabs must cap long tab labels and expose full labels via title.'
  },
  {
    pass: bottomNav.includes('bottom-[calc(0.5rem+env(safe-area-inset-bottom))]'),
    message: 'MobileBottomNav must respect safe-area bottom inset without inflating internal padding.'
  },
  {
    pass: css.includes('Phase 6 continuation') && css.includes('contain: inline-size') && css.includes('font-size: 16px') && css.includes('scroll-padding-bottom'),
    message: 'Global CSS must include final Phase 6 continuation viewport, iOS input zoom and embedded-content guardrails.'
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error('Phase 6 continuation mobile QA failed:');
  for (const item of failed) console.error(`- ${item.message}`);
  process.exit(1);
}

console.log('Phase 6 continuation mobile QA passed.');
