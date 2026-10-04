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

/*
  The cookie-less fallback.

  Tokens in httpOnly cookies cannot be read by JavaScript, which is why this app
  prefers them. But the site and the API are on different registrable domains
  (github.io and onrender.com), so that cookie is a third-party cookie - and iOS
  Safari, and the in-app browsers inside WhatsApp and the like, refuse those by
  default. Nothing arrives, every request is unauthenticated, and a reload looks
  like being signed out.

  So when, and only when, the cookie is shown not to work, the tokens the server
  already returned are kept here and sent as a bearer header instead. Where the
  cookie does work nothing is stored and the XSS protection is untouched.

  sessionStorage, not localStorage: it survives a reload, which is the thing that
  was broken, but dies with the tab rather than persisting on a shared phone.
*/
const FALLBACK_TOKEN_KEY = `${API_TOKEN_STORAGE_KEY}.fallback`;

export function getFallbackTokens() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(FALLBACK_TOKEN_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setFallbackTokens({ accessToken, refreshToken } = {}) {
  if (typeof window === 'undefined' || !accessToken) return;
  try {
    window.sessionStorage.setItem(FALLBACK_TOKEN_KEY, JSON.stringify({ accessToken, refreshToken: refreshToken || null }));
  } catch {
    // Private mode can refuse storage; the session then lasts this page only.
  }
}

export function clearFallbackTokens() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(FALLBACK_TOKEN_KEY);
  } catch {
    // Nothing to clear if storage was never available.
  }
}

/** True once the cookie has been shown not to reach the server. */
export function usingFallbackTokens() {
  return Boolean(getFallbackTokens().accessToken);
}

// Backwards-compatible aliases for existing call sites.
export const getStoredTokens = getStoredSession;
export const setStoredTokens = setStoredSession;
export const clearStoredTokens = clearStoredSession;
