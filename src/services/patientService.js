import { buildQuery } from '../api/apiClient';

export const patientService = {
  list: async (client, params = {}) => client.request(`/patients${buildQuery(params)}`),
  detail: async (client, patientId) => client.request(`/patients/${patientId}`),
  create: async (client, payload) => client.request('/patients', { method: 'POST', body: payload }),
  update: async (client, patientId, payload) => client.request(`/patients/${patientId}`, { method: 'PATCH', body: payload }),
  orders: async (client, patientId) => client.request(`/patients/${patientId}/orders`),
  trends: async (client, patientId) => client.request(`/patients/${patientId}/trends`),
  duplicates: async (client, payload) => client.request('/patients/check-duplicates', { method: 'POST', body: payload })
};
