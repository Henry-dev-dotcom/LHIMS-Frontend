// Facility setup checklist (Phase 6) and the platform console's metrics,
// demo requests and support sessions.
export const onboardingService = {
  status: async (client) => client.request('/onboarding'),
  saveProfile: async (client, payload) => client.request('/onboarding/profile', { method: 'PATCH', body: payload }),
  importPriceList: async (client, rows) => client.request('/onboarding/price-list', { method: 'POST', body: { rows } }),
  complete: async (client) => client.request('/onboarding/complete', { method: 'POST', body: {} }),

  metrics: async (client) => client.request('/platform/metrics'),
  demoRequests: async (client) => client.request('/platform/demo-requests'),
  updateDemoRequest: async (client, id, payload) => client.request(`/platform/demo-requests/${id}`, { method: 'PATCH', body: payload }),
  startSupportSession: async (client, facilityId, reason) => client.request(`/platform/facilities/${facilityId}/support-session`, { method: 'POST', body: { reason } })
};

export const PRICE_LIST_COLUMNS = ['code', 'name', 'type', 'price', 'sampleType', 'modality', 'tariffCode'];

/** A starting price list with placeholder prices, to be edited after import. */
export const STARTER_PRICE_LIST = [
  { code: 'CONS-GEN', name: 'General consultation', type: 'SERVICE', price: 50 },
  { code: 'CONS-SPEC', name: 'Specialist consultation', type: 'SERVICE', price: 100 },
  { code: 'CONS-REVIEW', name: 'Review visit', type: 'SERVICE', price: 30 },
  { code: 'FBC', name: 'Full blood count', type: 'LAB', price: 60, sampleType: 'Blood', module: 'laboratory' },
  { code: 'MAL-RDT', name: 'Malaria rapid test', type: 'LAB', price: 25, sampleType: 'Blood', module: 'laboratory' },
  { code: 'FBS', name: 'Fasting blood sugar', type: 'LAB', price: 25, sampleType: 'Blood', module: 'laboratory' },
  { code: 'URINE-RE', name: 'Urine routine examination', type: 'LAB', price: 30, sampleType: 'Urine', module: 'laboratory' },
  { code: 'XR-CHEST', name: 'Chest X-ray', type: 'SCAN', price: 150, modality: 'X-ray', module: 'imaging' },
  { code: 'US-ABD', name: 'Abdominal ultrasound', type: 'SCAN', price: 200, modality: 'Ultrasound', module: 'imaging' },
  { code: 'US-OBS', name: 'Obstetric ultrasound', type: 'SCAN', price: 180, modality: 'Ultrasound', module: 'imaging' }
];

/** Parses CSV text (quoted fields allowed) into row objects keyed by the header row. */
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  const src = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  if (rows.length < 2) return { rows: [], error: 'The file needs a header row and at least one item.' };
  const header = rows[0].map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());
  const missing = ['code', 'name', 'type', 'price'].filter((c) => !lower.includes(c.toLowerCase()));
  if (missing.length) return { rows: [], error: `The header row is missing: ${missing.join(', ')}.` };
  return {
    rows: rows.slice(1).map((cells) => Object.fromEntries(PRICE_LIST_COLUMNS
      .map((col) => [col, (cells[lower.indexOf(col.toLowerCase())] ?? '').trim()])
      .filter(([, v]) => v !== ''))),
    error: ''
  };
}

export function priceListTemplateCsv() {
  const lines = [PRICE_LIST_COLUMNS.join(',')];
  STARTER_PRICE_LIST.slice(0, 3).concat(STARTER_PRICE_LIST.filter((r) => r.type !== 'SERVICE').slice(0, 2)).forEach((r) => {
    lines.push(PRICE_LIST_COLUMNS.map((c) => (r[c] === undefined ? '' : String(r[c]).includes(',') ? `"${r[c]}"` : r[c])).join(','));
  });
  return `${lines.join('\n')}\n`;
}
