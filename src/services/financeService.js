import { buildQuery } from '../api/apiClient';

export const financeService = {
  shifts: async (client, params = {}) => client.request(`/finance/shifts${buildQuery(params)}`),
  startShift: async (client, payload) => client.request('/finance/shifts/start', { method: 'POST', body: payload }),
  closeShift: async (client, shiftId, payload) => client.request(`/finance/shifts/${shiftId}/close`, { method: 'POST', body: payload }),
  currentShift: async (client) => client.request('/finance/shifts/current'),
  float: async (client, params = {}) => client.request(`/finance/float${buildQuery(params)}`),
  adjustFloat: async (client, payload) => client.request('/finance/float/adjustments', { method: 'POST', body: payload }),
  expenses: async (client, params = {}) => client.request(`/finance/expenses${buildQuery(params)}`),
  createExpense: async (client, payload) => client.request('/finance/expenses', { method: 'POST', body: payload }),
  updateExpense: async (client, expenseId, payload) => client.request(`/finance/expenses/${expenseId}`, { method: 'PATCH', body: payload }),
  payExpense: async (client, expenseId, payload) => client.request(`/finance/expenses/${expenseId}/payment`, { method: 'POST', body: payload }),
  writeOffExpense: async (client, expenseId, payload) => client.request(`/finance/expenses/${expenseId}/write-off`, { method: 'POST', body: payload }),
  ledger: async (client, params = {}) => client.request(`/finance/ledger${buildQuery(params)}`),
  analytics: async (client, params = {}) => client.request(`/finance/analytics${buildQuery(params)}`),
  ageing: async (client) => client.request('/finance/ageing')
};
