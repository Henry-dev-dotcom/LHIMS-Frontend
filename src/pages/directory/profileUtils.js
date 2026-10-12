/*
  Small helpers for the patient profile.
*/

export const PURPOSES = {
  TREATMENT: 'Treatment',
  CLINICAL_AUDIT: 'Clinical audit',
  OTHER: 'Something else'
};

export const COHORTS = [
  { id: '', label: 'All patients' },
  { id: 'chronic', label: 'Long-term conditions' },
  { id: 'paediatric', label: 'Children (under 18)' },
  { id: 'older', label: 'Older adults (65+)' },
  { id: 'admitted', label: 'In a ward now' },
  { id: 'recent', label: 'Seen in the last 30 days' }
];

export const DOCUMENT_CATEGORIES = {
  REFERRAL_LETTER: 'Referral letter',
  IMAGING_REPORT: 'Imaging report',
  LAB_REPORT: 'Lab report',
  DISCHARGE_SUMMARY: 'Discharge summary',
  CONSENT: 'Consent form',
  INSURANCE: 'Insurance',
  OTHER: 'Other'
};

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const day = (value) => (value ? new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const VISIT_TYPE = { OPD: 'Outpatient', EMERGENCY: 'Emergency', INPATIENT: 'Ward stay' };

const SIX_MONTHS = 183 * 86_400_000;

/*
  Medicines a patient is probably still taking.

  The record does not mark a prescription as "repeat", so this works it out, and the
  screen says how: a medicine counts when it was prescribed on more than one occasion in
  the last six months, or when its last prescription has no end date (or one of a month
  or more) and has not run out. It is a prompt to ask the patient, not a medication list.
*/
export function ongoingMedicines(prescriptions, now = Date.now()) {
  const byDrug = new Map();
  for (const rx of prescriptions || []) {
    if (rx.status === 'CANCELLED') continue;
    const at = new Date(rx.createdAt).getTime();
    if (now - at > SIX_MONTHS) continue;
    for (const item of rx.items || []) {
      const key = String(item.drugName || '').trim().toLowerCase();
      if (!key) continue;
      const entry = byDrug.get(key) || { name: item.drugName, occasions: new Set(), latest: null };
      entry.occasions.add(rx.id);
      if (!entry.latest || at > entry.latest.at) entry.latest = { at, item };
      byDrug.set(key, entry);
    }
  }
  const out = [];
  for (const entry of byDrug.values()) {
    const { at, item } = entry.latest;
    const days = item.durationDays;
    const longTerm = days == null || days >= 30;
    const runsOutAt = at + (days ?? 0) * 86_400_000;
    const stillRunning = days == null || runsOutAt >= now;
    if (entry.occasions.size >= 2 || (longTerm && stillRunning)) {
      out.push({
        name: [item.drugName, item.strength].filter(Boolean).join(' '),
        how: [item.dose, item.frequency].filter(Boolean).join(', '),
        lastPrescribed: at
      });
    }
  }
  return out.sort((a, b) => b.lastPrescribed - a.lastPrescribed);
}

/** A file read as base64 text (without the "data:" prefix), for sending in a JSON request. */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ''));
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/** Saves downloaded bytes as a file, the way a link with a download name would. */
export function saveBytes(bytes, fileName, mimeType) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
