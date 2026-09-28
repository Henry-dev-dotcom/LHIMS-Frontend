import { ALL_ROLES, NAV_ITEMS, ROLES } from '../data/roles';

export function canAccessPage(role, pageId) {
  // Overview is a facility workspace page; the platform operator has none.
  if (pageId === 'overview') return role !== 'platform';
  const page = NAV_ITEMS.find((item) => item.id === pageId);
  if (!page) return false;
  return page.roles.includes(role);
}

export function getAllowedRolesForPage(pageId) {
  if (pageId === 'overview') return ROLES.map((role) => role.id);
  return NAV_ITEMS.find((item) => item.id === pageId)?.roles || [];
}

export function getNavForRole(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
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
