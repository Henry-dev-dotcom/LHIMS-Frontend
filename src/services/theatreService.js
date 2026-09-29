import { buildQuery } from '../api/apiClient';

// Theatre & Surgery module (backend /theatre).
export const theatreService = {
  theatres: async (client) => client.request('/theatre/theatres'),
  createTheatre: async (client, payload) => client.request('/theatre/theatres', { method: 'POST', body: payload }),
  updateTheatre: async (client, id, payload) => client.request(`/theatre/theatres/${id}`, { method: 'PATCH', body: payload }),
  surgeries: async (client, params = {}) => client.request(`/theatre/surgeries${buildQuery(params)}`),
  surgery: async (client, id) => client.request(`/theatre/surgeries/${id}`),
  schedule: async (client, payload) => client.request('/theatre/surgeries', { method: 'POST', body: payload }),
  reschedule: async (client, id, payload) => client.request(`/theatre/surgeries/${id}`, { method: 'PATCH', body: payload }),
  signIn: async (client, id, payload) => client.request(`/theatre/surgeries/${id}/sign-in`, { method: 'POST', body: payload }),
  timeOut: async (client, id, payload) => client.request(`/theatre/surgeries/${id}/time-out`, { method: 'POST', body: payload }),
  complete: async (client, id, payload) => client.request(`/theatre/surgeries/${id}/complete`, { method: 'POST', body: payload }),
  cancel: async (client, id, payload) => client.request(`/theatre/surgeries/${id}/cancel`, { method: 'POST', body: payload })
};

/** Procedures are SERVICE catalog items whose code starts with PROC-; other services are visit fees. */
export const isProcedureItem = (item) => item?.type === 'SERVICE' && /^PROC-/i.test(item.catalogCode || '');

/** Service items charged by their own department, never as a visit fee (procedures, mortuary storage). */
export const isNonVisitService = (item) => item?.type === 'SERVICE' && /^(PROC|MORT)-/i.test(item.catalogCode || '');

export const ANAESTHESIA = {
  GENERAL: 'General',
  SPINAL: 'Spinal',
  EPIDURAL: 'Epidural',
  REGIONAL_BLOCK: 'Regional block',
  LOCAL: 'Local',
  SEDATION: 'Sedation'
};
