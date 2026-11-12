// Cross-facility delta check (backend /lab/delta-check).
export const deltaCheckService = {
  partners: async (client) => client.request('/lab/delta-check/partners', { cache: false }),
  requests: async (client) => client.request('/lab/delta-check/requests', { cache: false }),
  inbox: async (client) => client.request('/lab/delta-check/inbox', { cache: false }),
  create: async (client, payload) => client.request('/lab/delta-check/requests', { method: 'POST', body: payload }),
  cancel: async (client, id) => client.request(`/lab/delta-check/requests/${id}/cancel`, { method: 'POST', body: {} }),
  respond: async (client, id, payload) => client.request(`/lab/delta-check/inbox/${id}/respond`, { method: 'POST', body: payload }),
  comparison: async (client, id) => client.request(`/lab/delta-check/requests/${id}/comparison`, { cache: false })
};
