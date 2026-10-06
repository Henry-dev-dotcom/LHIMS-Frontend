import { patientService } from '../services/patientService';
import { orderService } from '../services/orderService';
import { adminService } from '../services/adminService';
import { billingService } from '../services/billingService';
import { financeService } from '../services/financeService';
import { labService } from '../services/labService';
import { analyzerService } from '../services/analyzerService';
import { scanService } from '../services/scanService';
import { doctorService } from '../services/doctorService';
import { receptionService } from '../services/receptionService';
import { resultService } from '../services/resultService';
import { notificationService } from '../services/notificationService';
import {
  listItems,
  normalizeAnalyzerDevice,
  normalizeAnalyzerMessage,
  normalizeAnalyzerTestMap,
  normalizeAnalyzerUnmappedCode,
  normalizeAppointment,
  normalizeAuditLog,
  normalizeCatalogItem,
  normalizeDeliveryLog,
  normalizeDepartment,
  normalizeDoctor,
  normalizeEquipment,
  normalizeExpense,
  normalizeHospital,
  normalizeInvoice,
  normalizeLabResultFromSample,
  normalizeNotification,
  normalizeScanResult,
  normalizeOrder,
  normalizePatient,
  normalizeReport,
  normalizeSampleLogs,
  normalizeScanAcceptance,
  normalizeScanResultFromAcceptance,
  normalizeScanBooking,
  normalizeShift,
  normalizeUser,
  normalizeVisit
} from '../api/normalizers';

// The backend caps page size at 100 (common.validators.ts).
const LIST_PARAMS = { limit: 100 };

