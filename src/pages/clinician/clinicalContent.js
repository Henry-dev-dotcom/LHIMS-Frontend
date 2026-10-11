/*
  Clinical starter content for the clinician workspace: note templates and order sets.

  This is data, kept in one place so a facility's clinical lead can review and change it
  without touching any screen code. Nothing here makes a decision for the clinician:
    - a template only fills in prompts to be completed, and never states a finding;
    - an order set only ticks tests in the order builder, which the clinician still reviews
      and sends; a set only offers tests that exist in the facility's own catalogue.

  These are common starting points, not a clinical protocol. Edit them to match local practice.
*/

/*
  Templates are headings with the prompts the clinician answers. A prompt left empty
  (a line that is only "Label:") is dropped when the note is saved, so nothing unanswered
  ends up in the record.
*/
export const NOTE_TEMPLATES = [
  {
    id: 'acute-fever',
    label: 'Acute fever protocol',
    note: {
      subjective: [
        'Fever for (days):',
        'Onset and pattern:',
        'Chills or rigors:',
        'Headache, body or joint pains:',
        'Cough, sore throat, runny nose:',
        'Vomiting or diarrhoea:',
        'Urinary symptoms:',
        'Rash:',
        'Recent travel or sick contacts:',
        'Medicines already taken:',
        'Past history and allergies:'
      ].join('\n'),
      objective: [
        'General (alert, pallor, jaundice, hydration):',
        'ENT:',
        'Chest:',
        'Abdomen (tenderness, liver or spleen enlargement):',
        'Neck stiffness:',
        'Skin and rash:'
      ].join('\n'),
      assessment: 'Febrile illness. Differentials considered:',
      plan: ['Investigations:', 'Treatment:', 'Advice and danger signs explained:', 'Review:'].join('\n')
    }
  },
  {
    id: 'urti',
    label: 'Upper respiratory tract infection',
    note: {
      subjective: [
        'Cough, sore throat or runny nose for (days):',
        'Fever:',
        'Difficulty breathing or wheeze:',
        'Ear pain or discharge:',
        'Eating and drinking:',
        'Sick contacts:',
        'Past history and allergies:'
      ].join('\n'),
      objective: ['General:', 'Throat and tonsils:', 'Ears:', 'Nose:', 'Chest:'].join('\n'),
      assessment: 'Upper respiratory tract infection. Complications considered:',
      plan: ['Treatment:', 'Fluids and rest advice:', 'Danger signs explained:', 'Review:'].join('\n')
    }
  },
  {
    id: 'antenatal',
    label: 'Antenatal check-up',
    note: {
      subjective: [
        'Gestation by dates (weeks):',
        'Expected date of delivery:',
        'Fetal movements:',
        'Complaints (bleeding, leaking fluid, headache, visual disturbance, swelling, abdominal pain):',
        'Previous obstetric history:',
        'Medicines and supplements:',
        'Allergies:'
      ].join('\n'),
      objective: ['Blood pressure:', 'Weight:', 'Pallor:', 'Oedema:', 'Fundal height (cm):', 'Lie and presentation:', 'Fetal heart rate:', 'Urine protein and glucose:'].join('\n'),
      assessment: 'Antenatal visit. Maternal and fetal status:',
      plan: ['Investigations due:', 'Supplements and prophylaxis:', 'Birth plan and danger signs discussed:', 'Next visit:'].join('\n')
    }
  },
  {
    id: 'hypertension-review',
    label: 'Hypertension review',
    note: {
      subjective: ['Symptoms (headache, dizziness, chest pain, breathlessness, swelling):', 'Taking medicines as prescribed:', 'Side effects:', 'Salt, alcohol and smoking:', 'Other conditions:', 'Allergies:'].join('\n'),
      objective: ['Blood pressure (both arms if first visit):', 'Pulse:', 'Weight:', 'Heart and chest:', 'Oedema:'].join('\n'),
      assessment: 'Hypertension. Control:',
      plan: ['Medicines:', 'Tests due:', 'Lifestyle advice:', 'Review:'].join('\n')
    }
  },
  {
    id: 'diabetes-review',
    label: 'Diabetes review',
    note: {
      subjective: ['Symptoms (thirst, passing urine often, weight change, blurred vision):', 'Taking medicines or insulin as prescribed:', 'Low sugar episodes:', 'Diet and exercise:', 'Foot problems:', 'Allergies:'].join('\n'),
      objective: ['Weight:', 'Blood pressure:', 'Blood glucose today:', 'Feet (sensation, pulses, skin):', 'Injection sites if on insulin:'].join('\n'),
      assessment: 'Diabetes. Control and complications:',
      plan: ['Medicines:', 'Tests due:', 'Foot and eye care advice:', 'Review:'].join('\n')
    }
  },
  {
    id: 'gastroenteritis',
    label: 'Diarrhoea and vomiting',
    note: {
      subjective: ['Diarrhoea for (days) and how often:', 'Blood or mucus in stool:', 'Vomiting:', 'Fever:', 'Fluids taken and passing urine:', 'Others at home affected, food or water source:', 'Medicines taken:', 'Allergies:'].join('\n'),
      objective: ['General and hydration (mouth, eyes, skin turgor, capillary refill):', 'Pulse and blood pressure:', 'Abdomen:'].join('\n'),
      assessment: 'Acute gastroenteritis. Degree of dehydration:',
      plan: ['Rehydration:', 'Treatment:', 'Hygiene and danger signs explained:', 'Review:'].join('\n')
    }
  }
];

/** Drops prompts nobody answered (a line that is just "Label:"), and tidies the blank lines left behind. */
export function cleanNoteText(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => !/^[^:]{1,120}:\s*$/.test(line.trim()) || line.trim() === '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * One-click order sets. `tests` lists, for each test in the set, the words that identify it
 * in a facility's catalogue; a test is offered only when the catalogue has a match.
 */
export const ORDER_SETS = [
  { id: 'acute-fever', label: 'Acute fever panel', tests: [['malaria'], ['full blood count', 'fbc'], ['widal']] },
  { id: 'antenatal-booking', label: 'Antenatal booking panel', tests: [['full blood count', 'fbc'], ['urinalysis'], ['hepatitis b'], ['hiv'], ['blood glucose'], ['ultrasound - obstetric']] },
  { id: 'hypertension-baseline', label: 'Hypertension baseline', tests: [['full blood count', 'fbc'], ['renal function'], ['lipid'], ['blood glucose'], ['urinalysis']] },
  { id: 'diabetes-review', label: 'Diabetes review', tests: [['blood glucose'], ['renal function'], ['lipid'], ['urinalysis']] },
  { id: 'liver-screen', label: 'Liver and hepatitis screen', tests: [['liver function'], ['hepatitis b']] },
  { id: 'chest-review', label: 'Chest review', tests: [['x-ray - chest'], ['full blood count', 'fbc']] }
];

/** The catalogue items that make up an order set at this facility, and how many of its tests are missing. */
export function resolveOrderSet(set, catalog) {
  const found = [];
  let missing = 0;
  for (const words of set.tests) {
    const match = catalog.find((item) => {
      const name = String(item.name || '').toLowerCase();
      return words.some((word) => name.includes(word));
    });
    if (match && !found.some((item) => item.id === match.id)) found.push(match);
    else if (!match) missing += 1;
  }
  return { items: found, missing };
}
