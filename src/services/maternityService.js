import { buildQuery } from '../api/apiClient';

// Maternity module (backend /maternity).
export const maternityService = {
  pregnancies: async (client, params = {}) => client.request(`/maternity/pregnancies${buildQuery(params)}`),
  pregnancy: async (client, id) => client.request(`/maternity/pregnancies/${id}`),
  register: async (client, payload) => client.request('/maternity/pregnancies', { method: 'POST', body: payload }),
  update: async (client, id, payload) => client.request(`/maternity/pregnancies/${id}`, { method: 'PATCH', body: payload }),
  end: async (client, id, payload) => client.request(`/maternity/pregnancies/${id}/end`, { method: 'POST', body: payload }),
  deliver: async (client, id, payload) => client.request(`/maternity/pregnancies/${id}/delivery`, { method: 'POST', body: payload })
};

export const RISK_FACTORS = {
  PREVIOUS_CAESAREAN: 'Previous caesarean',
  PREVIOUS_STILLBIRTH: 'Previous stillbirth',
  PREVIOUS_PPH: 'Previous PPH',
  PREVIOUS_PRETERM: 'Previous preterm birth',
  GRAND_MULTIPARA: 'Grand multipara (5+)',
  TEENAGE: 'Teenage pregnancy',
  ADVANCED_AGE: 'Age 35 or over',
  SHORT_STATURE: 'Short stature',
  HYPERTENSION: 'Hypertension',
  DIABETES: 'Diabetes',
  SICKLE_CELL: 'Sickle cell disease',
  HIV: 'HIV',
  MULTIPLE_PREGNANCY: 'Multiple pregnancy',
  RHESUS_NEGATIVE: 'Rhesus negative',
  OTHER: 'Other'
};

export const SCREENING = { hiv: 'HIV', syphilis: 'Syphilis', hepatitisB: 'Hepatitis B', sickling: 'Sickling', malariaRdt: 'Malaria RDT' };

export const DELIVERY_MODES = { SVD: 'Spontaneous vaginal', VACUUM: 'Vacuum', FORCEPS: 'Forceps', ASSISTED_BREECH: 'Assisted breech', CAESAREAN: 'Caesarean section' };
export const BIRTH_OUTCOMES = { LIVE_BIRTH: 'Live birth', FRESH_STILLBIRTH: 'Fresh stillbirth', MACERATED_STILLBIRTH: 'Macerated stillbirth' };
export const PERINEUM = { INTACT: 'Intact', FIRST_DEGREE: '1st degree tear', SECOND_DEGREE: '2nd degree tear', THIRD_DEGREE: '3rd degree tear', FOURTH_DEGREE: '4th degree tear', EPISIOTOMY: 'Episiotomy' };
export const END_REASONS = { MISCARRIAGE: 'Miscarriage', ECTOPIC: 'Ectopic pregnancy', MOLAR: 'Molar pregnancy', TERMINATION: 'Termination', TRANSFERRED_OUT: 'Transferred out', LOST_TO_FOLLOW_UP: 'Lost to follow-up' };

export const gestationLabel = (g) => (g ? `${g.weeks}+${g.days} weeks` : '—');
export const isFemale = (patient) => String(patient?.gender || '').toUpperCase() === 'FEMALE';
