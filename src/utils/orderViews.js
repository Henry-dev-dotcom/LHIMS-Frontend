import { getById } from './formatters';

export function getOrderItems(order, catalog = []) {
  return (order?.itemIds || []).map((id) => getById(catalog, id)).filter(Boolean);
}

export function orderIncludesDepartment(order, catalog = [], department) {
  return getOrderItems(order, catalog).some((item) => item.department === department);
}

export function orderIncludesType(order, catalog = [], type) {
  return getOrderItems(order, catalog).some((item) => item.type === type);
}

export function getDepartmentOrders(data, department) {
  return (data.orders || [])
    .filter((order) => orderIncludesDepartment(order, data.catalog || [], department))
    .map((order) => ({
      ...order,
      patient: getById(data.patients || [], order.patientId),
      doctor: getById(data.doctors || [], order.doctorId),
      hospital: getById(data.hospitals || [], order.hospitalId),
      items: getOrderItems(order, data.catalog || []).filter((item) => item.department === department),
      invoice: (data.invoices || []).find((invoice) => invoice.orderId === order.id),
      result: (data.results || []).find((result) => result.orderId === order.id && result.department === department),
      sampleLogs: (data.sampleLogs || []).filter((sample) => sample.orderId === order.id),
      scanBookings: (data.scanBookings || []).filter((booking) => booking.orderId === order.id),
      /*
        What this department has taken in, one row per test or study.

        The laboratory and the imaging unit run the same three-tab workflow, and
        differ only in what the row is called underneath - an accepted sample or
        an accepted scan. Naming it the same thing for both is what lets one set
        of helpers drive both units.
      */
      acceptances: department === 'Imaging'
        ? (data.scanAcceptances || []).filter((acceptance) => acceptance.orderId === order.id)
        : (data.sampleLogs || []).filter((sample) => sample.orderId === order.id)
    }));
}

export function getLabOrders(data) {
  return getDepartmentOrders(data, 'Laboratory');
}

export function getScanOrders(data) {
  return getDepartmentOrders(data, 'Imaging');
}

export function getLabCatalogItems(order, catalog = []) {
  return getOrderItems(order, catalog).filter((item) => item.department === 'Laboratory');
}

export function getScanCatalogItems(order, catalog = []) {
  return getOrderItems(order, catalog).filter((item) => item.department === 'Imaging');
}

export function describeOrderItems(items = []) {
  return items.map((item) => item.name).join(', ') || '—';
}

export function getPriorImaging(data, order, modality) {
  if (!order?.patientId) return [];
  const imagingOrderIds = (data.orders || [])
    .filter((candidate) => candidate.patientId === order.patientId && candidate.id !== order.id)
    .filter((candidate) => getOrderItems(candidate, data.catalog || []).some((item) => item.department === 'Imaging' && (!modality || item.modality === modality)))
    .map((candidate) => candidate.id);
  return (data.results || []).filter((result) => imagingOrderIds.includes(result.orderId) && result.department === 'Imaging');
}
