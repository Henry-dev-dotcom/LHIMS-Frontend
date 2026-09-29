import { buildQuery } from '../api/apiClient';

// Stores & Procurement module (backend /stores).
export const storesService = {
  summary: async (client) => client.request('/stores/summary'),
  suppliers: async (client) => client.request('/stores/suppliers'),
  createSupplier: async (client, payload) => client.request('/stores/suppliers', { method: 'POST', body: payload }),
  items: async (client, params = {}) => client.request(`/stores/items${buildQuery(params)}`),
  item: async (client, id) => client.request(`/stores/items/${id}`),
  createItem: async (client, payload) => client.request('/stores/items', { method: 'POST', body: payload }),
  adjust: async (client, id, payload) => client.request(`/stores/items/${id}/adjust`, { method: 'POST', body: payload }),
  purchaseOrders: async (client, params = {}) => client.request(`/stores/purchase-orders${buildQuery(params)}`),
  purchaseOrder: async (client, id) => client.request(`/stores/purchase-orders/${id}`),
  createPurchaseOrder: async (client, payload) => client.request('/stores/purchase-orders', { method: 'POST', body: payload }),
  approve: async (client, id) => client.request(`/stores/purchase-orders/${id}/approve`, { method: 'POST', body: {} }),
  cancelPo: async (client, id, reason) => client.request(`/stores/purchase-orders/${id}/cancel`, { method: 'POST', body: { reason } }),
  receive: async (client, id, payload) => client.request(`/stores/purchase-orders/${id}/receive`, { method: 'POST', body: payload }),
  requisitions: async (client, params = {}) => client.request(`/stores/requisitions${buildQuery(params)}`),
  createRequisition: async (client, payload) => client.request('/stores/requisitions', { method: 'POST', body: payload }),
  issue: async (client, id, lines) => client.request(`/stores/requisitions/${id}/issue`, { method: 'POST', body: { lines } }),
  reject: async (client, id, reason) => client.request(`/stores/requisitions/${id}/reject`, { method: 'POST', body: { reason } })
};

export const PO_STATUS = {
  DRAFT: ['Awaiting approval', 'bg-amber-100 text-amber-900'],
  APPROVED: ['Approved', 'bg-sky-100 text-sky-900'],
  PARTIALLY_RECEIVED: ['Part received', 'bg-violet-100 text-violet-900'],
  RECEIVED: ['Received', 'bg-emerald-100 text-emerald-900'],
  CANCELLED: ['Cancelled', 'bg-slate-200 text-slate-500']
};
export const REQ_STATUS = {
  PENDING: ['Pending', 'bg-amber-100 text-amber-900'],
  ISSUED: ['Issued', 'bg-emerald-100 text-emerald-900'],
  PARTIALLY_ISSUED: ['Part issued', 'bg-violet-100 text-violet-900'],
  REJECTED: ['Rejected', 'bg-red-100 text-red-800']
};
export const CATEGORIES = { CONSUMABLE: 'Consumable', LINEN: 'Linen', STATIONERY: 'Stationery', CLEANING: 'Cleaning', EQUIPMENT: 'Equipment', FOOD: 'Food', OTHER: 'Other' };

