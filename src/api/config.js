export const API_MODE_STORAGE_KEY = 'diagnosis-center-api-mode';
export const API_TOKEN_STORAGE_KEY = import.meta.env.VITE_API_TOKEN_STORAGE_KEY || 'diagnosis-center-live-api-tokens';

export const API_MODES = {
  MOCK: 'mock',
  LIVE: 'live'
};

function normalizeApiMode(mode) {
  return Object.values(API_MODES).includes(mode) ? mode : API_MODES.MOCK;
}

export const DEFAULT_API_CONFIG = {
  mode: normalizeApiMode(import.meta.env.VITE_API_MODE || API_MODES.MOCK),
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000),
  demoDelayMs: Number(import.meta.env.VITE_MOCK_API_DELAY_MS || 120)
};

export function getApiMode() {
  if (typeof window === 'undefined') return DEFAULT_API_CONFIG.mode;
  return normalizeApiMode(window.localStorage.getItem(API_MODE_STORAGE_KEY) || DEFAULT_API_CONFIG.mode);
}

export function setApiMode(mode) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeApiMode(mode);
  window.localStorage.setItem(API_MODE_STORAGE_KEY, normalized);
}

export function getApiConfig() {
  return {
    ...DEFAULT_API_CONFIG,
    mode: getApiMode()
  };
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
