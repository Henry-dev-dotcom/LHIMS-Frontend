import { buildQuery } from '../api/apiClient';

// Pharmacy module (backend /pharmacy).
export const pharmacyService = {
  drugs: async (client, params = {}) => client.request(`/pharmacy/drugs${buildQuery(params)}`),
  createDrug: async (client, payload) => client.request('/pharmacy/drugs', { method: 'POST', body: payload }),
  updateDrug: async (client, id, payload) => client.request(`/pharmacy/drugs/${id}`, { method: 'PATCH', body: payload }),
  receiveBatch: async (client, id, payload) => client.request(`/pharmacy/drugs/${id}/batches`, { method: 'POST', body: payload }),
  adjust: async (client, id, payload) => client.request(`/pharmacy/drugs/${id}/adjustments`, { method: 'POST', body: payload }),
  movements: async (client, id) => client.request(`/pharmacy/drugs/${id}/movements`),
  queue: async (client, status = 'PENDING') => client.request(`/pharmacy/prescriptions${buildQuery({ status })}`),
  prescription: async (client, id) => client.request(`/pharmacy/prescriptions/${id}`),
  dispense: async (client, id, payload) => client.request(`/pharmacy/prescriptions/${id}/dispense`, { method: 'POST', body: payload })
};

/** True when the API refused because of a recorded allergy (the user may override with a reason). */
export function isAllergyConflict(error) {
  return error?.details?.code === 'ALLERGY_CONFLICT';
}
