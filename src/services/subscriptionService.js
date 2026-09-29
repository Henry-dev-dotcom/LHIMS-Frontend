// Subscriptions & billing (backend Phase 5): the facility's own plan, and the
// platform operator's plans, add-on prices and subscriber list.
export const subscriptionService = {
  // Facility administrator
  mine: async (client) => client.request('/subscription'),
  quote: async (client, payload) => client.request('/public/quote', { method: 'POST', body: payload }),
  checkout: async (client, payload) => client.request('/subscription/checkout', { method: 'POST', body: payload }),
  payInvoice: async (client, id) => client.request(`/subscription/invoices/${id}/pay`, { method: 'POST', body: {} }),
  confirm: async (client, reference) => client.request('/subscription/confirm', { method: 'POST', body: { reference } }),
  change: async (client, payload) => client.request('/subscription/change', { method: 'POST', body: payload }),
  cancel: async (client) => client.request('/subscription/cancel', { method: 'POST', body: {} }),
  resume: async (client) => client.request('/subscription/resume', { method: 'POST', body: {} }),

  // Platform operator
  plans: async (client) => client.request('/platform/plans'),
  createPlan: async (client, payload) => client.request('/platform/plans', { method: 'POST', body: payload }),
  updatePlan: async (client, id, payload) => client.request(`/platform/plans/${id}`, { method: 'PATCH', body: payload }),
  modulePrices: async (client) => client.request('/platform/module-prices'),
  setModulePrice: async (client, key, monthlyPrice) => client.request(`/platform/module-prices/${key}`, { method: 'PUT', body: { monthlyPrice } }),
  subscriptions: async (client) => client.request('/platform/subscriptions'),
  runBilling: async (client) => client.request('/platform/billing/run', { method: 'POST', body: {} })
};

export const SUBSCRIPTION_STATUS = {
  TRIALING: ['Free trial', 'bg-sky-100 text-sky-900'],
  ACTIVE: ['Active', 'bg-emerald-100 text-emerald-900'],
  PAST_DUE: ['Payment overdue', 'bg-amber-100 text-amber-900'],
  SUSPENDED: ['Read-only (unpaid)', 'bg-red-100 text-red-800'],
  CANCELLED: ['Ended', 'bg-slate-200 text-slate-600']
};
export const INVOICE_STATUS = {
  OPEN: ['Unpaid', 'bg-amber-100 text-amber-900'],
  PAID: ['Paid', 'bg-emerald-100 text-emerald-900'],
  VOID: ['Replaced', 'bg-slate-200 text-slate-500']
};
export const INVOICE_KIND = { FIRST: 'First period', RENEWAL: 'Renewal', UPGRADE: 'Plan change' };
export const INTERVAL_LABEL = { MONTHLY: 'Monthly', YEARLY: 'Yearly' };

/** Whole days from now until a date (negative when past). */
export function daysUntil(value) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

/** Reads the payment reference the gateway adds to the return address, if any. */
export function paymentReferenceFromUrl() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('reference') || params.get('trxref') || '';
}

export function clearPaymentReferenceFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('reference');
  url.searchParams.delete('trxref');
  window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
}
