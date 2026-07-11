export const API_TOKEN_STORAGE_KEY = import.meta.env.VITE_API_TOKEN_STORAGE_KEY || 'diagnosis-center-live-api-tokens';

/* The demo/mock mode was removed with the demo store; every environment now
   talks to a real backend at VITE_API_BASE_URL. */
export const API_MODES = {
  LIVE: 'live'
};

export const DEFAULT_API_CONFIG = {
  mode: API_MODES.LIVE,
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000)
};

export function getApiMode() {
  return API_MODES.LIVE;
}

export function getApiConfig() {
  return { ...DEFAULT_API_CONFIG };
}

// Access/refresh tokens are held by the backend in httpOnly cookies and are
// never readable by JavaScript, so they cannot be exfiltrated via XSS. Only the
// non-sensitive user profile is cached here to render the shell on reload; the
// session itself is always re-validated against the server (which trusts the
// cookie, not this cache).
export function getStoredSession() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(API_TOKEN_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setStoredSession(payload = {}) {
  if (typeof window === 'undefined') return;
  const session = {
    user: payload.user || null,
    savedAt: new Date().toISOString()
  };
  window.localStorage.setItem(API_TOKEN_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(API_TOKEN_STORAGE_KEY);
}

// Backwards-compatible aliases for existing call sites.
export const getStoredTokens = getStoredSession;
export const setStoredTokens = setStoredSession;
export const clearStoredTokens = clearStoredSession;
