import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const url = process.env.LIGHTHOUSE_URL || 'http://127.0.0.1:4173/';
mkdirSync('artifacts', { recursive: true });
const result = spawnSync('npx', ['--yes', 'lighthouse', url, '--output=html', '--output=json', '--output-path=./artifacts/lighthouse', '--quiet', '--chrome-flags=--headless --no-sandbox'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) {
  console.error(`Could not run Lighthouse: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
