import { buildQuery } from '../api/apiClient';

function resourceService(path) {
  return {
    list: async (client, params = {}) => client.request(`${path}${buildQuery(params)}`),
    create: async (client, payload) => client.request(path, { method: 'POST', body: payload }),
    update: async (client, id, payload) => client.request(`${path}/${id}`, { method: 'PATCH', body: payload })
  };
}

export const adminService = {
  users: async (client, params = {}) => client.request(`/admin/users${buildQuery(params)}`),
  createUser: async (client, payload) => client.request('/admin/users', { method: 'POST', body: payload }),
  updateUser: async (client, userId, payload) => client.request(`/admin/users/${userId}`, { method: 'PATCH', body: payload }),
  // Facility-defined staff roles.
  permissions: async (client) => client.request('/admin/permissions'),
  roles: async (client) => client.request('/admin/roles'),
  createRole: async (client, payload) => client.request('/admin/roles', { method: 'POST', body: payload }),
  updateRole: async (client, roleId, payload) => client.request(`/admin/roles/${roleId}`, { method: 'PATCH', body: payload }),
  deleteRole: async (client, roleId) => client.request(`/admin/roles/${roleId}`, { method: 'DELETE' }),
  hospitals: async (client, params = {}) => client.request(`/admin/hospitals${buildQuery(params)}`),
  createHospital: async (client, payload) => client.request('/admin/hospitals', { method: 'POST', body: payload }),
  updateHospital: async (client, hospitalId, payload) => client.request(`/admin/hospitals/${hospitalId}`, { method: 'PATCH', body: payload }),
  doctors: async (client, params = {}) => client.request(`/admin/doctors${buildQuery(params)}`),
  createDoctor: async (client, payload) => client.request('/admin/doctors', { method: 'POST', body: payload }),
  updateDoctor: async (client, doctorId, payload) => client.request(`/admin/doctors/${doctorId}`, { method: 'PATCH', body: payload }),
  catalog: async (client, params = {}) => client.request(`/admin/catalog${buildQuery(params)}`),
  createCatalogItem: async (client, payload) => client.request('/admin/catalog', { method: 'POST', body: payload }),
  updateCatalogItem: async (client, itemId, payload) => client.request(`/admin/catalog/${itemId}`, { method: 'PATCH', body: payload }),
  referenceRanges: async (client, params = {}) => client.request(`/admin/reference-ranges${buildQuery(params)}`),
  departments: resourceService('/admin/departments'),
  equipment: resourceService('/admin/equipment'),
  auditLogs: async (client, params = {}) => client.request(`/admin/audit-logs${buildQuery(params)}`),
  systemEvents: async (client, params = {}) => client.request(`/admin/system-events${buildQuery(params)}`),
  apiRequestLogs: async (client, params = {}) => client.request(`/admin/api-request-logs${buildQuery(params)}`),
  auditSummary: async (client, params = {}) => client.request(`/admin/audit-summary${buildQuery(params)}`),
  auditExport: async (client, params = {}) => client.request(`/admin/audit-export${buildQuery(params)}`),
  exportConfig: async (client) => client.request('/admin/config-export'),
  fullExport: async (client) => client.request('/admin/full-export')
};
