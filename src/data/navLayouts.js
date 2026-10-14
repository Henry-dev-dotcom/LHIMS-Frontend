import { canAccessPage, getNavForRole, groupNavItems, isHospitalSubscription } from '../utils/permissions';
import { NAV_ITEMS } from './roles';
import { availableClinics } from '../pages/clinics/clinicHub';

/*
  A shorter menu for the people who use one most.

  A hospital doctor's full menu ran to 28 items in 17 sections, with four lists of patients. The
  layout below keeps six things in view and folds the rest into one "More" group. It only arranges:
  which pages a person may open is still decided by roles, modules and permissions, so an item the
  facility has not switched on stays out, and nothing becomes reachable that was not before.

  Pages left out of both lists are still reachable by address and from in-page links.
*/

const HOSPITAL_DOCTOR = {
  primary: [
    { id: 'clinician-queue' },
    { id: 'patients-directory', label: 'Patients' },
    { id: 'ward-board', label: 'Wards' },
    { id: 'emergency-board', label: 'Emergency' },
    { id: 'clinics', label: 'Clinics', when: (auth) => availableClinics(auth).length > 0 },
    { id: 'messages' }
  ],
  // Out of the menu altogether: the queue is the doctor's home, Patient Records lists the same
  // patients as Patients, and every clinic opens from the Clinics page.
  omit: [
    'overview',
    'patients',
    'clinic-antenatal', 'clinic-postnatal', 'maternity-register',
    'clinic-child-welfare', 'immunisation-due',
    'clinic-dental', 'clinic-eye', 'clinic-physiotherapy', 'clinic-dietetics'
  ],
  bottomBar: [
    { id: 'patients-directory', label: 'Patients' },
    { id: 'ward-board', label: 'Wards' },
    { id: 'messages', label: 'Messages' }
  ]
};

/** The arranged layout for this person, or null when they get the ordinary sectioned menu. */
export function navLayoutFor(auth) {
  if (auth?.role === 'doctor' && isHospitalSubscription(auth)) return HOSPITAL_DOCTOR;
  return null;
}

/**
 * The menu as the sidebar draws it: either sections (the ordinary menu) or a short primary list
 * plus a "More" group. Labels in the layout replace the page's own label in the menu only.
 */
export function buildMenu(auth) {
  const role = auth?.role || 'admin';
  const modules = auth?.modules;
  const all = getNavForRole(role, modules, auth);
  const layout = navLayoutFor(auth);
  if (!layout) return { layout: null, groups: groupNavItems(all), primary: [], more: {} };

  // Primary items may be pages kept out of ordinary menus (hidden), so they are looked up directly
  // and checked with the same access rule as everything else.
  const primary = layout.primary
    .map(({ id, label, when }) => {
      const item = NAV_ITEMS.find((entry) => entry.id === id);
      if (!item || !canAccessPage(role, id, modules, auth) || (when && !when(auth))) return null;
      return { ...item, label: label || item.label };
    })
    .filter(Boolean);
  const taken = new Set([...primary.map((item) => item.id), ...layout.omit]);
  const more = groupNavItems(all.filter((item) => !taken.has(item.id)));
  return { layout, groups: {}, primary, more };
}

/** Bottom-bar shortcuts for an arranged layout, or null to keep the role's usual shortcuts. */
export function bottomBarFor(auth) {
  const layout = navLayoutFor(auth);
  if (!layout) return null;
  return layout.bottomBar.filter((item) => canAccessPage(auth.role, item.id, auth.modules, auth));
}
