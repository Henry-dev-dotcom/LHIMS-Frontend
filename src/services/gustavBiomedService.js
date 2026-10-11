export const gustavBiomedService = {
  storeRequests: (client) => client.request('/stores/gustav-biomed/requests'),
  createSupplyRequest: (client, body) => client.request('/stores/gustav-biomed/requests', { method: 'POST', body }),
  maintenanceRequests: (client) => client.request('/lab/gustav-biomed/maintenance-requests'),
  createMaintenanceRequest: (client, body) => client.request('/lab/gustav-biomed/maintenance-requests', { method: 'POST', body }),
  updateStatus: (client, id, body) => client.request(`/stores/gustav-biomed/requests/${id}/status`, { method: 'PATCH', body })
};
