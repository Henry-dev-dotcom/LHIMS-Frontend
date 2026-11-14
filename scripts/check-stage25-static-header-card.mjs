import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const headerPath = path.join(root, 'src', 'layouts', 'Header.jsx');
const source = fs.readFileSync(headerPath, 'utf8');

const failures = [];
if (source.includes('sticky top-0 z-20')) {
  failures.push('Header.jsx still uses sticky top-0 on the page heading card.');
}
if (!(source.includes('relative z-20 border-b border-white/60') || source.includes('relative z-[90] border-b border-white/60') || source.includes('relative z-90 border-b border-white/60'))) {
  failures.push('Header.jsx does not contain the expected static/relative header class.');
}

const distDir = path.join(root, 'dist', 'assets');
if (fs.existsSync(distDir)) {
  for (const file of fs.readdirSync(distDir)) {
    if (!file.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(distDir, file), 'utf8');
    if (content.includes('sticky top-0 z-20 border-b border-white/60')) {
      failures.push(`Compiled asset ${file} still contains sticky header class.`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Stage 25 static header card check passed.');
