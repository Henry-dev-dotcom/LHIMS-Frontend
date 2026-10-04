import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const header = read('src/layouts/Header.jsx');
const failures = [];

// bg-white/94 was asserted here for a long time, and emitted no CSS at all:
// Tailwind's opacity scale has no 94 step, so the container was never
// actually white. /95 is a real step. See scripts/check-tailwind-classes.mjs.
if (!header.includes('rounded-[1.35rem]') || !header.includes('bg-white/95') || !header.includes('shadow-card')) {
  failures.push('Global page header must be restored inside a white rounded container.');
}
if (!header.includes('min-h-[4.6rem]') || !header.includes('py-2.5') || !header.includes('line-clamp-1')) {
  failures.push('Global page header container must use compact reduced-height sizing.');
}
if (header.includes('min-h-[7') || header.includes('py-6') || header.includes('rounded-[2.5rem]')) {
  failures.push('Global page header container appears too tall for Stage 18 compact layout.');
}

if (failures.length > 0) {
  console.error('Stage 18 compact header card check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Stage 18 compact header card check passed.');
