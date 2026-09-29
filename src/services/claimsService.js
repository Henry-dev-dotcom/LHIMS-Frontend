import { buildQuery } from '../api/apiClient';

// Insurance Claims module (backend /claims).
export const claimsService = {
  schemes: async (client) => client.request('/claims/schemes'),
  createScheme: async (client, payload) => client.request('/claims/schemes', { method: 'POST', body: payload }),
  memberships: async (client, patientId) => client.request(`/claims/patients/${patientId}/memberships`),
  addMembership: async (client, patientId, payload) => client.request(`/claims/patients/${patientId}/memberships`, { method: 'POST', body: payload }),
  claims: async (client, params = {}) => client.request(`/claims${buildQuery(params)}`),
  claim: async (client, id) => client.request(`/claims/${id}`),
  candidates: async (client, schemeId) => client.request(`/claims/candidates${buildQuery({ schemeId })}`),
  create: async (client, payload) => client.request('/claims', { method: 'POST', body: payload }),
  submit: async (client, claimIds) => client.request('/claims/submit', { method: 'POST', body: { claimIds } }),
  cancel: async (client, id, reason) => client.request(`/claims/${id}/cancel`, { method: 'POST', body: { reason } }),
  query: async (client, id, note) => client.request(`/claims/${id}/query`, { method: 'POST', body: { note } }),
  decide: async (client, id, payload) => client.request(`/claims/${id}/decision`, { method: 'POST', body: payload }),
  pay: async (client, id, payload) => client.request(`/claims/${id}/payment`, { method: 'POST', body: payload }),
  batches: async (client, schemeId) => client.request(`/claims/batches${buildQuery({ schemeId })}`),
  closeBatch: async (client, id) => client.request(`/claims/batches/${id}/close`, { method: 'POST', body: {} })
};

export const CLAIM_STATUS = {
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
  SUBMITTED: { label: 'Submitted', className: 'bg-sky-100 text-sky-900' },
  QUERIED: { label: 'Queried', className: 'bg-amber-100 text-amber-900' },
  APPROVED: { label: 'Approved', className: 'bg-violet-100 text-violet-900' },
  PAID: { label: 'Paid', className: 'bg-emerald-100 text-emerald-900' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-200 text-slate-500' }
};

export const money = (v) => Number(v ?? 0).toFixed(2);
