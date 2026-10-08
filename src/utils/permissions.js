import { ALL_ROLES, NAV_ITEMS, ROLES } from '../data/roles';

/*
  Department modules (backend src/config/modules.ts). A page belongs to the
  module of its nav section, with a few exceptions; pages with no module are
  core and always available. `modules` is the signed-in facility's switched-on
  list (auth.modules); when it is not provided, no module filtering applies.
*/
const SECTION_MODULES = {
  Outpatient: 'opd',
  Emergency: 'emergency',
  Wards: 'inpatient',
  Theatre: 'theatre',
  Maternity: 'maternity',
  'Child Health': 'child_health',
  Claims: 'claims',
  Stores: 'stores',
  'Blood Bank': 'blood_bank',
  Mortuary: 'mortuary',
  HR: 'hr',
  'Medical Records': 'medical_records',
  Pharmacy: 'pharmacy',
  Clinician: 'clinician_portal',
  Reception: 'reception',
  Laboratory: 'laboratory',
  Imaging: 'imaging',
  Finance: 'billing',
  Results: 'results_delivery',
  Reporting: 'reports'
};

const PAGE_MODULE_OVERRIDES = {
  'doctor-prescriptions': 'opd',
  'finance-shift': 'finance',
  'float-tracker': 'finance',
  expenses: 'finance',
  'account-ledger': 'finance',
  'price-catalog': null,
  // Specialty clinics: one module each.
  'clinic-dental': 'dental',
  'clinic-eye': 'eye',
  'clinic-physiotherapy': 'physiotherapy',
  'clinic-dietetics': 'dietetics'
};

export function moduleForPage(pageId) {
  if (pageId in PAGE_MODULE_OVERRIDES) return PAGE_MODULE_OVERRIDES[pageId];
  const page = NAV_ITEMS.find((item) => item.id === pageId);
  return (page && SECTION_MODULES[page.section]) || null;
}

function moduleAllows(pageId, modules) {
  if (!Array.isArray(modules)) return true;
  const module = moduleForPage(pageId);
  return !module || modules.includes(module);
}

export function canAccessPage(role, pageId, modules) {
  // Overview is a facility workspace page; the platform operator has none.
  if (pageId === 'overview') return role !== 'platform';
  const page = NAV_ITEMS.find((item) => item.id === pageId);
  if (!page) return false;
  return page.roles.includes(role) && moduleAllows(pageId, modules);
}

export function getAllowedRolesForPage(pageId) {
  if (pageId === 'overview') return ROLES.map((role) => role.id);
  return NAV_ITEMS.find((item) => item.id === pageId)?.roles || [];
}

/*
  Some pages are reachable without being listed.

  Accepting samples is the second half of the Incoming tab, not a destination of
  its own: you get there by opening a request. Listing it would put the same work
  in the menu twice. The retired laboratory pages are the same - an
  administrator can still open the rejection and sign-off history, but they are
  no longer part of the bench's day.

  So `hidden` keeps a page out of the menu while canAccessPage still allows it,
  which is what lets an address or an in-page button open it.
*/
export function getNavForRole(role, modules) {
  return NAV_ITEMS.filter((item) => !item.hidden && item.roles.includes(role) && moduleAllows(item.id, modules));
}

export function groupNavItems(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});
}

export function getRole(roleId) {
  return ALL_ROLES.find((role) => role.id === roleId) || ROLES[0];
}

export function getRoleLabel(roleId) {
  return getRole(roleId)?.label || roleId;
}

export function getDefaultPageForRole(roleId) {
  return getRole(roleId)?.landing || 'overview';
}

export function buildPermissionMatrix() {
  return ROLES.map((role) => ({
    role: role.id,
    label: role.label,
    landing: role.landing,
    pages: getNavForRole(role.id).map((item) => item.id)
  }));
}
