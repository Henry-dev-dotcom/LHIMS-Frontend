import { buildQuery } from '../api/apiClient';

export const reportService = {
  overview: async (client, filters = {}) => client.request(`/reports${buildQuery(filters)}`),
  dashboard: async (client, filters = {}) => client.request(`/reports/dashboard${buildQuery(filters)}`),
  financeAnalytics: async (client, filters = {}) => client.request(`/reports/analytics/finance${buildQuery(filters)}`),
  labAnalytics: async (client, filters = {}) => client.request(`/reports/analytics/lab${buildQuery(filters)}`),
  scanAnalytics: async (client, filters = {}) => client.request(`/reports/analytics/scan${buildQuery(filters)}`),
  receptionAnalytics: async (client, filters = {}) => client.request(`/reports/analytics/reception${buildQuery(filters)}`),
  auditAnalytics: async (client, filters = {}) => client.request(`/reports/analytics/audit${buildQuery(filters)}`),
  tat: async (client, filters = {}) => client.request(`/reports/tat${buildQuery(filters)}`),
  volume: async (client, filters = {}) => client.request(`/reports/order-volume${buildQuery(filters)}`),
  revenue: async (client, filters = {}) => client.request(`/reports/revenue${buildQuery(filters)}`),
  outstanding: async (client, filters = {}) => client.request(`/reports/outstanding${buildQuery(filters)}`),
  abnormal: async (client, filters = {}) => client.request(`/reports/abnormal-results${buildQuery(filters)}`),
  productivity: async (client, filters = {}) => client.request(`/reports/staff-productivity${buildQuery(filters)}`),
  resultsDelivery: async (client, filters = {}) => client.request(`/reports/results-delivery${buildQuery(filters)}`),
  export: async (client, type, filters = {}) => client.request(`/reports/export${buildQuery({ type, ...filters })}`)
};
