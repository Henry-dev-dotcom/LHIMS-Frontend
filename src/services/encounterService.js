import { buildQuery } from '../api/apiClient';

// Outpatient visits (backend /encounters) and patient-level clinical data.
export const encounterService = {
  list: async (client, params = {}) => client.request(`/encounters${buildQuery(params)}`),
  get: async (client, id) => client.request(`/encounters/${id}`),
  start: async (client, payload) => client.request('/encounters', { method: 'POST', body: payload }),
  recordVitals: async (client, id, payload) => client.request(`/encounters/${id}/vitals`, { method: 'POST', body: payload }),
  startConsultation: async (client, id) => client.request(`/encounters/${id}/start-consultation`, { method: 'POST', body: {} }),
  addNote: async (client, id, payload) => client.request(`/encounters/${id}/notes`, { method: 'POST', body: payload }),
  addDiagnosis: async (client, id, payload) => client.request(`/encounters/${id}/diagnoses`, { method: 'POST', body: payload }),
  resolveDiagnosis: async (client, id, diagnosisId) => client.request(`/encounters/${id}/diagnoses/${diagnosisId}/resolve`, { method: 'POST', body: {} }),
  order: async (client, id, payload) => client.request(`/encounters/${id}/orders`, { method: 'POST', body: payload }),
  prescribe: async (client, id, payload) => client.request(`/encounters/${id}/prescriptions`, { method: 'POST', body: payload }),
  complete: async (client, id, payload) => client.request(`/encounters/${id}/complete`, { method: 'POST', body: payload }),
  cancel: async (client, id, payload) => client.request(`/encounters/${id}/cancel`, { method: 'POST', body: payload }),
  diagnosisCodes: async (client, q) => client.request(`/encounters/diagnosis-codes${buildQuery({ q })}`),
  addAllergy: async (client, patientId, payload) => client.request(`/patients/${patientId}/allergies`, { method: 'POST', body: payload }),
  timeline: async (client, patientId) => client.request(`/patients/${patientId}/timeline`),
  formulary: async (client, q) => client.request(`/encounters/formulary${buildQuery({ q })}`),
  registerEmergency: async (client, payload) => client.request('/encounters/emergency-arrivals', { method: 'POST', body: payload }),
  searchPatients: async (client, search) => client.request(`/patients${buildQuery({ search, limit: 10 })}`),
  addForm: async (client, id, payload) => client.request(`/encounters/${id}/forms`, { method: 'POST', body: payload }),
  patientForms: async (client, patientId, params = {}) => client.request(`/patients/${patientId}/forms${buildQuery(params)}`),
  catalog: async (client) => client.request(`/catalog${buildQuery({ limit: 100 })}`),
  // The queue and drafts change under the user's feet, so they are never served from the 15-second GET cache.
  // The clinician's queue: new patients, patients sent for tests, patients whose results are back.
  queue: async (client, params = {}) => client.request(`/encounters/queue${buildQuery(params)}`, { cache: false }),
  // Send to Lab & Suspend, and taking the visit back.
  suspend: async (client, id) => client.request(`/encounters/${id}/suspend`, { method: 'POST', body: {} }),
  resume: async (client, id) => client.request(`/encounters/${id}/resume`, { method: 'POST', body: {} }),
  // Unsaved work on a visit; private to the clinician who wrote it.
  getDraft: async (client, id) => client.request(`/encounters/${id}/draft`, { cache: false }),
  saveDraft: async (client, id, data) => client.request(`/encounters/${id}/draft`, { method: 'PUT', body: { data } }),
  discardDraft: async (client, id) => client.request(`/encounters/${id}/draft`, { method: 'DELETE' })
};
