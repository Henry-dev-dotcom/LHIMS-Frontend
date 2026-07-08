import { patientService } from '../services/patientService';
import { orderService } from '../services/orderService';
import { adminService } from '../services/adminService';
import { billingService } from '../services/billingService';
import { financeService } from '../services/financeService';
import { labService } from '../services/labService';
import { scanService } from '../services/scanService';
import { receptionService } from '../services/receptionService';
import { resultService } from '../services/resultService';
import { notificationService } from '../services/notificationService';
import {
  listItems,
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
  normalizeOrder,
  normalizePatient,
  normalizeReport,
  normalizeScanBooking,
  normalizeShift,
  normalizeUser,
  normalizeVisit
} from '../api/normalizers';

// The backend caps page size at 100 (common.validators.ts).
const LIST_PARAMS = { limit: 100 };

/*
  Loads the role-scoped workspace collections from the backend and dispatches
  them into state.data. Collections load in parallel and tolerate individual
  failures — a failed collection stays empty and surfaces one toast, while the
  rest of the workspace remains usable. Orders load first because most other
  entities cross-reference them by cuid and are re-keyed to order codes.
*/
export async function hydrateWorkspace(client, auth, dispatch) {
  const role = auth?.role;
  if (!role) return;

  const failures = [];
  const collections = {};

  async function load(name, loader, normalizer) {
    try {
      const payload = await loader();
      const items = listItems(payload);
      collections[name] = normalizer ? items.map(normalizer).filter(Boolean) : items;
    } catch (error) {
      if (error?.status !== 403) failures.push(name);
      collections[name] = [];
    }
  }

  // Orders first: everything else resolves cuid order ids to order codes.
  await load('orders', () => orderService.list(client, LIST_PARAMS), null);
  const rawOrders = collections.orders || [];
  const orderCodeById = Object.fromEntries(rawOrders.map((order) => [order.id, order.orderCode || order.id]));
  collections.orders = rawOrders.map(normalizeOrder).filter(Boolean);

  const loaders = [
    load('catalog', () => adminService.catalog(client, LIST_PARAMS), normalizeCatalogItem),
    load('patients', () => patientService.list(client, LIST_PARAMS), normalizePatient),
    load('invoices', () => billingService.invoices(client, LIST_PARAMS), (item) => normalizeInvoice(item, orderCodeById)),
    load('results', () => labService.acceptedSamples(client, LIST_PARAMS), (item) => normalizeLabResultFromSample(item, orderCodeById)),
    load('resultReports', () => resultService.list(client, LIST_PARAMS), (item) => normalizeReport(item, orderCodeById)),
    load('deliveryLogs', () => resultService.deliveryLogs(client, LIST_PARAMS), (item) => normalizeDeliveryLog(item, orderCodeById)),
    load('notifications', () => notificationService.list(client, LIST_PARAMS), (item) => normalizeNotification(item, orderCodeById)),
    load('appointments', () => receptionService.appointments(client, LIST_PARAMS), (item) => normalizeAppointment(item, orderCodeById)),
    load('dailyVisits', () => receptionService.dailyVisits(client, LIST_PARAMS), (item) => normalizeVisit(item, orderCodeById)),
    load('doctors', () => adminService.doctors(client, LIST_PARAMS), normalizeDoctor),
    load('hospitals', () => adminService.hospitals(client, LIST_PARAMS), normalizeHospital),
    load('scanBookings', () => scanService.bookings(client, LIST_PARAMS), (item) => normalizeScanBooking(item, orderCodeById))
  ];

  if (role === 'billing' || role === 'admin') {
    loaders.push(
      load('financeShifts', () => financeService.shifts(client, LIST_PARAMS), normalizeShift),
      load('expenses', () => financeService.expenses(client, LIST_PARAMS), normalizeExpense)
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
  if (collections.invoices?.length) {
    const invoiceByOrder = Object.fromEntries(collections.invoices.map((invoice) => [invoice.orderId, invoice]));
    collections.orders = collections.orders.map((order) => (
      invoiceByOrder[order.id] ? { ...order, billingStatus: invoiceByOrder[order.id].status } : order
    ));
  }

  dispatch({ type: 'SET_COLLECTIONS', collections });
  if (failures.length) {
    dispatch({ type: 'SHOW_TOAST', toast: { type: 'error', message: `Some data failed to load (${failures.join(', ')}). Pull to refresh or try again.` } });
  }
}
