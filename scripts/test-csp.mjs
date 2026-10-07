#!/usr/bin/env node
/* Builds for the e2e API, then runs the policy tests. */
import { spawnSync } from 'node:child_process';

const env = { ...process.env, VITE_API_BASE_URL: 'http://localhost:5001/api', VITE_API_TIMEOUT_MS: '2000' };
const run = (command) => spawnSync(command, { stdio: 'inherit', shell: true, env }).status ?? 1;

if (run('npm run -s build') !== 0) process.exit(1);
process.exit(run('npx playwright test --config playwright.csp.config.js --retries=0'));
