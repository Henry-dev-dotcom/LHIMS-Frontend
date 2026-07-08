import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NAV_ITEMS } from '../src/data/roles.js';

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:4176/';
const outDir = path.resolve('qa-artifacts/final-responsive');
const storageKey = 'diagnosis-center-change-pack-v1-state';
const adminAuth = {
  role: 'admin',
  userName: 'System Admin',
  userId: 'AUTH-ADMIN',
  landing: 'admin-dashboard',
  linkedDoctorId: '',
  hospitalId: '',
  username: 'admin',
  loginAt: new Date().toISOString()
};

const viewports = [
  { name: 'phone', width: 390, height: 844, isMobile: true },
  { name: 'desktop', width: 1440, height: 900, isMobile: false }
];

const pages = [
  { id: 'login', label: 'Login', public: true, url: baseURL },
  ...NAV_ITEMS.map(item => ({ id: item.id, label: item.label, pageId: item.id, url: baseURL })),
  { id: 'public-report-verification', label: 'Public report verification', publicHash: '#/verify-report/SEC-ORD001-DEMO', url: `${baseURL}#/verify-report/SEC-ORD001-DEMO` },
  { id: 'public-patient-results', label: 'Public patient result portal', publicHash: '#/patient/results/PAT-001', url: `${baseURL}#/patient/results/PAT-001` }
];

function sanitize(name) {
  return name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const docScrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const main = document.getElementById('main-content');
    const mainScrollWidth = main ? main.scrollWidth : 0;
    const mainClientWidth = main ? main.clientWidth : 0;
    const visibleText = (document.body?.innerText || '').slice(0, 240);
    const offenders = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const isFixedOffCanvas = style.position === 'fixed' && (rect.left >= clientWidth || rect.right <= 0);
      if (isFixedOffCanvas) continue;
      if (rect.right > clientWidth + 3 || rect.left < -3 || rect.width > clientWidth + 3) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          className: String(el.className || '').slice(0, 160),
          text: String(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
          rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }
        });
      }
      if (offenders.length >= 8) break;
    }
    const errorBoundaryVisible = /Something went wrong|Reset saved state/i.test(document.body?.innerText || '');
    const loginVisible = /Sign in|Quick role login/i.test(document.body?.innerText || '');
    return {
      title: document.title,
      clientWidth,
      docScrollWidth,
      mainClientWidth,
      mainScrollWidth,
      bodyOverflow: docScrollWidth > clientWidth + 3,
      mainOverflow: main ? mainScrollWidth > mainClientWidth + 3 : false,
      errorBoundaryVisible,
      loginVisible,
      visibleText,
      offenders
    };
  });
}

