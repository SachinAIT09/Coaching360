import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boot, trackErrors, go, noHorizontalOverflow, SUPERVISOR_ROUTES, AGENT_ROUTES } from './helpers';

// Every route, in both roles and both themes: renders, no runtime errors, no sideways scroll, no axe violations
for (const theme of ['dark', 'light']) {
  for (const [role, routes] of [['supervisor', SUPERVISOR_ROUTES], ['agent', AGENT_ROUTES]]) {
    for (const route of routes) {
      test(`${role} #/${route} (${theme})`, async ({ page }) => {
        const errors = trackErrors(page);
        await boot(page, { role, theme });
        await go(page, route);
        await expect(page).toHaveURL(new RegExp(`#/${route}$`));
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await noHorizontalOverflow(page);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        const summary = axe.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(summary).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  }

  test(`sign-in page (${theme})`, async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page, { role: null, theme });
    await page.goto('#/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in with your account' })).toBeVisible();
    await noHorizontalOverflow(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('pages of the other role redirect to that role home', async ({ page }) => {
  await boot(page, { role: 'agent' });
  await page.goto('#/grading');
  await expect(page).toHaveURL(/#\/me$/);
  await page.goto('#/does-not-exist');
  await expect(page).toHaveURL(/#\/me$/);
});

test('supervisor deep links survive refresh and history', async ({ page }) => {
  await boot(page);
  await go(page, 'reports?r=alerts');
  await expect(page.getByRole('heading', { name: 'Policy Alerts' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Policy Alerts' })).toBeVisible();
  await go(page, 'coaching?tab=Sessions');
  await expect(page.getByRole('tab', { name: 'Sessions' })).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page).toHaveURL(/r=alerts/);
  await page.goForward();
  await expect(page).toHaveURL(/tab=Sessions/);
});
