#!/usr/bin/env node
/*
  Catches Tailwind utilities that silently produce no CSS.

  Tailwind's opacity scale is 0, 5, 10 ... 90, 95, 100. Write bg-white/98 and it
  is neither a scale step nor arbitrary-value syntax (that would be
  bg-white/[98%]), so Tailwind emits nothing at all: no warning, no error, and
  an element with no background. It renders as transparent, which only shows up
  when something happens to be behind it.

  That is exactly how the screen-guide panel ended up printing over the page,
  and how modals lost their dimmed backdrop. Neither produced a single console
  message. So the build output is checked instead: every opacity utility the
  source uses must have a matching selector in the compiled CSS.
*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = 'src';
const DIST = 'dist/assets';
const CODE = new Set(['.js', '.jsx', '.ts', '.tsx']);

/** Utilities that take a /opacity suffix. */
const PREFIXES = 'bg|text|border|ring|ring-offset|divide|placeholder|outline|decoration|accent|caret|fill|stroke|from|to|via|shadow';
const USAGE = new RegExp(String.raw`\b(?:[a-z-]+:)*(?:${PREFIXES})-[a-z0-9\-]+\/\d{1,3}\b`, 'g');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const cssFiles = (() => {
  try {
    return readdirSync(DIST).filter((f) => f.endsWith('.css')).map((f) => join(DIST, f));
  } catch {
    return [];
  }
})();

if (cssFiles.length === 0) {
  console.error('Tailwind class check: no built CSS found. Run the build first.');
  process.exit(1);
}

const css = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

const used = new Set();
for (const file of walk(SRC)) {
  if (!CODE.has(extname(file))) continue;
  for (const match of readFileSync(file, 'utf8').matchAll(USAGE)) used.add(match[0]);
}

/** The selector Tailwind would emit, with the variant prefix stripped. */
function baseUtility(cls) {
  const parts = cls.split(':');
  return parts[parts.length - 1];
}

const missing = [];
for (const cls of used) {
  // Tailwind escapes the slash, and a variant becomes part of the class name
  // (.hover\:bg-slate-50\/70:hover), so the leading dot is not adjacent to the
  // base utility. Match the escaped base anywhere in the stylesheet.
  const needle = baseUtility(cls).replace(/\//g, '\\/');
  if (!css.includes(needle)) missing.push(cls);
}

if (missing.length > 0) {
  console.error('Tailwind class check FAILED: these utilities produce no CSS, so they do nothing at all.\n');
  for (const cls of missing.sort()) {
    const where = walk(SRC)
      .filter((f) => CODE.has(extname(f)) && readFileSync(f, 'utf8').includes(cls))
      .slice(0, 3)
      .join(', ');
    console.error(`  ${cls}\n      used in: ${where}`);
  }
  console.error('\nOpacity must be a scale step (…80, 85, 90, 95, 100) or arbitrary syntax such as bg-white/[98%].');
  process.exit(1);
}

console.log(`Tailwind class check passed (${used.size} opacity utilities, all compiled).`);
