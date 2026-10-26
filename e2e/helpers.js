import { expect } from '@playwright/test';

export const SUPERVISOR_ROUTES = ['home', 'queue', 'performance', 'grading', 'coaching', 'coaching/workspace', 'goals', 'library', 'analytics', 'reports', 'settings'];
export const AGENT_ROUTES = ['me', 'me/calls', 'me/coaching', 'me/goals'];

// Start from fresh demo data, signed in with the given role (role: null = signed out) and theme preference
export async function boot(page, { role = 'supervisor', theme } = {}) {
  await page.addInitScript(({ role, theme }) => {
    if (sessionStorage.getItem('__booted')) return;
    sessionStorage.setItem('__booted', '1');
    localStorage.clear();
    const user = role === 'agent' ? 'agent@gmail.com' : 'steve@powerconnect.ai';
    localStorage.setItem('coaching360-demo-v3', JSON.stringify(role ? { role, user } : {}));
    if (theme) localStorage.setItem('coaching360-theme', theme);
  }, { role, theme });
}

// Collect console errors and uncaught exceptions for the whole test
export function trackErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  return errors;
}

export async function go(page, route) {
  await page.goto(`#/${route}`);
  await expect(page.locator('main h1, main h2').first()).toBeVisible();
}

export async function noHorizontalOverflow(page) {
  // clientWidth, not innerWidth: mobile browsers widen the layout viewport to fit overflowing content
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(1);
}

export const isMobile = (testInfo) => testInfo.project.name === 'mobile';

// Navigate through the app's own navigation (drawer on mobile)
export async function navTo(page, testInfo, name) {
  if (isMobile(testInfo)) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', typeof name === 'string' ? { name, exact: true } : { name }).first().click();
}

// Sign out through the profile menu, then sign in with a demo account
export async function signInAs(page, email) {
  if (await page.getByRole('button', { name: /^Profile:/ }).isVisible()) {
    await page.getByRole('button', { name: /^Profile:/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
  }
  await expect(page).toHaveURL(/#\/login$/);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel(/^password$/i).fill('admin');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
