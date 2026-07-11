import { buildQuery } from '../api/apiClient';

export const doctorService = {
  profile: async (client) => client.request('/doctor/profile'),
  updateProfile: async (client, payload) => client.request('/doctor/profile', { method: 'PATCH', body: payload }),
  patients: async (client, params = {}) => client.request(`/doctor/patients${buildQuery(params)}`),
  createOrder: async (client, payload) => client.request('/doctor/orders', { method: 'POST', body: payload }),
  activeOrders: async (client, params = {}) => client.request(`/doctor/orders/active${buildQuery(params)}`),
  completedOrders: async (client, params = {}) => client.request(`/doctor/orders/completed${buildQuery(params)}`),
  results: async (client, params = {}) => client.request(`/doctor/results${buildQuery(params)}`),
  patientTrends: async (client, patientId) => client.request(`/doctor/patient-trends/${patientId}`)
};
