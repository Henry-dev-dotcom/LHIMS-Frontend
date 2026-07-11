import { buildQuery } from '../api/apiClient';

export const notificationService = {
  list: async (client, params = {}) => client.request(`/notifications${buildQuery(params)}`),
  create: async (client, payload) => client.request('/notifications', { method: 'POST', body: payload }),
  markRead: async (client, notificationId) => client.request(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
  markUnread: async (client, notificationId) => client.request(`/notifications/${notificationId}/unread`, { method: 'PATCH' }),
  markAllRead: async (client) => client.request('/notifications/read-all', { method: 'PATCH' }),
  deliver: async (client, notificationId, payload) => client.request(`/notifications/${notificationId}/deliver`, { method: 'POST', body: payload }),
  logs: async (client, params = {}) => client.request(`/notifications/logs${buildQuery(params)}`),
  retry: async (client, logId, payload = {}) => client.request(`/notifications/logs/${logId}/retry`, { method: 'POST', body: payload }),
  preferences: async (client) => client.request('/notifications/preferences'),
  updatePreferences: async (client, payload) => client.request('/notifications/preferences', { method: 'PATCH', body: payload }),
  updateSettings: async (client, payload) => client.request('/notifications/settings', { method: 'PATCH', body: payload })
};
