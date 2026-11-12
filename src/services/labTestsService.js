import { buildQuery } from '../api/apiClient';

// The laboratory's test menu (backend /lab/tests): procedures, parameters and reference ranges.
export const labTestsService = {
  list: async (client, params = {}) => client.request(`/lab/tests${buildQuery(params)}`, { cache: false }),
  create: async (client, payload) => client.request('/lab/tests', { method: 'POST', body: payload }),
  update: async (client, id, payload) => client.request(`/lab/tests/${id}`, { method: 'PATCH', body: payload }),
  remove: async (client, id) => client.request(`/lab/tests/${id}`, { method: 'DELETE' }),
  saveParameters: async (client, id, payload) => client.request(`/lab/tests/${id}/parameters`, { method: 'PUT', body: payload })
};
