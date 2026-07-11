import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const store = read('src/store/AppStore.jsx');
const commands = read('src/store/commands.js');
const hydrate = read('src/store/hydrate.js');
const workflow = read('src/workflow/workflowEngine.js');
const statuses = read('src/workflow/statuses.js');
const routes = read('src/routes/AppRouter.jsx');
const roles = read('src/data/roles.js');

// Write actions live in the async command router; UI/local actions stay in
// the reducer. Both surfaces make up the dispatchable workflow contract.
const dispatchable = `${store}\n${commands}`;

const checks = [
  ['commands route through the backend', commands, 'runCommand'],
  ['commands resolve api ids', commands, 'requireApiId'],
  ['hydration loads workspace collections', hydrate, 'loadCollections'],
  ['workflow keeps order view model', workflow, 'getOrderViewModel'],
  ['workflow keeps expected completion', workflow, 'computeExpectedCompletion'],
  ['statuses include submitted', statuses, 'Submitted'],
  ['statuses include confirmed', statuses, 'Confirmed'],
  ['statuses include in progress', statuses, 'In Progress'],
  ['statuses include pending review', statuses, 'Pending Review'],
  ['statuses include final released', statuses, 'Final / Released'],
  ['statuses include cancelled', statuses, 'Cancelled'],
  ['store creates patients', dispatchable, 'CREATE_PATIENT'],
  ['store updates patients', dispatchable, 'UPDATE_PATIENT'],
  ['store submits doctor orders', dispatchable, 'CREATE_DOCTOR_ORDER'],
  ['store confirms reception orders', dispatchable, 'CONFIRM_RECEPTION_ORDER'],
  ['store checks in patients', dispatchable, 'CHECK_IN_PATIENT'],
  ['store records lab samples', dispatchable, 'ADD_SAMPLE_LOG'],
  ['store submits lab results', dispatchable, 'ENTER_LAB_RESULT'],
  ['store approves lab results', dispatchable, 'APPROVE_DEPARTMENT_RESULT'],
  ['store books scan equipment', dispatchable, 'ADD_SCAN_BOOKING'],
  ['store submits scan report', dispatchable, 'SAVE_SCAN_REPORT'],
  ['store approves scan report', dispatchable, 'APPROVE_DEPARTMENT_RESULT'],
  ['store records payments', dispatchable, 'RECORD_PAYMENT'],
  ['store updates catalog', dispatchable, 'ADMIN_UPDATE_CATALOG_ITEM'],
  ['store logs restricted access', dispatchable, 'LOG_RESTRICTED_ACCESS'],
  ['routes patient records page', routes, 'PatientRecordsPage'],
  ['routes doctor portal page', routes, 'DoctorPortalPage'],
  ['routes lab queue page', routes, 'LabQueuePage'],
  ['routes scan queue page', routes, 'ScanQueuePage'],
  ['routes invoices page', routes, 'InvoicesPage'],
  ['routes reports page', routes, 'ReportsPage'],
  ['routes security page', routes, 'SecurityReliabilityPage'],
  ['six roles configured', roles, 'ROLE_DASHBOARD_REQUIREMENTS']
];

const missing = checks.filter(([_, text, needle]) => !text.includes(needle)).map(([label, _, needle]) => `${label} missing ${needle}`);
if (missing.length) {
  console.error('Workflow integrity check failed:\n' + missing.join('\n'));
  process.exit(1);
}
console.log(`Workflow integrity check passed: ${checks.length} workflow and route markers verified.`);
