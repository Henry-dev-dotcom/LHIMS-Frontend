import { buildQuery } from '../api/apiClient';

export const messageService = {
  channels: async (client) => client.request('/messages/channels', { cache: false }),
  // These conversations are also polled, and must bypass the short-lived GET cache.
  listDepartment: async (client, department, params = {}) => client.request(`/messages/departments/${department}${buildQuery(params)}`, { cache: false }),
  // Never from the client's short-lived GET cache. This is polled every fifteen
  // seconds to bring in what other people have said, and the cache lives fifteen
  // seconds: a poll could be answered from the previous poll's copy, so a message
  // would arrive up to half a minute late - or, with unlucky timing, not on this
  // poll at all.
  list: async (client, channel, params = {}) => client.request(`/messages/${channel}${buildQuery(params)}`, { cache: false }),
  send: async (client, payload) => client.request('/messages', { method: 'POST', body: payload })
};
