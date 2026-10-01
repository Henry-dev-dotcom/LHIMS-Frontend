import { buildQuery } from '../api/apiClient';

/*
  Analyzers that file their own results.

  The ingestion endpoint itself is not here: an instrument posts to it directly
  with its own device key, never through a signed-in browser session. What the
  app needs is the setting up and the watching over.
*/
export const analyzerService = {
  devices: async (client, params = {}) => client.request(`/lab/analyzers${buildQuery(params)}`),
  device: async (client, id) => client.request(`/lab/analyzers/${id}`),
  // The response carries the device's key in plain text, once. It is never
  // readable again, so whatever calls this must show it to the person at once.
  registerDevice: async (client, payload) => client.request('/lab/analyzers', { method: 'POST', body: payload }),
  updateDevice: async (client, id, payload) => client.request(`/lab/analyzers/${id}`, { method: 'PATCH', body: payload }),
  rotateKey: async (client, id) => client.request(`/lab/analyzers/${id}/rotate-key`, { method: 'POST' }),

  testMaps: async (client, params = {}) => client.request(`/lab/analyzers/test-maps${buildQuery(params)}`),
  saveTestMap: async (client, payload) => client.request('/lab/analyzers/test-maps', { method: 'POST', body: payload }),
  deleteTestMap: async (client, id) => client.request(`/lab/analyzers/test-maps/${id}`, { method: 'DELETE' }),
  // Codes the instruments have actually sent that nothing maps yet.
  unmappedCodes: async (client, params = {}) => client.request(`/lab/analyzers/unmapped-codes${buildQuery(params)}`),

  messages: async (client, params = {}) => client.request(`/lab/analyzers/messages${buildQuery(params)}`),
  message: async (client, id) => client.request(`/lab/analyzers/messages/${id}`),
  replayMessage: async (client, id) => client.request(`/lab/analyzers/messages/${id}/replay`, { method: 'POST' }),
  discardMessage: async (client, id, payload) => client.request(`/lab/analyzers/messages/${id}/discard`, { method: 'POST', body: payload }),

  // The path that needs no bridge installed: upload the run the analyzer exported.
  uploadFile: async (client, payload) => client.request('/lab/analyzers/upload', { method: 'POST', body: payload })
};
