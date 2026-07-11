import { buildQuery } from '../api/apiClient';

export const billingService = {
  invoices: async (client, params = {}) => client.request(`/billing/invoices${buildQuery(params)}`),
  invoiceDetail: async (client, invoiceId) => client.request(`/billing/invoices/${invoiceId}`),
  updateInvoice: async (client, invoiceId, payload) => client.request(`/billing/invoices/${invoiceId}`, { method: 'PATCH', body: payload }),
  recordPayment: async (client, invoiceId, payload) => client.request(`/billing/invoices/${invoiceId}/payments`, { method: 'POST', body: payload }),
  refund: async (client, invoiceId, payload) => client.request(`/billing/invoices/${invoiceId}/refund`, { method: 'POST', body: payload }),
  receipt: async (client, receiptId) => client.request(`/billing/receipts/${receiptId}`)
};
