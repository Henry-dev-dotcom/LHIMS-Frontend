import { buildQuery } from '../api/apiClient';

// Wards & Admissions module (backend /inpatient).
export const inpatientService = {
  wards: async (client) => client.request('/inpatient/wards'),
  createWard: async (client, payload) => client.request('/inpatient/wards', { method: 'POST', body: payload }),
  updateWard: async (client, id, payload) => client.request(`/inpatient/wards/${id}`, { method: 'PATCH', body: payload }),
  addBeds: async (client, wardId, labels) => client.request(`/inpatient/wards/${wardId}/beds`, { method: 'POST', body: { labels } }),
  setBedStatus: async (client, bedId, status) => client.request(`/inpatient/beds/${bedId}`, { method: 'PATCH', body: { status } }),
  admissions: async (client, params = {}) => client.request(`/inpatient/admissions${buildQuery(params)}`),
  admission: async (client, id) => client.request(`/inpatient/admissions/${id}`),
  admit: async (client, payload) => client.request('/inpatient/admissions', { method: 'POST', body: payload }),
  transfer: async (client, id, payload) => client.request(`/inpatient/admissions/${id}/transfer`, { method: 'POST', body: payload }),
  administer: async (client, id, itemId, payload) => client.request(`/inpatient/admissions/${id}/medications/${itemId}`, { method: 'POST', body: payload }),
  discharge: async (client, id, payload) => client.request(`/inpatient/admissions/${id}/discharge`, { method: 'POST', body: payload }),
  // The whiteboard and the chart are read live: a dose just ticked must show, so none is served from the GET cache.
  board: async (client) => client.request('/inpatient/board', { cache: false }),
  medicationChart: async (client, id, day) => client.request(`/inpatient/admissions/${id}/medication-chart${buildQuery({ date: day })}`, { cache: false }),
  resultsReviewed: async (client, id) => client.request(`/inpatient/admissions/${id}/results-reviewed`, { method: 'POST', body: {} }),
  fluids: async (client, id, days = 3) => client.request(`/inpatient/admissions/${id}/fluids${buildQuery({ days })}`, { cache: false }),
  recordFluid: async (client, id, payload) => client.request(`/inpatient/admissions/${id}/fluids`, { method: 'POST', body: payload }),
  cancel: async (client, id, payload) => client.request(`/inpatient/admissions/${id}/cancel`, { method: 'POST', body: payload })
};
