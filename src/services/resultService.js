import { buildQuery } from '../api/apiClient';

export const resultService = {
  list: async (client, params = {}) => client.request(`/results${buildQuery(params)}`),
  detail: async (client, resultId) => client.request(`/results/${resultId}`),
  release: async (client, resultId, payload = {}) => client.request(`/results/${resultId}/release`, { method: 'POST', body: payload }),
  report: async (client, resultId) => client.request(`/results/${resultId}/report`),
  email: async (client, resultId, payload) => client.request(`/results/${resultId}/email`, { method: 'POST', body: payload }),
  sms: async (client, resultId, payload) => client.request(`/results/${resultId}/sms`, { method: 'POST', body: payload }),
  whatsapp: async (client, resultId, payload) => client.request(`/results/${resultId}/whatsapp`, { method: 'POST', body: payload }),
  deliveryLogs: async (client, params = {}) => client.request(`/results/delivery-logs${buildQuery(params)}`),
  retryDelivery: async (client, logId, payload = {}) => client.request(`/results/delivery/logs/${logId}/retry`, { method: 'POST', body: payload })
};
