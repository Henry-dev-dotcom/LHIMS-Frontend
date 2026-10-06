import { buildQuery } from '../api/apiClient';

export const messageService = {
  channels: async (client) => client.request('/messages/channels'),
  list: async (client, channel, params = {}) => client.request(`/messages/${channel}${buildQuery(params)}`),
  send: async (client, payload) => client.request('/messages', { method: 'POST', body: payload })
};
