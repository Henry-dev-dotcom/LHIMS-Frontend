/*
  Prescribing suggestions: common first-line medicines for a few common diagnoses.

  READ THIS BEFORE CHANGING OR TRUSTING IT.
  This is a short starter list, not a treatment protocol, and it has not been reviewed by
  a clinician at any facility using this software. It exists to save typing, never to make
  a decision. So:
    - a suggestion only appears for a diagnosis the clinician has recorded, and only when
      the medicine is in the facility's own pharmacy list (where the facility has one);
    - nothing is added until the clinician approves it, and every line stays editable;
    - doses are filled in for adults only. For a child, or when age is unknown, the dose
      is left blank on purpose, because the right dose depends on weight;
    - a suggestion that conflicts with a recorded allergy cannot be approved in one click;
    - the server checks allergies again when the prescription is issued.
  A facility's clinical lead should review and edit this list to match local guidelines.
*/

const ADULT_FROM_YEARS = 12;
const DOSE_CAUTION_CHILD = 'The dose depends on weight for children, so it is left for you to fill in.';

export const SUGGESTIONS = [
  {
    id: 'artemether-lumefantrine',
    codes: ['B50', 'B51', 'B52', 'B53', 'B54'],
    reason: 'Malaria',
    name: 'Artemether-lumefantrine',
    search: 'artemether',
    strength: '20/120 mg',
    dosageForm: 'Tablet',
    adultDose: '4 tablets',
    route: 'Oral',
    frequency: 'Twice daily',
    durationDays: 3,
    instructions: 'Take with food or a milky drink. Complete all six doses.',
    caution: 'Do not use in the first trimester of pregnancy without senior advice.'
  },
  {
    id: 'paracetamol',
    codes: ['B50', 'B51', 'B52', 'B53', 'B54', 'R50', 'R51', 'J00', 'J02', 'J06', 'J18', 'A09'],
    reason: 'Fever or pain',
    name: 'Paracetamol',
    search: 'paracetamol',
    strength: '500 mg',
    dosageForm: 'Tablet',
    adultDose: '1 g (2 tablets)',
    route: 'Oral',
    frequency: 'Three times daily if needed',
    durationDays: 3,
    instructions: 'Do not take more than 4 g in 24 hours.',
    caution: ''
  },
  {
    id: 'amoxicillin',
    codes: ['J13', 'J15', 'J18'],
    reason: 'Pneumonia',
    name: 'Amoxicillin',
    search: 'amoxicillin',
    strength: '500 mg',
    dosageForm: 'Capsule',
    adultDose: '500 mg',
    route: 'Oral',
    frequency: 'Three times daily',
    durationDays: 5,
    instructions: 'Complete the course.',
    caution: 'Penicillin allergy is checked against the patient record.'
  },
  {
    id: 'amlodipine',
    codes: ['I10', 'I11', 'I12', 'I13', 'I15'],
    reason: 'Hypertension',
    name: 'Amlodipine',
    search: 'amlodipine',
    strength: '5 mg',
    dosageForm: 'Tablet',
    adultDose: '5 mg',
    route: 'Oral',
    frequency: 'Once daily',
    durationDays: null,
    instructions: 'Long-term treatment. Review blood pressure at the next visit.',
    minAge: 18,
    caution: 'Starting dose shown.'
  },
  {
    id: 'metformin',
    codes: ['E11'],
    reason: 'Type 2 diabetes',
    name: 'Metformin',
    search: 'metformin',
    strength: '500 mg',
    dosageForm: 'Tablet',
    adultDose: '500 mg',
    route: 'Oral',
    frequency: 'Twice daily with meals',
    durationDays: null,
    instructions: 'Take with or just after food.',
    minAge: 18,
    caution: 'Check kidney function before starting. Starting dose shown.'
  },
  {
    id: 'ors',
    codes: ['A00', 'A01', 'A02', 'A03', 'A04', 'A06', 'A08', 'A09'],
    reason: 'Diarrhoea',
    name: 'Oral rehydration salts',
    search: 'rehydration',
    strength: '',
    dosageForm: 'Sachet',
    adultDose: '1 sachet in 1 litre of clean water',
    route: 'Oral',
    frequency: 'Sip often, and after every loose stool',
    durationDays: 3,
    instructions: 'Keep drinking even if vomiting; small sips.',
    caution: 'The same sachet and water suits children; it is sipped as tolerated.',
    sameForChildren: true
  }
];

/** Whole years old, or null when the date of birth is not known. */
export function ageInYears(dateOfBirth) {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) years -= 1;
  return years;
}

/** Penicillins are a class: an allergy to one rules out the others a clinician might suggest here. */
const CLASS_MEMBERS = { penicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'flucloxacillin', 'co-amoxiclav', 'augmentin'] };

/** Whether a recorded allergy rules out a medicine; the server checks again when the prescription is issued. */
export function allergyHit(allergies, drugName) {
  const drug = String(drugName || '').toLowerCase();
  return (allergies || []).find((allergy) => {
    const substance = String(allergy.substance || '').toLowerCase().trim();
    if (!substance) return false;
    if (drug.includes(substance) || substance.includes(drug)) return true;
    const family = Object.entries(CLASS_MEMBERS).find(([name]) => substance.includes(name));
    return Boolean(family && family[1].some((member) => drug.includes(member)));
  });
}

/** The suggestions that fit this visit's diagnoses, each with the dose that is safe to fill in for this patient. */
export function suggestionsFor({ diagnoses, patient, alreadyHave }) {
  const codes = (diagnoses || []).map((d) => String(d.code || '').toUpperCase()).filter(Boolean);
  const years = ageInYears(patient?.dateOfBirth);
  const adult = years !== null && years >= ADULT_FROM_YEARS;
  const have = (alreadyHave || []).map((name) => String(name).toLowerCase());
  return SUGGESTIONS
    .filter((s) => s.codes.some((prefix) => codes.some((code) => code.startsWith(prefix))))
    .filter((s) => !have.some((name) => name.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(name)))
    // Adult-only medicines are not suggested for a child; when age is unknown the clinician decides.
    .filter((s) => !(s.minAge && years !== null && years < s.minAge))
    .map((s) => {
      const fixedDose = adult || s.sameForChildren;
      const unknownAge = years === null;
      const parts = [];
      if (!fixedDose) parts.push(unknownAge ? 'Age is not recorded.' : 'This patient is under 12.', DOSE_CAUTION_CHILD);
      if (s.caution) parts.push(s.caution);
      return { ...s, dose: fixedDose ? s.adultDose : '', note: parts.join(' '), allergy: allergyHit(patient?.allergies, s.name) || null };
    });
}
