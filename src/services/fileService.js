import { buildQuery } from '../api/apiClient';

export const fileService = {
  list: async (client, params = {}) => client.request(`/files${buildQuery(params)}`),
  upload: async (client, files = [], metadata = {}) => client.request('/files/upload', { method: 'POST', body: { files, metadata } }),
  detail: async (client, fileId) => client.request(`/files/${fileId}`),
  download: async (client, fileId) => client.request(`/files/${fileId}/download`),
  delete: async (client, fileId) => client.request(`/files/${fileId}`, { method: 'DELETE' }),
  attachToScanResult: async (client, resultId, files) => client.request(`/scan/results/${resultId}/files`, { method: 'POST', body: { files } }),
  attachToLabResult: async (client, resultId, files) => client.request(`/lab/results/${resultId}/files`, { method: 'POST', body: { files } }),
  dicomStudies: async (client, params = {}) => client.request(`/files/dicom/studies${buildQuery(params)}`),
  dicomStudy: async (client, studyUid) => client.request(`/files/dicom/studies/${studyUid}`)
};
