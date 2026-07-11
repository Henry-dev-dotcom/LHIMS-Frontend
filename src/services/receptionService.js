import { buildQuery } from '../api/apiClient';

export const receptionService = {
  incomingOrders: async (client, params = {}) => client.request(`/reception/incoming-orders${buildQuery(params)}`),
  confirmOrder: async (client, orderId, payload = {}) => client.request(`/reception/orders/${orderId}/confirm`, { method: 'POST', body: payload }),
  checkIn: async (client, payload) => client.request('/reception/check-in', { method: 'POST', body: payload }),
  walkIn: async (client, payload) => client.request('/reception/walk-ins', { method: 'POST', body: payload }),
  appointments: async (client, params = {}) => client.request(`/reception/appointments${buildQuery(params)}`),
  createAppointment: async (client, payload) => client.request('/reception/appointments', { method: 'POST', body: payload }),
  updateAppointment: async (client, appointmentId, payload) => client.request(`/reception/appointments/${appointmentId}`, { method: 'PATCH', body: payload }),
  dailyVisits: async (client, params = {}) => client.request(`/reception/daily-visits${buildQuery(params)}`),
  resultsInbox: async (client, params = {}) => client.request(`/reception/results-inbox${buildQuery(params)}`),
  sendSafeNotice: async (client, resultId, payload) => client.request(`/reception/results/${resultId}/send-notice`, { method: 'POST', body: payload })
};
