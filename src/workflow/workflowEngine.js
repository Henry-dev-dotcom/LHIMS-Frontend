/*
  Local view helpers shared by pages and the store. The workflow business
  logic that used to live here (order creation, transitions, billing, result
  delivery) now runs on the backend; pages dispatch through the async command
  router in src/store/commands.js instead.
*/

export function nowIso() {
  return new Date().toISOString();
}

export function idWithPrefix(prefix, existing = []) {
  const current = existing
    .map((item) => String(item.id || '').replace(prefix, '').replace(/[^0-9]/g, ''))
    .map((value) => Number(value || 0))
    .filter(Number.isFinite);
  const next = (current.length ? Math.max(...current) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export function getCatalogItems(order, catalog) {
  return (order.itemIds || []).map((id) => catalog.find((item) => item.id === id)).filter(Boolean);
}

export function getOrderDepartments(order, catalog) {
  const items = getCatalogItems(order, catalog);
  return [...new Set(items.map((item) => item.department))];
}

export function computeExpectedCompletion(createdAt, itemIds, catalog, urgency = 'Routine') {
  const itemHours = itemIds.map((id) => catalog.find((item) => item.id === id)?.expectedHours || 4);
  const maxHours = itemHours.length ? Math.max(...itemHours) : 4;
  const urgencyFactor = urgency === 'Urgent' ? 0.6 : 1;
  const date = new Date(createdAt || nowIso());
  date.setHours(date.getHours() + Math.ceil(maxHours * urgencyFactor));
  return date.toISOString();
}

/* Session-local audit trail for UI-only events (restricted-access attempts,
   export records); server-side actions are audited by the backend. */
export function addAudit(auditLogs, event) {
  return [{
    id: idWithPrefix('AUD-', auditLogs),
    actor: event.actor || 'System',
    role: event.role || 'system',
    action: event.action,
    module: event.module,
    entityId: event.entityId || '',
    timestamp: nowIso(),
    details: event.details || ''
  }, ...auditLogs];
}

export function getOrderViewModel(order, data) {
  const patient = data.patients.find((item) => item.id === order.patientId);
  const doctor = data.doctors.find((item) => item.id === order.doctorId);
  const hospital = data.hospitals.find((item) => item.id === order.hospitalId);
  const items = getCatalogItems(order, data.catalog);
  const invoice = data.invoices.find((item) => item.orderId === order.id);
  const results = (data.results || []).filter((item) => item.orderId === order.id);
  return { ...order, patient, doctor, hospital, items, invoice, results };
}
