// Platform operator endpoints: manage subscribing facilities (tenants).
export const platformService = {
  facilities: async (client) => client.request('/platform/facilities'),
  createFacility: async (client, payload) => client.request('/platform/facilities', { method: 'POST', body: payload }),
  updateFacility: async (client, facilityId, payload) =>
    client.request(`/platform/facilities/${facilityId}`, { method: 'PATCH', body: payload })
};
