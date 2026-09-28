// Shared labels and helpers for the Outpatient (OPD) pages.

// South African Triage Scale colours, used in Ghanaian emergency care.
export const TRIAGE = {
  RED: { label: 'Red · Emergency', short: 'Red', className: 'bg-red-600 text-white' },
  ORANGE: { label: 'Orange · Very urgent', short: 'Orange', className: 'bg-orange-500 text-white' },
  YELLOW: { label: 'Yellow · Urgent', short: 'Yellow', className: 'bg-yellow-300 text-slate-900' },
  GREEN: { label: 'Green · Routine', short: 'Green', className: 'bg-emerald-600 text-white' }
};

export const STATUS = {
  WAITING_TRIAGE: 'Waiting for triage',
  WAITING_DOCTOR: 'Waiting for doctor',
  IN_CONSULTATION: 'In consultation',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export const QUEUE_TABS = [
  { id: 'WAITING_TRIAGE', label: 'Triage' },
  { id: 'WAITING_DOCTOR', label: 'Doctor' },
  { id: 'IN_CONSULTATION', label: 'In consultation' },
  { id: 'COMPLETED', label: 'Completed today' }
];

export const P = {
  READ: 'encounters:read',
  CREATE: 'encounters:create',
  TRIAGE: 'encounters:triage',
  CONSULT: 'encounters:consult',
  ORDER: 'encounters:order',
  PRESCRIBE: 'encounters:prescribe',
  COMPLETE: 'encounters:complete',
  CANCEL: 'encounters:cancel',
  ALLERGIES: 'patients:allergies:manage'
};

export function can(auth, permission) {
  const permissions = auth?.permissions || [];
  return permissions.includes('*') || permissions.includes(permission);
}

export function patientName(patient) {
  return [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'Unknown patient';
}

export function ageLabel(dateOfBirth) {
  if (!dateOfBirth) return '';
  const born = new Date(dateOfBirth);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) years -= 1;
  if (years >= 2) return `${years} y`;
  const months = Math.max(0, (now.getFullYear() - born.getFullYear()) * 12 + now.getMonth() - born.getMonth());
  return `${months} mo`;
}

export function waitingSince(dateValue) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(dateValue).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
