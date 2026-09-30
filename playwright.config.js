import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/*
  End-to-end tests (Phase 7): real browser, real backend, real database.

  `npm run test:e2e` starts its own stack, separate from your dev servers:
  - the backend (../diagnosis-center-backend, or E2E_BACKEND_DIR) on port 5001,
    after resetting and seeding the E2E database;
  - this frontend on port 5174, pointed at that backend.

  The E2E database is E2E_DATABASE_URL, or the backend's DATABASE_URL with
  the database renamed lhims_e2e. It is wiped on every run, so its name must
  contain "e2e".
*/

const backendDir = path.resolve(process.env.E2E_BACKEND_DIR || '../diagnosis-center-backend');
const API_PORT = 5001;
const WEB_PORT = 5174;

function e2eDatabaseUrl() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const envFile = path.join(backendDir, '.env');
  const line = existsSync(envFile) ? readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')) : null;
  if (!line) throw new Error('Set E2E_DATABASE_URL (a PostgreSQL database whose name contains "e2e").');
  const url = new URL(line.slice('DATABASE_URL='.length).replace(/^"|"$/g, ''));
  url.pathname = '/lhims_e2e';
  return url.toString();
}

const databaseUrl = e2eDatabaseUrl();
if (!/e2e/i.test(new URL(databaseUrl).pathname)) throw new Error('The E2E database name must contain "e2e" (it is wiped on every run).');

export const E2E = { apiUrl: `http://localhost:${API_PORT}/api`, webUrl: `http://localhost:${WEB_PORT}` };

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: E2E.webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1366, height: 900 }
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ }
  ],
  webServer: [
    {
      // Fresh database every run, then the API with generous rate limits.
      command: 'npx prisma migrate reset --force --skip-generate && npx tsx src/server.ts',
      cwd: backendDir,
      url: `${E2E.apiUrl}/ready`,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: databaseUrl,
        PORT: String(API_PORT),
        FRONTEND_URL: E2E.webUrl,
        FRONTEND_URLS: `${E2E.webUrl},http://127.0.0.1:${WEB_PORT}`,
        PAYMENT_GATEWAY: 'fake',
        PAYMENT_CALLBACK_URL: `${E2E.webUrl}/`,
        RATE_LIMIT_MAX_REQUESTS: '1000000',
        AUTH_RATE_LIMIT_MAX_REQUESTS: '1000000',
        ENABLE_API_DOCS: 'false'
      }
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: E2E.webUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: E2E.apiUrl }
    }
  ]
});
