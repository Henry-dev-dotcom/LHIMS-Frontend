import { API_MODES, clearFallbackTokens, clearStoredTokens, getApiConfig, getFallbackTokens, getStoredTokens, setFallbackTokens, setStoredTokens } from './config';

export class ApiError extends Error {
  constructor(message, { status = 500, details = null, requestId = '', code = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.requestId = requestId;
    // Set for failures that never reached the server, so callers can tell a
    // refused request from one that could not be made at all.
    this.code = code;
  }
}

/*
  A request can fail three ways before the server ever answers, and they need
  different words.

  A host that sleeps when idle - which free hosting does - takes the better part
  of a minute to wake. Left alone, the browser's own AbortError reaches the
  screen as "signal is aborted without reason", which tells nobody anything and
  reads like a crash. The first thing a visitor sees should not be that.
*/
export const REQUEST_TIMED_OUT = 'REQUEST_TIMED_OUT';
export const SERVER_UNREACHABLE = 'SERVER_UNREACHABLE';

const TIMED_OUT_MESSAGE = 'The server is taking longer than usual to answer. If it has been idle it may be starting up, which can take up to a minute — please try again.';
const UNREACHABLE_MESSAGE = 'We could not reach the server. Check your internet connection and try again.';

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
  /*
    The httpOnly cookie is still the first choice and is sent automatically with
    credentials: 'include'. A bearer token is added only where the cookie has
    been shown not to arrive - a browser that refuses third-party cookies - or
    when a caller passes one explicitly.
  */
  const bearer = token || getFallbackTokens().accessToken;
  return {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(!skipAuth && bearer ? { Authorization: `Bearer ${bearer}` } : {}),
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
// Short-lived, per-tab caching prevents duplicate reads when multiple widgets
// mount together. Mutations clear it so clinical lists do not remain stale.
const GET_CACHE_TTL_MS = 15_000;
const GET_CACHE_MAX_ENTRIES = 200;
const responseCache = new Map();
const inFlightGets = new Map();
const CACHEABLE_GET_PREFIXES = ['/patients', '/orders', '/catalog', '/public', '/notifications', '/messages', '/reports', '/billing', '/lab', '/scan', '/reception', '/admin', '/platform', '/subscription'];
function isCacheableGet(path, options) {
  const method = (options.method || 'GET').toUpperCase();
  return method === 'GET' && options.cache !== false && CACHEABLE_GET_PREFIXES.some((prefix) => path.startsWith(prefix)) && !path.startsWith('/auth/') && !path.includes('/files');
}
function clearResponseCache() {
  responseCache.clear();
}
function readCachedResponse(key) {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return undefined;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value;
}
function writeCachedResponse(key, value) {
  responseCache.delete(key);
  responseCache.set(key, { value, expiresAt: Date.now() + GET_CACHE_TTL_MS });
  while (responseCache.size > GET_CACHE_MAX_ENTRIES) responseCache.delete(responseCache.keys().next().value);
}
function getCacheKey(path) {
  const config = getApiConfig();
  const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  return `${url}|${getFallbackTokens().accessToken || 'cookie-session'}`;
}

async function refreshAccessToken() {
  // Normally the refresh token rides in an httpOnly cookie and nothing is read
  // from JavaScript. Where that cookie is refused, the stored one is sent in the
  // body instead - which the endpoint already accepts.
  const stored = getFallbackTokens();
  if (!refreshPromise) {
    refreshPromise = executeRequest('/auth/refresh', {
      method: 'POST',
      skipAuth: true,
      ...(stored.refreshToken ? { body: { refreshToken: stored.refreshToken } } : {})
    })
      .then((data) => {
        setStoredTokens(data);
        // Keep the fallback in step, but only if it was already in use.
        if (stored.accessToken) setFallbackTokens(data);
        return data;
      })
      .catch(() => {
        clearStoredTokens();
        clearFallbackTokens();
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
  // Which side gave up matters: our own deadline is worth explaining, a caller
  // cancelling (a page closed, a newer search typed) is not worth a word.
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
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
  } catch (error) {
    if (timedOut) throw new ApiError(TIMED_OUT_MESSAGE, { status: 0, code: REQUEST_TIMED_OUT });
    // The caller cancelled on purpose; let that through untouched and unreported.
    if (signal?.aborted) throw error;
    // fetch rejects with a TypeError when the host cannot be reached at all.
    if (error instanceof TypeError) throw new ApiError(UNREACHABLE_MESSAGE, { status: 0, code: SERVER_UNREACHABLE });
    throw error;
  } finally {
    window.clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}

/*
  Repeating a request after a timeout is only safe when doing it twice is the
  same as doing it once. A GET is; so is signing in. A POST that creates an
  order might have reached the server and succeeded before we gave up waiting,
  and sending it again would make a second order - so those are never repeated,
  and the person is told to try again themselves.
*/
function safeToRepeat(path, options) {
  const method = (options.method || 'GET').toUpperCase();
  return method === 'GET' || path === '/auth/login';
}

export async function request(path, options = {}) {
  const { skipAuth = false, token, _retried = false, _wokeUp = false } = options;
  const cacheable = isCacheableGet(path, options) && !_retried && !_wokeUp;
  const cacheKey = cacheable ? getCacheKey(path) : null;
  if (cacheKey) {
    const cached = readCachedResponse(cacheKey);
    if (cached !== undefined) return cached;
    if (inFlightGets.has(cacheKey)) return inFlightGets.get(cacheKey);
  }
  const operation = executeRequest(path, options)
    .then((result) => {
      if (cacheKey) writeCachedResponse(cacheKey, result);
      return result;
    })
    .finally(() => {
      if (cacheKey) inFlightGets.delete(cacheKey);
    });
  if (cacheKey) inFlightGets.set(cacheKey, operation);
  try {
    return await operation;
  } catch (error) {
    /*
      A host that sleeps when idle wakes on the request that times out, so the
      next one usually succeeds. Repeating it once turns a visible failure into
      a slow page - which is the honest description of what happened.
    */
    if (error instanceof ApiError && error.code === REQUEST_TIMED_OUT && !_wokeUp && safeToRepeat(path, options)) {
      return request(path, { ...options, _wokeUp: true, cache: false });
    }
    // On an expired access token, attempt a one-time silent refresh and retry.
    // Skipped for unauthenticated calls and calls with an explicit token.
    if (error instanceof ApiError && error.status === 401 && !skipAuth && !token && !_retried) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return request(path, { ...options, _retried: true, cache: false });
      clearStoredTokens();
    }
    throw error;
  } finally {
    if ((options.method || 'GET').toUpperCase() !== 'GET' && !options.skipCacheInvalidation) clearResponseCache();
  }
}

export async function loginRequest(credentials) {
  const data = await request('/auth/login', { method: 'POST', body: credentials, skipAuth: true });
  setStoredTokens(data);

  /*
    Find out, once, whether the session cookie actually arrived. Asking the
    server is the only honest test: a browser gives no way to inspect a cookie
    it silently refused, and there is no reliable list of which ones do.

    If this answers, the cookie works and nothing is kept in storage. If it does
    not, the tokens the login already returned are kept for this tab and sent as
    a bearer header from here on.
  */
  clearFallbackTokens();
  try {
    await executeRequest('/auth/me', { skipAuth: true });
  } catch {
    setFallbackTokens(data);
  }
  return data;
}

export async function logoutRequest() {
  // Normally the refresh cookie identifies the session server-side. Without it,
  // the stored token has to say which session is ending, or it would stay open.
  const { refreshToken } = getFallbackTokens();
  try {
    return await request('/auth/logout', { method: 'POST', ...(refreshToken ? { body: { refreshToken } } : {}) });
  } finally {
    clearResponseCache();
    clearStoredTokens();
    clearFallbackTokens();
  }
}

/*
  Fetching bytes rather than JSON.

  A DICOM study is pixels, not a payload, and the viewer needs the file exactly
  as it was stored. This takes the same route as every other call - the same base
  address, the same cookie or bearer token, the same deadline - and hands back an
  ArrayBuffer instead of a parsed envelope.

  A failure here still arrives as a readable sentence: the body of an error
  response is JSON even when the body of a success is not, so it is read for the
  message the server sent.
*/
export async function requestArrayBuffer(path, { token, signal } = {}) {
  const config = getApiConfig();
  const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  let timedOut = false;
  // Studies are large and the host may be waking, so this is given longer than
  // an ordinary call rather than the shared deadline.
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(config.timeoutMs, 60_000));
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: normalizeHeaders({ headers: { Accept: 'application/octet-stream' }, token }),
      credentials: 'include',
      signal: controller.signal
    });
    if (!response.ok) {
      let message = `Request failed: ${response.status}`;
      try {
        const payload = await response.json();
        if (payload?.message) message = payload.message;
      } catch {
        // Not JSON; the status is all there is to report.
      }
      throw new ApiError(message, { status: response.status });
    }
    return await response.arrayBuffer();
  } catch (error) {
    if (timedOut) throw new ApiError(TIMED_OUT_MESSAGE, { status: 0, code: REQUEST_TIMED_OUT });
    if (signal?.aborted) throw error;
    if (error instanceof TypeError) throw new ApiError(UNREACHABLE_MESSAGE, { status: 0, code: SERVER_UNREACHABLE });
    throw error;
  } finally {
    window.clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}

export function createApiClient({ auth } = {}) {
  const config = getApiConfig();
  return {
    mode: API_MODES.LIVE,
    config,
    auth,
    request,
    requestArrayBuffer,
    login: loginRequest,
    logout: logoutRequest,
    tokens: getStoredTokens()
  };
}
