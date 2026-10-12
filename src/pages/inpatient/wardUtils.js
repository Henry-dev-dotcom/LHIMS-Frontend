// Shared bits of the ward screens.

export const IP = {
  ADMIT: 'inpatient:admit',
  TRANSFER: 'inpatient:transfer',
  DISCHARGE: 'inpatient:discharge',
  ADMINISTER: 'inpatient:administer',
  REVIEW_RESULTS: 'inpatient:results:review',
  BED_STATUS: 'inpatient:beds:status',
  WARDS: 'inpatient:wards:manage'
};

export const BLOCK_LABEL = { MORNING: 'Morning', AFTERNOON: 'Afternoon', NIGHT: 'Night' };

/** What each state of a scheduled dose is called, for people and for screen readers. */
export const SLOT_STATE_LABEL = { GIVEN: 'Given', DUE: 'Due now', OVERDUE: 'Overdue', UPCOMING: 'Not yet due', NOT_APPLICABLE: 'Before it was prescribed' };

export const DOSE_STATUS_LABEL = { GIVEN: 'Given', HELD: 'Held', REFUSED: 'Refused', MISSED: 'Missed' };

/** The two dots on a bed: red when something is due, yellow when results are waiting for a doctor. */
export function bedDots(flags) {
  if (!flags) return { red: false, yellow: false, reasons: [] };
  const waiting = (flags.dosesDue || 0) + (flags.dosesOverdue || 0);
  const reasons = [];
  if (flags.dosesOverdue) reasons.push(`${flags.dosesOverdue} overdue dose${flags.dosesOverdue === 1 ? '' : 's'}`);
  if (flags.dosesDue) reasons.push(`${flags.dosesDue} dose${flags.dosesDue === 1 ? '' : 's'} due`);
  if (flags.vitalsDue) reasons.push('observations overdue');
  const results = flags.newResults ? `${flags.newResults} new result${flags.newResults === 1 ? '' : 's'} to review` : '';
  if (results) reasons.push(results);
  return { red: waiting > 0 || Boolean(flags.vitalsDue), yellow: (flags.newResults || 0) > 0, reasons };
}

export const utcTime = (ms) => new Date(ms).toISOString().slice(11, 16);

/** A day key ("2026-10-12") moved by whole days. */
export function shiftDay(day, delta) {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function dayLabel(day, today) {
  if (day === today) return 'Today';
  if (day === shiftDay(today, -1)) return 'Yesterday';
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
