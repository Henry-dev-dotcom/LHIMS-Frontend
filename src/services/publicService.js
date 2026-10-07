import { request } from '../api/apiClient';
import { setStoredTokens } from '../api/config';

// Public website endpoints (no sign-in): pricing, sign-up, demo requests.
export const publicService = {
  catalogue: () => request('/public/plans', { skipAuth: true }),
  quote: (payload) => request('/public/quote', { method: 'POST', body: payload, skipAuth: true }),
  signup: async (payload) => {
    const data = await request('/public/signup', { method: 'POST', body: payload, skipAuth: true });
    setStoredTokens(data);
    return data;
  },
  demoRequest: (payload) => request('/public/demo-requests', { method: 'POST', body: payload, skipAuth: true })
};

/** Field messages from a validation error, as { 'facility.name': 'Enter …' }. */
export function fieldErrors(error) {
  const list = error?.details?.errors || error?.details?.details?.errors || [];
  return Object.fromEntries(list.filter((e) => e.field || e.path).map((e) => [String(e.field || e.path), e.message]));
}

/* ------------------------------------------------------------ hash routes */

export function readSiteRoute() {
  if (typeof window === 'undefined') return { path: '', parts: [], params: new URLSearchParams() };
  const raw = (window.location.hash || '').replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path: parts[0] || '', parts, params: new URLSearchParams(query) };
}

export function goTo(path) {
  window.location.hash = path ? `#/${path}` : '#/';
  window.scrollTo?.(0, 0);
}

export const FACILITY_CODE_KEY = 'curatamed.lastFacilityCode';


export function rememberFacilityCode(code) {
  try {
    if (code) window.localStorage.setItem(FACILITY_CODE_KEY, code);
  } catch {
    /* storage unavailable: not remembered */
  }
}

export const CATEGORY_LABEL = {
  clinical: 'Clinical care',
  front_office: 'Front office',
  diagnostics: 'Diagnostics',
  finance: 'Finance & insurance',
  insights: 'Management & staff'
};
