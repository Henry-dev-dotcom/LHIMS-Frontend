import { ROLES } from '../data/roles';

/*
  Backend <-> frontend translation layer.
  The backend speaks Prisma enums (ADMIN, LAB_STAFF, SUBMITTED, ROUTINE, LAB...).
  Pages compare against display strings ('admin', 'lab', 'Submitted', 'Routine',
  'Lab'...) defined in src/workflow/statuses.js and src/data/roles.js. Every
  translation lives here so the mapping exists in exactly one place.
*/

export const ROLE_FROM_API = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist',
  LAB_STAFF: 'lab',
  SCAN_STAFF: 'scan',
  BILLING_STAFF: 'billing'
};

export const ROLE_TO_API = Object.fromEntries(Object.entries(ROLE_FROM_API).map(([api, local]) => [local, api]));

export function normalizeRole(apiRole) {
  return ROLE_FROM_API[apiRole] || String(apiRole || '').toLowerCase();
}

/* Shapes the /auth/login and /auth/me user payload into the auth object the
   whole app reads (state.auth). Landing pages come from the local ROLES map. */
export function normalizeAuthUser(apiUser) {
  if (!apiUser) return null;
  const role = normalizeRole(apiUser.role);
  const roleInfo = ROLES.find((item) => item.id === role);
  return {
    role,
    userName: apiUser.name || apiUser.username || 'User',
    userId: apiUser.id,
    username: apiUser.username || '',
    email: apiUser.email || '',
    landing: roleInfo?.landing || 'overview',
    linkedDoctorId: apiUser.doctorProfileId || apiUser.doctorProfile?.id || '',
    hospitalId: apiUser.hospitalId || apiUser.doctorProfile?.hospitalId || '',
    permissions: apiUser.permissions || [],
    loginAt: apiUser.lastLoginAt || new Date().toISOString()
  };
}
