import { buildQuery } from '../api/apiClient';

// Blood Bank module (backend /blood-bank).
export const bloodBankService = {
  stock: async (client) => client.request('/blood-bank/stock'),
  units: async (client, params = {}) => client.request(`/blood-bank/units${buildQuery(params)}`),
  discard: async (client, id, reason) => client.request(`/blood-bank/units/${id}/discard`, { method: 'POST', body: { reason } }),
  donors: async (client, search) => client.request(`/blood-bank/donors${buildQuery({ search })}`),
  donor: async (client, id) => client.request(`/blood-bank/donors/${id}`),
  registerDonor: async (client, payload) => client.request('/blood-bank/donors', { method: 'POST', body: payload }),
  donate: async (client, donorId, payload) => client.request(`/blood-bank/donors/${donorId}/donations`, { method: 'POST', body: payload }),
  screen: async (client, donationId, payload) => client.request(`/blood-bank/donations/${donationId}/screening`, { method: 'POST', body: payload }),
  requests: async (client, params = {}) => client.request(`/blood-bank/requests${buildQuery(params)}`),
  request: async (client, id) => client.request(`/blood-bank/requests/${id}`),
  createRequest: async (client, payload) => client.request('/blood-bank/requests', { method: 'POST', body: payload }),
  crossmatch: async (client, id, payload) => client.request(`/blood-bank/requests/${id}/crossmatch`, { method: 'POST', body: payload }),
  issue: async (client, id, unitId) => client.request(`/blood-bank/requests/${id}/issue`, { method: 'POST', body: { unitId } }),
  emergency: async (client, id, payload) => client.request(`/blood-bank/requests/${id}/emergency-release`, { method: 'POST', body: payload }),
  cancel: async (client, id, reason) => client.request(`/blood-bank/requests/${id}/cancel`, { method: 'POST', body: { reason } }),
  transfusion: async (client, id, payload) => client.request(`/blood-bank/transfusions/${id}`, { method: 'POST', body: payload })
};

export const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
export const COMPONENTS = { PACKED_RED_CELLS: 'Packed red cells', WHOLE_BLOOD: 'Whole blood', FRESH_FROZEN_PLASMA: 'Fresh frozen plasma', PLATELETS: 'Platelets', CRYOPRECIPITATE: 'Cryoprecipitate' };

// Mirrors backend src/services/bloodCompatibility.ts, only to narrow the choices shown; the server decides.
const antigens = { O: [], A: ['A'], B: ['B'], AB: ['A', 'B'] };
const abo = (g) => g.slice(0, -1);
const rhPos = (g) => g.endsWith('+');
export function isCompatible(component, recipient, donor) {
  if (component === 'PACKED_RED_CELLS') return antigens[abo(donor)].every((a) => antigens[abo(recipient)].includes(a)) && (rhPos(recipient) || !rhPos(donor));
  if (component === 'WHOLE_BLOOD') return abo(recipient) === abo(donor) && (rhPos(recipient) || !rhPos(donor));
  return antigens[abo(recipient)].every((a) => antigens[abo(donor)].includes(a));
}
