export const NOTE_EDITOR_SECTIONS = [
  ['subjective', 'Subjective'],
  ['objective', 'Objective'],
  ['assessment', 'Assessment'],
  ['plan', 'Plan']
];

const EMPTY_SECTIONS = Object.fromEntries(NOTE_EDITOR_SECTIONS.map(([key]) => [key, '']));
const HEADER = /^\s{0,3}(?:#{1,3}\s*)?(subjective(?:\s*\([^)]*\))?|history|objective(?:\s*\([^)]*\))?|examination|assessment|plan)\s*:?\s*$/i;

function sectionForHeading(value) {
  const heading = value.toLowerCase();
  if (heading.startsWith('subjective') || heading === 'history') return 'subjective';
  if (heading.startsWith('objective') || heading === 'examination') return 'objective';
  if (heading === 'assessment') return 'assessment';
  return 'plan';
}

/**
 * Shows legacy SOAP drafts in the single editor without changing their saved fields.
 * A lone subjective narrative stays plain text; multi-section notes get visible headings.
 */
export function noteEditorTextFromSections(sections = {}) {
  const values = Object.fromEntries(NOTE_EDITOR_SECTIONS.map(([key]) => [key, String(sections[key] || '')]));
  const populated = NOTE_EDITOR_SECTIONS.filter(([key]) => values[key].trim());
  if (populated.length === 0) return '';
  if (populated.length === 1 && populated[0][0] === 'subjective') return values.subjective;
  return populated.map(([key, label]) => `## ${label}\n${values[key]}`).join('\n\n');
}

/** Maps unified editor text into the existing four-field draft contract. */
export function noteSectionsFromEditorText(text = '') {
  const lines = String(text).split('\n');
  const sections = Object.fromEntries(NOTE_EDITOR_SECTIONS.map(([key]) => [key, []]));
  let current = null;
  let foundHeading = false;

  for (const line of lines) {
    const match = line.match(HEADER);
    if (match) {
      current = sectionForHeading(match[1]);
      foundHeading = true;
      continue;
    }
    if (!current) current = 'subjective';
    sections[current].push(line);
  }

  if (!foundHeading) return { ...EMPTY_SECTIONS, subjective: String(text) };

  return Object.fromEntries(NOTE_EDITOR_SECTIONS.map(([key]) => {
    const value = sections[key].join('\n');
    // Drop only the blank separator around headings inserted by the formatter.
    return [key, value.replace(/^\n/, '').replace(/\n$/, '')];
  }));
}

/** Adds explicit, editable SOAP section headings without overwriting existing text. */
export function formatSoapStructureText(sections = {}) {
  return NOTE_EDITOR_SECTIONS
    .map(([key, label]) => `## ${label}\n${String(sections[key] || '')}`)
    .join('\n\n');
}
