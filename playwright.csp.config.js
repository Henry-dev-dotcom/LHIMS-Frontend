import base from './playwright.config.js';

/*
  The same journeys, against the production build served with the real policy.
  Run through `npm run test:csp`, which builds first.
*/
const backend = base.webServer[0];

export default {
  ...base,
  testDir: './e2e-csp',
  projects: [base.projects.find((project) => project.name === 'desktop')],
  webServer: [
    backend,
    { command: 'node scripts/serve-with-csp.mjs dist 5174 nginx.conf', url: 'http://localhost:5174', reuseExistingServer: false, timeout: 60_000 }
  ]
};