/*
  Loads workspace collections from the backend and dispatches them into
  state.data. Collections load in parallel and tolerate individual failures —
  a failed collection stays empty (or keeps its previous contents on partial
  refresh) and surfaces one toast, while the rest of the workspace remains
  usable. Orders load first because most other entities cross-reference them
  by cuid and are re-keyed to human order codes.

  `only` limits the load to a subset of collection names so command handlers
  can refresh just what a write touched.
*/
export async function loadCollections(client, auth, dispatch, only = null) {
  const role = auth?.role;
  // The platform operator has no facility workspace to load.
  if (!role || role === 'platform') return;
  // Departments this facility has switched off are not asked for: the server
  // would refuse them anyway, and every refusal lands in the audit log.
  const on = (moduleKey) => !Array.isArray(auth?.modules) || auth.modules.includes(moduleKey);
  const wants = (name) => !only || only.includes(name);
  // A doctor's session cannot reach the admin-only lists; it reads its own profile.
  const isClinician = role === 'doctor';

  const failures = [];
  const collections = {};

  async function load(name, loader, normalizer) {
    if (!wants(name)) return;
    try {
      const payload = await loader();
      const items = listItems(payload);
      collections[name] = normalizer ? items.map(normalizer).filter(Boolean) : items;
    } catch (error) {
      if (error?.status !== 403) failures.push(name);
      if (!only) collections[name] = [];
    }
  }

  // Orders load whenever needed for cross-referencing (invoices, results,
  // visits and notifications all point at orders).
  const needsOrders = wants('orders') || ['invoices', 'results', 'sampleLogs', 'resultReports', 'deliveryLogs', 'notifications', 'appointments', 'dailyVisits', 'scanBookings'].some(wants);
  let orderCodeById = {};
  if (needsOrders) {
    await load('orders', () => orderService.list(client, LIST_PARAMS), null);
    const rawOrders = collections.orders || [];
    orderCodeById = Object.fromEntries(rawOrders.map((order) => [order.id, order.orderCode || order.id]));
    if (wants('orders')) collections.orders = rawOrders.map(normalizeOrder).filter(Boolean);
    else delete collections.orders;
  }

  const loaders = [
    load('catalog', () => orderService.catalog(client, LIST_PARAMS), normalizeCatalogItem),
    load('patients', () => patientService.list(client, LIST_PARAMS), normalizePatient),
    load('invoices', () => billingService.invoices(client, LIST_PARAMS), (item) => normalizeInvoice(item, orderCodeById)),
    // Lab results ride on accepted samples; scan results come from the review
    // queue. Both merge into the single results collection pages read.
    /*
      Both departments' results come from what they have accepted.

      Accepted lab samples already fed both the results collection and the
      sample rows the workspace works from. Imaging results used to come from the
      review queue instead - which holds only what is waiting to be reviewed, so
      a signed-off report was never in it and the imaging Results tab could not
      show anything at all. Accepted studies carry their report just as accepted
      samples do, so both now come from the same place.
    */
    (async () => {
      if (!wants('results') && !wants('sampleLogs') && !wants('scanAcceptances')) return;
      const [labPayload, scanPayload, rejectedPayload] = await Promise.all([
        on('laboratory') ? labService.acceptedSamples(client, LIST_PARAMS).catch(() => null) : null,
        (wants('results') || wants('scanAcceptances')) && on('imaging') ? scanService.acceptedScans(client, LIST_PARAMS).catch(() => null) : null,
        // Rejected / recollection samples live on a separate endpoint; they feed
        // the rejected-samples tracker (they are excluded from accepted-samples).
        wants('sampleLogs') && on('laboratory') ? labService.rejectedRetest(client, LIST_PARAMS).catch(() => null) : null
      ]);
      if (wants('sampleLogs')) {
        if (labPayload === null && rejectedPayload === null) {
          if (!only) collections.sampleLogs = [];
        } else {
          const acceptedLogs = normalizeSampleLogs(listItems(labPayload), orderCodeById);
          const rejectedLogs = normalizeSampleLogs(listItems(rejectedPayload), orderCodeById, { groupByOrder: false })
            .filter((sample) => sample.status === 'Rejected' || sample.status === 'Recollection Requested');
          collections.sampleLogs = [...acceptedLogs, ...rejectedLogs];
        }
      }
      if (wants('scanAcceptances')) {
        if (scanPayload === null) {
          if (!only) collections.scanAcceptances = [];
        } else {
          collections.scanAcceptances = listItems(scanPayload)
            .map((item) => normalizeScanAcceptance(item, orderCodeById))
            .filter(Boolean);
        }
      }
      if (wants('results')) {
        if (labPayload === null && scanPayload === null) {
          if (!only) collections.results = [];
        } else {
          const labResults = listItems(labPayload).map((item) => normalizeLabResultFromSample(item, orderCodeById)).filter(Boolean);
          // One acceptance holds at most one report, and it is normalised through
          // its acceptance so it keeps the patient, order and study it belongs to.
          const scanResults = listItems(scanPayload)
            .map((acceptance) => normalizeScanResultFromAcceptance(acceptance, orderCodeById))
            .filter(Boolean);
          collections.results = [...labResults, ...scanResults];
        }
      }
    })(),
    on('results_delivery') && load('resultReports', () => resultService.list(client, LIST_PARAMS), (item) => normalizeReport(item, orderCodeById)),
    on('results_delivery') && load('deliveryLogs', () => resultService.deliveryLogs(client, LIST_PARAMS), (item) => normalizeDeliveryLog(item, orderCodeById)),
    load('notifications', () => notificationService.list(client, LIST_PARAMS), (item) => normalizeNotification(item, orderCodeById)),
    load('appointments', () => receptionService.appointments(client, LIST_PARAMS), (item) => normalizeAppointment(item, orderCodeById)),
    load('dailyVisits', () => receptionService.dailyVisits(client, LIST_PARAMS), (item) => normalizeVisit(item, orderCodeById)),
    // The doctor and hospital lists live behind the admin-only /admin routes. A
    // clinician reads their own profile instead, which carries their hospital —
    // without it their workspace cannot tell which orders are theirs.
    isClinician
      ? (async () => {
        if (!wants('doctors') && !wants('hospitals')) return;
        const profile = await doctorService.profile(client).catch(() => null);
        if (!profile) {
          if (!only) {
            if (wants('doctors')) collections.doctors = [];
            if (wants('hospitals')) collections.hospitals = [];
          }
          return;
        }
        if (wants('doctors')) collections.doctors = [normalizeDoctor(profile)].filter(Boolean);
        if (wants('hospitals')) collections.hospitals = [normalizeHospital(profile.hospital)].filter(Boolean);
      })()
      : load('doctors', () => adminService.doctors(client, LIST_PARAMS), normalizeDoctor),
    isClinician ? null : load('hospitals', () => adminService.hospitals(client, LIST_PARAMS), normalizeHospital),
    on('imaging') && load('scanBookings', () => scanService.bookings(client, LIST_PARAMS), (item) => normalizeScanBooking(item, orderCodeById))
  ];

  if ((role === 'billing' || role === 'admin') && on('finance')) {
    loaders.push(
      load('financeShifts', () => financeService.shifts(client, LIST_PARAMS), normalizeShift),
      load('expenses', () => financeService.expenses(client, LIST_PARAMS), normalizeExpense)
    );
  }

  // Analyzers belong to the bench that runs them, and to the administrator who
  // sets the laboratory up.
  if ((role === 'lab' || role === 'admin') && on('laboratory')) {
    loaders.push(
      load('analyzerDevices', () => analyzerService.devices(client, LIST_PARAMS), normalizeAnalyzerDevice),
      load('analyzerTestMaps', () => analyzerService.testMaps(client, LIST_PARAMS), normalizeAnalyzerTestMap),
      load('analyzerMessages', () => analyzerService.messages(client, LIST_PARAMS), normalizeAnalyzerMessage),
      load('analyzerUnmappedCodes', () => analyzerService.unmappedCodes(client), normalizeAnalyzerUnmappedCode)
    );
  }

  if (role === 'admin') {
    loaders.push(
      load('users', () => adminService.users(client, LIST_PARAMS), normalizeUser),
      load('departments', () => adminService.departments.list(client, LIST_PARAMS), normalizeDepartment),
      load('equipment', () => adminService.equipment.list(client, LIST_PARAMS), normalizeEquipment),
      load('auditLogs', () => adminService.auditLogs(client, LIST_PARAMS), normalizeAuditLog)
    );
  }

  await Promise.all(loaders);

  // Join billing status onto orders once invoices are known.
  if (collections.orders && collections.invoices?.length) {
    const invoiceByOrder = Object.fromEntries(collections.invoices.map((invoice) => [invoice.orderId, invoice]));
    collections.orders = collections.orders.map((order) => (
      invoiceByOrder[order.id] ? { ...order, billingStatus: invoiceByOrder[order.id].status } : order
    ));
  }

  dispatch({ type: 'SET_COLLECTIONS', collections });
  if (failures.length) {
    dispatch({ type: 'SHOW_TOAST', toast: { type: 'error', message: `Some data failed to load (${failures.join(', ')}). Try again or refresh.` } });
  }
}

export function hydrateWorkspace(client, auth, dispatch) {
  return loadCollections(client, auth, dispatch, null);
}