async function run() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
  const results = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      deviceScaleFactor: viewport.isMobile ? 2 : 1,
      userAgent: viewport.isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined
    });
    await context.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, qa: 'offline-api-simulated' }) }));
    const consoleErrors = [];
    context.on('page', page => {
      page.on('console', msg => {
        if (['error'].includes(msg.type())) consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => consoleErrors.push(err.message));
    });

    for (const appPage of pages) {
      const page = await context.newPage();
      const errorsBefore = consoleErrors.length;
      await page.addInitScript(({ storageKey, auth, pageId, publicPage }) => {
        window.localStorage.clear();
        if (!publicPage) {
          window.localStorage.setItem(storageKey, JSON.stringify({ auth, currentPage: pageId || 'admin-dashboard', ui: { sidebarOpen: false, toast: null } }));
        }
      }, { storageKey, auth: adminAuth, pageId: appPage.pageId, publicPage: appPage.public || appPage.publicHash });

      let status = 'passed';
      let notes = [];
      try {
        await page.goto(appPage.url, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(350);
        const screenshotPath = path.join(outDir, `${viewport.name}-${sanitize(appPage.id)}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        const metrics = await collectMetrics(page);
        const newErrors = consoleErrors.slice(errorsBefore).filter(error => !/Failed to load resource/i.test(error));
        if (metrics.bodyOverflow) notes.push(`document horizontal overflow: ${metrics.docScrollWidth}px > ${metrics.clientWidth}px`);
        if (metrics.mainOverflow) notes.push(`main horizontal overflow: ${metrics.mainScrollWidth}px > ${metrics.mainClientWidth}px`);
        if (metrics.errorBoundaryVisible) notes.push('error boundary visible');
        if (!appPage.public && appPage.id !== 'login' && metrics.loginVisible) notes.push('unexpected login screen after auth seed');
        if (newErrors.length) notes.push(`console/page errors: ${newErrors.slice(0, 3).join(' | ')}`);
        if (notes.length) status = 'review';
        results.push({ viewport: viewport.name, page: appPage.id, label: appPage.label, status, notes, metrics, screenshot: screenshotPath });
      } catch (error) {
        results.push({ viewport: viewport.name, page: appPage.id, label: appPage.label, status: 'failed', notes: [error.message], metrics: null, screenshot: null });
      } finally {
        await page.close();
      }
    }

    // Interaction checks on dashboard for menus/drawers.
    const page = await context.newPage();
    await page.addInitScript(({ storageKey, auth }) => {
      window.localStorage.clear();
      window.localStorage.setItem(storageKey, JSON.stringify({ auth, currentPage: 'admin-dashboard', ui: { sidebarOpen: false, toast: null } }));
    }, { storageKey, auth: adminAuth });
    const interaction = { viewport: viewport.name, page: 'interaction-checks', label: 'Header / sidebar / notification / user menu', status: 'passed', notes: [] };
    try {
      await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(300);
      if (viewport.name === 'phone') {
        const menuButton = page.locator('button[aria-label*="Open navigation"], button:has-text("☰")').first();
        if (await menuButton.count()) {
          await menuButton.click();
          await page.waitForTimeout(150);
          const drawerVisible = await page.locator('[role="dialog"][aria-label*="navigation" i], aside').first().isVisible().catch(() => false);
          if (!drawerVisible) interaction.notes.push('mobile drawer did not become visible');
          await page.screenshot({ path: path.join(outDir, `${viewport.name}-interaction-sidebar-open.png`), fullPage: true });
          await page.keyboard.press('Escape').catch(() => {});
        } else {
          interaction.notes.push('mobile navigation button not found');
        }
      }
      const notificationButton = page.locator('button[aria-label*="notification" i]').first();
      if (await notificationButton.count()) {
        await notificationButton.click();
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(outDir, `${viewport.name}-interaction-notifications.png`), fullPage: true });
        await page.keyboard.press('Escape').catch(() => {});
      } else {
        interaction.notes.push('notification button not found');
      }
      const userButton = page.locator('button[aria-label*="user" i], button:has-text("System Admin"), button:has-text("Admin")').first();
      if (await userButton.count()) {
        await userButton.click();
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(outDir, `${viewport.name}-interaction-user-menu.png`), fullPage: true });
      } else {
        interaction.notes.push('user menu button not found');
      }
      const metrics = await collectMetrics(page);
      if (metrics.bodyOverflow) interaction.notes.push(`interaction overflow: ${metrics.docScrollWidth}px > ${metrics.clientWidth}px`);
      if (interaction.notes.length) interaction.status = 'review';
    } catch (error) {
      interaction.status = 'failed';
      interaction.notes.push(error.message);
    } finally {
      results.push(interaction);
      await page.close();
    }
    await context.close();
  }
  await browser.close();
  const summary = {
    generatedAt: new Date().toISOString(),
    baseURL,
    pageCount: pages.length,
    viewportCount: viewports.length,
    totals: {
      passed: results.filter(r => r.status === 'passed').length,
      review: results.filter(r => r.status === 'review').length,
      failed: results.filter(r => r.status === 'failed').length,
      total: results.length
    },
    results
  };
  await fs.writeFile(path.join(outDir, 'final-responsive-qa-results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary.totals, null, 2));
  const reviews = results.filter(r => r.status !== 'passed');
  if (reviews.length) {
    console.log('Items requiring review:');
    for (const item of reviews) console.log(`${item.viewport} ${item.page}: ${item.notes.join('; ')}`);
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
