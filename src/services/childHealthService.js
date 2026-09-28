import { buildQuery } from '../api/apiClient';

// Child Health & Immunisation module (backend /child-health).
export const childHealthService = {
  immunizations: async (client, patientId) => client.request(`/child-health/patients/${patientId}/immunizations`),
  record: async (client, patientId, payload) => client.request(`/child-health/patients/${patientId}/immunizations`, { method: 'POST', body: payload }),
  void: async (client, id, payload) => client.request(`/child-health/immunizations/${id}/void`, { method: 'POST', body: payload }),
  dueList: async (client, params = {}) => client.request(`/child-health/due-list${buildQuery(params)}`)
};

export const DOSE_STATUS = {
  GIVEN: { label: 'Given', className: 'bg-emerald-100 text-emerald-900' },
  DUE: { label: 'Due', className: 'bg-amber-100 text-amber-900' },
  OVERDUE: { label: 'Overdue', className: 'bg-red-600 text-white' },
  UPCOMING: { label: 'Upcoming', className: 'bg-slate-100 text-slate-600' },
  WAITING: { label: 'After previous dose', className: 'bg-slate-50 text-slate-500' },
  MISSED_WINDOW: { label: 'Window passed', className: 'bg-slate-200 text-slate-500 line-through' }
};

/** Under five years old (the child health service's age range). */
export function isUnderFive(dateOfBirth) {
  if (!dateOfBirth) return false;
  return Date.now() - new Date(dateOfBirth).getTime() < 5 * 365.25 * 86_400_000;
}
