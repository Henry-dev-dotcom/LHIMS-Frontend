// Specialty clinics and their structured forms (backend src/config/clinics.ts).

export const CLINICS = {
  GENERAL: { label: 'General outpatient', module: 'opd', page: 'opd-queue' },
  DENTAL: { label: 'Dental clinic', module: 'dental', page: 'clinic-dental', feeCode: 'CONSULT-DENTAL', forms: ['DENTAL_CHART'] },
  EYE: { label: 'Eye clinic', module: 'eye', page: 'clinic-eye', feeCode: 'CONSULT-EYE', forms: ['EYE_EXAM'] },
  PHYSIOTHERAPY: { label: 'Physiotherapy', module: 'physiotherapy', page: 'clinic-physiotherapy', feeCode: 'CONSULT-PHYSIOTHERAPY', forms: ['PHYSIO_ASSESSMENT', 'PHYSIO_SESSION'] },
  DIETETICS: { label: 'Dietetics', module: 'dietetics', page: 'clinic-dietetics', feeCode: 'CONSULT-DIETETICS', forms: ['NUTRITION_ASSESSMENT'] },
  // Antenatal and postnatal care is usually free (NHIS); no fee unless the catalog has CONSULT-ANTENATAL / CONSULT-POSTNATAL.
  ANTENATAL: { label: 'Antenatal clinic', module: 'maternity', page: 'clinic-antenatal', feeCode: 'CONSULT-ANTENATAL', feeRequired: true, forms: [] },
  POSTNATAL: { label: 'Postnatal clinic', module: 'maternity', page: 'clinic-postnatal', feeCode: 'CONSULT-POSTNATAL', feeRequired: true, forms: [] }
};

/** `clinicianOnly` forms need the consult permission; the others nurses may record too. */
export const FORMS = {
  DENTAL_CHART: { label: 'Dental chart', module: 'dental', clinicianOnly: true },
  EYE_EXAM: { label: 'Eye examination', module: 'eye', clinicianOnly: true },
  PHYSIO_ASSESSMENT: { label: 'Physiotherapy assessment', module: 'physiotherapy', clinicianOnly: true },
  PHYSIO_SESSION: { label: 'Physiotherapy session', module: 'physiotherapy', clinicianOnly: true },
  NUTRITION_ASSESSMENT: { label: 'Nutrition assessment', module: 'dietetics', clinicianOnly: false },
  // Recorded from the pregnancy card, never offered as a free-standing form.
  ANC_VISIT: { label: 'Antenatal visit', module: 'maternity', clinicianOnly: false, pregnancy: true },
  POSTNATAL_CHECK: { label: 'Postnatal check', module: 'maternity', clinicianOnly: false, pregnancy: true }
};

export const clinicsFor = (modules) => Object.entries(CLINICS).filter(([, c]) => !Array.isArray(modules) || modules.includes(c.module));

/** The forms offered on a visit: its clinic's forms first, then any other enabled form. */
export function formsFor(clinic, modules) {
  const enabled = Object.keys(FORMS).filter((type) => !FORMS[type].pregnancy && (!Array.isArray(modules) || modules.includes(FORMS[type].module)));
  const own = CLINICS[clinic]?.forms || [];
  return [...own.filter((t) => enabled.includes(t)), ...enabled.filter((t) => !own.includes(t))];
}

// FDI numbering, laid out as the dentist faces the patient: upper right, upper left / lower right, lower left.
export const PERMANENT_TEETH = {
  upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
};
export const PRIMARY_TEETH = {
  upper: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  lower: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]
};

export const TOOTH_CONDITIONS = {
  SOUND: { label: 'Sound', className: 'bg-white text-slate-700 border-slate-300' },
  CARIES: { label: 'Caries', className: 'bg-red-100 text-red-800 border-red-300' },
  FILLED: { label: 'Filled', className: 'bg-sky-100 text-sky-800 border-sky-300' },
  MISSING: { label: 'Missing', className: 'bg-slate-200 text-slate-500 border-slate-300 line-through' },
  EXTRACTION_NEEDED: { label: 'Extract', className: 'bg-red-600 text-white border-red-700' },
  ROOT_CANAL_NEEDED: { label: 'RCT needed', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  ROOT_CANAL_TREATED: { label: 'RCT done', className: 'bg-violet-100 text-violet-800 border-violet-300' },
  CROWN: { label: 'Crown', className: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
  FRACTURED: { label: 'Fractured', className: 'bg-orange-100 text-orange-900 border-orange-300' },
  MOBILE: { label: 'Mobile', className: 'bg-pink-100 text-pink-800 border-pink-300' },
  IMPACTED: { label: 'Impacted', className: 'bg-stone-200 text-stone-800 border-stone-300' },
  UNERUPTED: { label: 'Unerupted', className: 'bg-slate-100 text-slate-500 border-dashed border-slate-300' }
};
