import { buildQuery, requestArrayBuffer } from '../api/apiClient';

// The patient directory, a patient's chart and past visits, and the document vault (backend /records).
// Reads of a record always state why, so the server can log who opened what and for what reason.
// None of these is served from the 15-second GET cache: a record that was just changed must show it.
export const directoryService = {
  list: async (client, params = {}) => client.request(`/records/directory${buildQuery(params)}`, { cache: false }),
  chart: async (client, patientId, purpose, note) => client.request(`/records/patients/${patientId}/chart${buildQuery({ purpose, note })}`, { cache: false }),
  visit: async (client, patientId, encounterId, purpose) => client.request(`/records/patients/${patientId}/encounters/${encounterId}${buildQuery({ purpose })}`, { cache: false }),
  documents: async (client, patientId) => client.request(`/records/patients/${patientId}/documents`, { cache: false }),
  upload: async (client, patientId, body) => client.request(`/records/patients/${patientId}/documents`, { method: 'POST', body }),
  // Raw bytes, sent with the same credentials as every other call.
  download: (documentId) => requestArrayBuffer(`/records/documents/${documentId}/download`)
};
