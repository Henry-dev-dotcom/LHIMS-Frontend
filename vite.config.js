import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    // The dev server watches the whole project folder. A Playwright run writes thousands of trace
    // files into e2e-results while it runs, and handling each of those events kept the server too
    // busy to serve a page's code promptly: pages sat on their loading skeleton for many seconds.
    // None of these folders holds source, so none needs watching.
    watch: {
      ignored: ['**/e2e-results/**', '**/e2e-report/**', '**/e2e-csp/**', '**/qa-artifacts/**', '**/qa-screenshots/**', '**/artifacts/**', '**/dist/**', '**/docs/**']
    }
  },
  build: {
    outDir: 'dist',
    // Disabled for production: source maps would publish the full readable
    // source on a public GitHub Pages site and add ~2.4 MB to the deploy.
    sourcemap: false
  }
});
