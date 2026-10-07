#!/usr/bin/env node
/*
  Serves the production build with the exact Content-Security-Policy nginx.conf
  ships, so that what the policy blocks can be tested rather than guessed at.

  The policy is read out of nginx.conf itself, never copied here: a test that
  carries its own copy of the policy goes on passing after the real one changes.

  Usage: node scripts/serve-with-csp.mjs <dir> <port> <nginx.conf>
*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 5174);
const conf = fs.readFileSync(process.argv[4] || 'nginx.conf', 'utf8');
const match = conf.match(/Content-Security-Policy "([^"]+)"/);
if (!match) {
  console.error('No Content-Security-Policy found in the nginx config.');
  process.exit(1);
}
const csp = match[1];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  // The app is a single page: anything that is not a file is the shell.
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.writeHead(200, {
    'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${root} on ${port} with the nginx.conf policy`));
