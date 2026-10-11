import { ApiError, unwrapApiEnvelope } from '../api/apiClient';
import { getApiConfig } from '../api/config';

// Vendor access tokens intentionally live only in memory; the rotating refresh token
// stays in the vendor-specific HttpOnly cookie and is never persisted in localStorage.
let accessToken = null;
let refreshInFlight = null;

async function rawVendorRequest(path, { method = 'GET', body, authenticated = true } = {}) {
  const { baseUrl } = getApiConfig();
  const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(authenticated && accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!response.ok) {
    throw new ApiError(payload?.message || `Request failed: ${response.status}`, {
      status: response.status,
      details: payload,
      requestId: payload?.requestId || response.headers.get('x-request-id') || ''
    });
  }
  return unwrapApiEnvelope(payload);
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = rawVendorRequest('/vendor/auth/refresh', { method: 'POST', authenticated: false })
      .then((result) => {
        accessToken = result.accessToken;
        return accessToken;
      })
      .catch((error) => {
        accessToken = null;
        throw error;
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function authenticatedRequest(path, options = {}, alreadyRetried = false) {
  if (!accessToken) await refreshAccessToken();
  try {
    return await rawVendorRequest(path, { ...options, authenticated: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !alreadyRetried) {
      accessToken = null;
      await refreshAccessToken();
      return authenticatedRequest(path, options, true);
    }
    throw error;
  }
}

export const vendorPortalService = {
  async login(email, password) {
    accessToken = null;
    const result = await rawVendorRequest('/vendor/auth/login', {
      method: 'POST', body: { email, password }, authenticated: false
    });
    accessToken = result.accessToken;
    return result.user;
  },
  async activate(token, password) {
    accessToken = null;
    const result = await rawVendorRequest('/vendor/auth/activate', {
      method: 'POST', body: { token, password }, authenticated: false
    });
    accessToken = result.accessToken;
    return result.user;
  },
  me: () => authenticatedRequest('/vendor/auth/me'),
  async logout() {
    try { await authenticatedRequest('/vendor/auth/logout', { method: 'POST' }); }
    finally { accessToken = null; }
  },
  listRequests({ status, type, search, cursor, limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (search) params.set('search', search);
    if (cursor) params.set('cursor', cursor);
    params.set('limit', String(limit));
    return authenticatedRequest(`/vendor/requests?${params.toString()}`);
  },
  updateStatus(id, payload) {
    return authenticatedRequest(`/vendor/requests/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: payload });
  },
  clearSession() { accessToken = null; },
  listPartners(apiClient) { return apiClient.request('/platform/vendor-partners'); },
  createInvitation(apiClient, partnerId, payload) {
    return apiClient.request(`/platform/vendor-partners/${encodeURIComponent(partnerId)}/invitations`, { method: 'POST', body: payload });
  },
  setUserStatus(apiClient, userId, status) {
    return apiClient.request(`/platform/vendor-portal-users/${encodeURIComponent(userId)}/status`, { method: 'PATCH', body: { status } });
  }
};
