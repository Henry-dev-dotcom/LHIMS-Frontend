import { API_MODES, clearStoredTokens, getApiConfig, getStoredTokens, setStoredTokens } from './config';
import { createMockBackend } from './mockBackend';

export class ApiError extends Error {
  constructor(message, { status = 500, details = null, requestId = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export function unwrapApiEnvelope(payload) {
  if (payload && typeof payload === 'object' && payload.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }
  return payload;
}

export function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      return;
    }
    query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

function normalizeHeaders({ body, headers, token, skipAuth }) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  return {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    // Browser sessions authenticate via the httpOnly cookie (sent automatically
    // with credentials: 'include'). An explicit `token` is only honored for
    // non-browser API callers that pass one directly.
    ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers
  };
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// A single in-flight refresh is shared across concurrent 401s so a burst of
// requests triggers only one token renewal instead of a stampede.
let refreshPromise = null;

async function refreshAccessToken() {
  // The refresh token lives in an httpOnly cookie sent automatically with the
  // request, so no token is read or passed from JavaScript.
  if (!refreshPromise) {
    refreshPromise = executeRequest('/auth/refresh', {
      method: 'POST',
      skipAuth: true
    })
      .then((data) => {
        setStoredTokens(data);
        return data;
      })
      .catch(() => {
        clearStoredTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function executeRequest(path, { method = 'GET', body, token, headers = {}, signal, skipAuth = false, unwrap = true } = {}) {
  const config = getApiConfig();
  const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), config.timeoutMs);
  // Forward an external abort onto the internal controller so both the caller's
  // signal and the timeout can cancel the same fetch.
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  try {
    const response = await fetch(url, {
      method,
      headers: normalizeHeaders({ body, headers, token, skipAuth }),
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      // Send the httpOnly auth cookies on same-site and CORS requests.
      credentials: 'include',
      signal: controller.signal
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new ApiError(payload?.message || `Request failed: ${response.status}`, {
        status: response.status,
        details: payload,
        requestId: payload?.requestId || response.headers.get('x-request-id') || ''
      });
    }
    return unwrap ? unwrapApiEnvelope(payload) : payload;
  } finally {
    window.clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}

export async function request(path, options = {}) {
  const { skipAuth = false, token, _retried = false } = options;
  try {
    return await executeRequest(path, options);
  } catch (error) {
    // On an expired access token, attempt a one-time silent refresh and retry.
    // Skipped for unauthenticated calls and calls with an explicit token.
    if (error instanceof ApiError && error.status === 401 && !skipAuth && !token && !_retried) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return request(path, { ...options, _retried: true });
      clearStoredTokens();
    }
    throw error;
  }
}

export async function loginRequest(credentials) {
  const data = await request('/auth/login', { method: 'POST', body: credentials, skipAuth: true });
  setStoredTokens(data);
  return data;
}

export async function logoutRequest() {
  try {
    // The refresh cookie identifies the session server-side; no body needed.
    return await request('/auth/logout', { method: 'POST' });
  } finally {
    clearStoredTokens();
  }
}

export function createApiClient({ mode, data, auth } = {}) {
  const config = getApiConfig();
  const activeMode = mode || config.mode;
  if (activeMode === API_MODES.MOCK) {
    const mock = createMockBackend(data);
    return {
      mode: API_MODES.MOCK,
      config,
      mock,
      auth,
      get: async (resolver, ...args) => {
        await new Promise((resolve) => window.setTimeout(resolve, config.demoDelayMs));
        return typeof resolver === 'function' ? resolver(...args) : resolver;
      }
    };
  }
  return {
    mode: API_MODES.LIVE,
    config,
    auth,
    request,
    login: loginRequest,
    logout: logoutRequest,
    tokens: getStoredTokens()
  };
}
