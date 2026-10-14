import { canAccessPage } from '../../utils/permissions';

/** The clinics the Clinics page offers, by group. Each id is the clinic's own page. */
export const CLINIC_GROUPS = [
  { label: 'Maternity', items: [{ id: 'clinic-antenatal', label: 'Antenatal' }, { id: 'clinic-postnatal', label: 'Postnatal' }, { id: 'maternity-register', label: 'Maternity register' }] },
  { label: 'Child health', items: [{ id: 'clinic-child-welfare', label: 'Child welfare' }, { id: 'immunisation-due', label: 'Immunisation due list' }] },
  { label: 'Specialist', items: [{ id: 'clinic-dental', label: 'Dental' }, { id: 'clinic-eye', label: 'Eye' }, { id: 'clinic-physiotherapy', label: 'Physiotherapy' }, { id: 'clinic-dietetics', label: 'Dietetics' }] }
];

/** The clinics this person may open in this facility, by group; empty groups are dropped. */
export function availableClinics(auth) {
  return CLINIC_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccessPage(auth?.role, item.id, auth?.modules, auth)) }))
    .filter((group) => group.items.length > 0);
}
