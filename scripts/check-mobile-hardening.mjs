import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const pkg = JSON.parse(read('package.json'));
const dataTable = read('src/components/ui/DataTable.jsx');
const header = read('src/layouts/Header.jsx');
const mobileActionBar = read('src/components/ui/MobileActionBar.jsx');
const filterPanel = read('src/components/ui/FilterPanel.jsx');
const formField = read('src/components/ui/FormField.jsx');
const css = read('src/styles/index.css');
const patientPortal = read('src/pages/public/PatientPortalAccessPage.jsx');
const reportVerification = read('src/pages/public/ReportVerificationPage.jsx');

const checks = [
  {
    pass: /^12\.(1[7-9]|[2-9][0-9])\.0$/.test(pkg.version),
    message: 'Frontend version must be bumped to Phase 6 / 12.17.0 or newer.'
  },
  {
    pass: dataTable.includes('lg:hidden') && dataTable.includes('lg:block') && dataTable.includes('**:min-w-0'),
    message: 'DataTable must keep card rendering active through tablet widths and guard mobile action overflow.'
  },
  {
    pass: header.includes('Screen guide') && header.includes('screenGuideOpen') && header.includes('mobile-screen-guide-panel') && header.includes('absolute left-0 top-[calc(100%+0.45rem)]'),
    message: 'Mobile header descriptions must use a no-shift animated screen guide dropdown.'
  },
  {
    pass: mobileActionBar.includes('max-h-[42dvh]') && mobileActionBar.includes('overflow-y-auto') && mobileActionBar.includes('*:min-w-0'),
    message: 'MobileActionBar must cap tall action stacks and prevent child overflow.'
  },
  {
    pass: filterPanel.includes('max-h-[46dvh]') && filterPanel.includes('lg:max-h-none') && filterPanel.includes('*:min-w-0'),
    message: 'FilterPanel must be scroll-safe on phones while returning to normal desktop behavior.'
  },
  {
    pass: formField.includes('wrap-break-word') && formField.includes('*:min-w-0'),
    message: 'FormField labels/help and nested controls must wrap safely on small screens.'
  },
  {
    pass: css.includes('Phase 6 mobile hardening') && css.includes('overflow-wrap: anywhere') && css.includes('touch-action: manipulation'),
    message: 'Global CSS must include Phase 6 mobile overflow and tap hardening rules.'
  },
  {
    pass: patientPortal.includes('px-3 py-4') && patientPortal.includes('w-full sm:w-auto') && reportVerification.includes('h-28 w-28') && reportVerification.includes('w-full sm:w-auto'),
    message: 'Public patient/report screens must use mobile-first spacing and full-width mobile actions.'
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error('Phase 6 mobile hardening QA failed:');
  for (const item of failed) console.error(`- ${item.message}`);
  process.exit(1);
}

console.log('Phase 6 mobile hardening QA passed.');
