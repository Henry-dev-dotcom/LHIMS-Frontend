import fs from 'node:fs';

const priceCatalog = fs.readFileSync('src/pages/billing/PriceCatalogPage.jsx', 'utf8');
const header = fs.readFileSync('src/layouts/Header.jsx', 'utf8');
const sidebar = fs.readFileSync('src/layouts/Sidebar.jsx', 'utf8');
const appShell = fs.readFileSync('src/layouts/AppShell.jsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  {
    pass: priceCatalog.includes('catalogModalOpen') && priceCatalog.includes('<Modal') && priceCatalog.includes('Parameters / components'),
    message: 'Price catalog must display selected catalog details inside a popup modal.'
  },
  {
    pass: !priceCatalog.includes('xl:grid-cols-[0.7fr_1.3fr]') && !priceCatalog.includes('Selected catalog item\' :') && !priceCatalog.includes('Reception has view-only access to prices for front-desk billing conversations.</p></div>'),
    message: 'Price catalog must not reserve a left-side selected item panel.'
  },
  {
    pass: priceCatalog.includes('Select View to open item details without taking space on the page') && priceCatalog.includes('View / Edit'),
    message: 'Price catalog rows must open details from the View/View-Edit action.'
  },
  {
    pass: (header.includes('z-20') || header.includes('z-90')) && sidebar.includes('z-40') && appShell.includes('lg:ml-76'),
    message: 'Header/sidebar shell must prevent the page header from covering the left navigation during horizontal movement.'
  },
  {
    pass: /^12\.(1[4-9]|[2-9][0-9])\.0$/.test(pkg.version),
    message: 'Frontend version must remain at Stage 24 or newer.'
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error('Stage 24 price catalog and shell QA failed:');
  for (const item of failed) console.error(`- ${item.message}`);
  process.exit(1);
}

console.log('Stage 24 price catalog popup and fixed shell QA passed.');
