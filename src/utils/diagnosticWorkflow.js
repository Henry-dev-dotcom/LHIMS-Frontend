/*
  The laboratory and the imaging unit both work test by test.

  A request from a clinician may name six tests; the samples for three of them
  are on the bench and the rest are still being drawn. So the lab accepts the
  ones it has, enters each result on its own, and the others stay in the incoming
  queue until their samples arrive. These helpers derive that per-test view from
  the store, which keeps one row per test (the backend holds one LabSample per
  order item, and the store no longer collapses them).

  Three tabs, and nothing else:

    Incoming   - requests with at least one test not yet accepted
    Accepted   - accepted tests still waiting for a result
    Results    - every result that has been submitted

  Imaging works identically, so the same helpers serve both, by department.
*/
import { getDepartmentOrders } from './orderViews';

const DEPARTMENT_ITEM_TYPE = { Laboratory: 'Lab', Imaging: 'Scan' };

/** Catalog codes whose sample has been accepted on this order. */
function acceptedCodes(order) {
  return new Set(
    (order.acceptances || [])
      .filter((entry) => entry.status === 'Accepted')
      .flatMap((entry) => entry.labItemIds || [])
  );
}

/**
 * This department's order items, each paired with its catalog entry so the bench
 * sees a test name, and with the sample carrying it if one exists.
 *
 * The order item's own id is what acceptance needs - the catalog code names the
 * test, but the request for it is the order item.
 */
export function departmentTests(order, department) {
  const wantedType = DEPARTMENT_ITEM_TYPE[department];
  const accepted = acceptedCodes(order);
  return (order.orderItems || [])
    .filter((orderItem) => orderItem.type === wantedType)
    .map((orderItem) => {
      const item = (order.items || []).find((candidate) => candidate.id === orderItem.catalogItemId) || null;
      const sample = (order.acceptances || []).find(
        (candidate) => candidate.status === 'Accepted' && (candidate.labItemIds || []).includes(orderItem.catalogItemId)
      ) || null;
      return {
        orderItemId: orderItem.id,
        catalogCode: orderItem.catalogItemId,
        name: item?.name || orderItem.catalogItemId,
        price: item?.price ?? null,
        item,
        sample,
        accepted: accepted.has(orderItem.catalogItemId),
        hasResult: Boolean(sample?.hasResult),
        // What the result-entry popup opens on: values an analyzer already filed,
        // or the entry of a sent result that was reversed for correction.
        draftResult: sample?.draftResult || null,
        returnedReason: sample?.draftResult?.reason || ''
      };
    })
    .filter((row) => row.catalogCode);
}

/**
 * Tests whose samples have not been accepted yet. A rejected sample leaves its
 * test pending again, because the sample has to be drawn a second time.
 */
export function pendingTests(order, department) {
  return departmentTests(order, department).filter((row) => !row.accepted);
}

/** Accepted tests still waiting for a result to be entered. */
export function awaitingResult(order, department) {
  return departmentTests(order, department).filter((row) => row.accepted && !row.hasResult);
}

function workableOrders(data, department) {
  return getDepartmentOrders(data, department).filter((order) => order.status !== 'Cancelled');
}

/** Incoming: requests with at least one test still to accept, newest first. */
export function incomingQueue(data, department) {
  return workableOrders(data, department)
    .filter((order) => pendingTests(order, department).length > 0)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** Accepted: requests with at least one accepted test still waiting for a result. */
export function acceptedQueue(data, department) {
  return workableOrders(data, department)
    .filter((order) => awaitingResult(order, department).length > 0)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** Matches a queue row against the one search box the lab is given. */
export function queueMatches(order, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [order.id, order.patient?.fullName, order.patient?.id, order.doctor?.name, (order.items || []).map((item) => item.name).join(' ')]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

/** Who asked for the work, as the bench needs to read it. */
export function requestedBy(order) {
  return order.doctor?.name || order.hospital?.name || 'Walk-in';
}

/**
 * Whether this test has been paid for. The bench is told, but never blocked by
 * it: refusing to run a test over an unpaid bill is a decision for the facility,
 * not something the software should take on a patient's behalf.
 */
export function paymentStateFor(order, row) {
  if (row?.price !== null && Number(row?.price) === 0) return 'Free';
  const invoice = order.invoice;
  if (!invoice) return 'Unbilled';
  if (invoice.status === 'Paid') return 'Paid';
  if (String(invoice.status).toLowerCase().includes('insur')) return 'Insured';
  return 'Unpaid';
}
