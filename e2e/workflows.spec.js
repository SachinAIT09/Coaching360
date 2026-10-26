import { test, expect } from '@playwright/test';
import { boot, trackErrors, go, isMobile, navTo, signInAs } from './helpers';

const toast = (page) => page.getByRole('status').filter({ hasText: /\w/ });

const switchRole = (page, role) => signInAs(page, role === 'agent' ? 'agent@gmail.com' : 'steve@powerconnect.ai');

test.describe('workflows', () => {
  let errors;
  test.beforeEach(async ({ page }) => { errors = trackErrors(page); await boot(page); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('grade a call, explain the override, finalize, then open it in the Coaching Workspace', async ({ page }) => {
    await go(page, 'grading/a1?call=2857391');
    const total = page.getByText('Total score').locator('b');
    await expect(total).toHaveText('82%');
    await page.getByRole('button', { name: 'Opening: 3' }).click();
    await expect(page.getByRole('button', { name: 'Opening: 3' })).toHaveAttribute('aria-pressed', 'true');
    await expect(total).toHaveText('92%');
    await expect(page.getByText('In Review', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Finalize evaluation' }).click();
    await expect(toast(page)).toContainText('Give a reason for each changed AI score (1 missing)');
    const why = page.getByRole('textbox', { name: /You changed the AI score 1 → 3/ });
    await why.fill('Email was already on file.');
    await page.getByRole('button', { name: 'Finalize evaluation' }).click();
    await expect(toast(page)).toContainText('Evaluation QA-2857391 finalized · total 92%');
    await expect(page.getByText('Coach Validated', { exact: true })).toBeVisible();
    await expect(page.getByText(/Opening: 1 → 3 · "Email was already on file."/)).toBeVisible();

    await page.getByRole('button', { name: 'Open in Coaching' }).click();
    await expect(page).toHaveURL(/#\/coaching\/workspace\?agent=a1&calls=2857391$/);
    await expect(page.getByRole('heading', { name: 'Coaching Workspace' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Performance Coaching/ })).toBeChecked();
    await page.getByRole('button', { name: 'Complete session' }).first().click();
    await expect(toast(page)).toContainText('Add the reason for coaching');
    await page.getByRole('textbox', { name: 'Reason for coaching' }).fill('Missed email request in the opening.');
    await page.getByRole('button', { name: 'Complete session' }).first().click();
    await expect(toast(page)).toContainText('Coaching session completed and sent to Camille Dubois');
    await expect(page).toHaveURL(/tab=Sessions/);
  });

  test('manual grading hides AI scores and finalizes as Coach Graded', async ({ page }) => {
    await go(page, 'grading/a1?call=2857391');
    await page.getByRole('button', { name: 'Manual coach grading' }).click();
    await expect(toast(page)).toContainText('Manual grading: AI scores hidden');
    await expect(page.getByRole('columnheader', { name: 'AI score' })).toHaveCount(0);
    await expect(page.getByText('Total score').locator('b')).toHaveText('—');
    for (const cat of ['Accuracy', 'Expectation Setting', 'Word Choice', 'Politeness', 'Opening', 'Closing', 'Tone', 'Pace']) {
      await page.getByRole('button', { name: `${cat}: 3` }).click();
    }
    await expect(page.getByText('Total score').locator('b')).toHaveText('100%');
    await page.getByRole('button', { name: 'Add moment' }).click();
    await page.getByRole('textbox', { name: 'What happened' }).fill('Customer thanked the agent');
    await page.getByRole('button', { name: 'Save moment' }).click();
    await expect(page.getByRole('button', { name: /Customer thanked the agent/ })).toBeVisible();
    await page.getByRole('combobox', { name: 'New tag' }).fill('Good Example');
    await page.getByRole('button', { name: 'Add tag' }).click();
    await expect(page.getByRole('button', { name: 'Remove tag Good Example' })).toBeVisible();
    await page.getByRole('button', { name: 'Finalize evaluation' }).click();
    await expect(page.getByText('Coach Graded', { exact: true })).toBeVisible();
    await go(page, 'library');
    await page.getByRole('combobox', { name: 'Tag' }).selectOption('Good Example');
    await expect(page.getByText('Showing 1 of 1 calls')).toBeVisible();
  });

  test('scoring requires a reviewer and every category', async ({ page }) => {
    await go(page, 'grading/a1?call=2857391');
    await page.getByRole('combobox', { name: 'Reviewer' }).selectOption('');
    await page.getByRole('button', { name: 'Finalize evaluation' }).click();
    await expect(toast(page)).toContainText('Select a reviewer first');
    await page.getByRole('combobox', { name: 'Reviewer' }).selectOption('Diego Herrera');
    await page.getByRole('button', { name: 'Accuracy: 3' }).click(); // toggles the selected score off
    await page.getByRole('button', { name: 'Finalize evaluation' }).click();
    await expect(toast(page)).toContainText('Score all categories first (1 missing)');
    await expect(page.getByRole('button', { name: 'Accuracy: 2' })).toBeDisabled(); // binary category
  });

  test('clear form asks for confirmation; dialog traps focus and returns it', async ({ page }) => {
    await go(page, 'grading/a1?call=2857391');
    const trigger = page.getByRole('button', { name: 'Clear form' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Clear this review?' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByRole('button', { name: 'Clear form' }).click();
    await expect(toast(page)).toContainText('Form cleared');
    await expect(page.getByText('Total score').locator('b')).toHaveText('—');
  });

  test('review queue: filter by reason and accept the AI score', async ({ page }) => {
    await go(page, 'queue');
    const all = page.getByRole('button', { name: /^All \d+$/ });
    const before = Number((await all.textContent()).replace(/\D/g, ''));
    await page.getByRole('button', { name: /^Low score \d+$/ }).click();
    await expect(page.getByRole('button', { name: /^Low score/ })).toHaveAttribute('aria-pressed', 'true');
    await all.click();
    await page.getByRole('button', { name: 'Accept AI score' }).first().click();
    await expect(toast(page)).toContainText('AI score accepted');
    await expect(all).toHaveText(`All ${before - 1}`);
    await expect(page.getByRole('button', { name: 'Policy violation 0' })).toBeDisabled();
  });

  test('review queue: pages of 10, next / numbered pages, and filters return to page 1', async ({ page }) => {
    await go(page, 'queue');
    const total = Number((await page.getByRole('button', { name: /^All \d+$/ }).textContent()).replace(/\D/g, ''));
    const pager = page.getByRole('navigation', { name: 'Pagination' });
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(10);
    await expect(pager).toContainText(`Showing 1–10 of ${total} flagged calls`);
    await expect(pager.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await pager.getByRole('button', { name: 'Next page' }).click();
    await expect(pager).toContainText(`Showing 11–20 of ${total}`);
    await expect(pager.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    const last = Math.ceil(total / 10);
    await pager.getByRole('button', { name: `Page ${last}` }).click();
    await expect(rows).toHaveCount(total - (last - 1) * 10);
    await expect(pager.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await page.getByRole('button', { name: /^Low score \d+$/ }).click();
    await expect(pager).toContainText(/Showing 1–\d+ of \d+ flagged calls/);
  });

  test('call library: search, sort, paginate and open a row with the keyboard', async ({ page }) => {
    await go(page, 'library');
    const pager = page.getByRole('navigation', { name: 'Pagination' });
    await expect(pager).toContainText(/Showing 1–25 of [\d,]+ calls/);
    await pager.getByRole('button', { name: 'Next page' }).click();
    await expect(pager).toContainText(/Showing 26–50 of [\d,]+ calls/);
    await expect(page.locator('tbody tr')).toHaveCount(25);
    const scoreTh = page.getByRole('columnheader', { name: /Score/ });
    await scoreTh.getByRole('button').click();
    await expect(scoreTh).toHaveAttribute('aria-sort', 'descending');
    await scoreTh.getByRole('button').click();
    await expect(scoreTh).toHaveAttribute('aria-sort', 'ascending');
    await expect(pager).toContainText(/Showing 1–25 of/);
    await page.getByRole('searchbox', { name: 'Search calls' }).fill('2857391');
    await expect(page.getByText('Showing 1 of 1 calls')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search calls' }).fill('zzz-no-match');
    await expect(page.getByText('No calls match these filters.')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search calls' }).fill('2857391');
    await page.locator('tbody tr').first().focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/grading\/a1\?call=2857391$/);
  });

  test('agent acknowledges coaching and disputes a score; supervisor sees the dispute', async ({ page }, testInfo) => {
    await go(page, 'home');
    await switchRole(page, 'agent');
    await expect(page).toHaveURL(/#\/me$/);
    await expect(page.getByRole('button', { name: 'Profile: Camille Dubois' })).toBeVisible();

    await navTo(page, testInfo, /^My Coaching/);
    await page.getByRole('button', { name: 'Acknowledge' }).click();
    await expect(toast(page)).toContainText('Coaching acknowledged');

    await navTo(page, testInfo, /^My Performance/);
    await page.getByRole('button', { name: 'Dispute score' }).click();
    const dialog = page.getByRole('dialog', { name: /Dispute score on call/ });
    const send = dialog.getByRole('button', { name: 'Send dispute' });
    await expect(send).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Why do you disagree?' }).fill('The email was already on file.');
    await send.click();
    await expect(toast(page)).toContainText('Dispute sent to your supervisor');
    await expect(page.getByText('Dispute open')).toBeVisible();

    await switchRole(page, 'supervisor');
    await go(page, 'queue');
    await expect(page.getByRole('button', { name: 'Agent dispute 1' })).toBeEnabled();
  });

  test('supervisor resolves a disputed session and sets a follow-up goal', async ({ page }) => {
    await go(page, 'coaching?tab=Sessions');
    await page.getByRole('combobox', { name: 'Status filter' }).selectOption('Disputed');
    await page.getByRole('button', { name: 'Mark resolved' }).click();
    await expect(toast(page)).toContainText('Dispute resolved');
    await page.getByRole('combobox', { name: 'Status filter' }).selectOption('Resolved');
    await page.getByRole('button', { name: 'Create follow-up goal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create goal from this session' });
    await dialog.getByRole('button', { name: 'Create goal' }).click();
    await expect(toast(page)).toContainText('Goal created for');
    await expect(page.getByRole('link', { name: 'Follow-up goal set →' })).toBeVisible();
  });

  test('coaching workspace: link calls, document notes, create a goal and save a draft', async ({ page }) => {
    await go(page, 'coaching');
    await page.getByRole('button', { name: 'New coaching session' }).click();
    await expect(page).toHaveURL(/#\/coaching\/workspace\?agent=a1$/);
    await expect(page.getByRole('radio', { name: /General Coaching/ })).toBeChecked();
    await page.getByRole('radio', { name: /Developmental Call Review/ }).check();
    await page.getByRole('combobox', { name: 'Review type' }).selectOption('requested');
    await page.getByRole('checkbox', { name: /^Select call/ }).first().check();
    await page.getByRole('button', { name: /Link 1 selected/ }).click();
    await expect(toast(page)).toContainText('1 call linked');
    await expect(page.getByRole('checkbox', { name: 'Employee requested this review' })).toBeChecked();
    await expect(page.getByText("Employee's question:")).toBeVisible();
    await page.getByRole('button', { name: 'Use observations from linked calls' }).click();
    await page.getByRole('textbox', { name: /Key takeaways/ }).fill('Acknowledge frustration before explaining the notice.');
    await page.getByRole('textbox', { name: 'New action item' }).fill('Recap next steps');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove action item: Recap next steps' })).toBeVisible();
    await page.getByRole('button', { name: 'Create goal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create goal from this session' });
    await dialog.getByRole('textbox', { name: 'Goal' }).fill('Acknowledge frustration with empathy');
    await dialog.getByRole('combobox', { name: /Observable behavior/ }).selectOption('empathy');
    await expect(dialog.getByText(/Baseline: \d+%/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Create goal' }).click();
    await expect(toast(page)).toContainText('Goal created for Camille Dubois');
    await expect(page.getByRole('checkbox', { name: 'Discussed in this session' }).first()).toBeChecked();
    await page.getByRole('button', { name: 'Save draft' }).first().click();
    await expect(toast(page)).toContainText('Coaching session saved as draft');
    await page.goto('#/coaching?tab=Sessions');
    await page.getByRole('combobox', { name: 'Status filter' }).selectOption('Draft');
    await expect(page.getByRole('button', { name: 'Continue in workspace' })).toBeVisible();
  });

  test('agent requests feedback on a call; it appears as a developmental review', async ({ page }) => {
    await go(page, 'home');
    await switchRole(page, 'agent');
    await page.getByRole('button', { name: 'Request feedback' }).click();
    const dialog = page.getByRole('dialog', { name: /Request feedback on call/ });
    await dialog.getByRole('textbox').fill('How could I have shortened the hold?');
    await dialog.getByRole('button', { name: 'Send request' }).click();
    await expect(toast(page)).toContainText('developmental review');
    await expect(page.getByText('Feedback requested')).toBeVisible();
    await switchRole(page, 'supervisor');
    await go(page, 'library');
    await page.getByRole('combobox', { name: 'Review type' }).selectOption('requested');
    await page.getByRole('combobox', { name: 'Date range' }).selectOption('all');
    await expect(page.getByText('Showing 1–2 of 2 calls')).toBeVisible();
  });

  test('agent performance: period selector and drill-down into the calls behind a metric', async ({ page }, testInfo) => {
    await go(page, 'performance/a1');
    await page.getByRole('combobox', { name: 'Reporting period' }).selectOption('7');
    await page.getByRole('button', { name: /^Overall QA score/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Score breakdown' });
    await expect(dialog.getByText(/calls in the calculation/)).toBeVisible();
    // On desktop the whole table fits: the row actions are not clipped by the dialog
    if (!isMobile(testInfo)) await expect(dialog.getByRole('button', { name: /^Open call/ }).first()).toBeInViewport({ ratio: 1 });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: /^Opening .*Show calls below expectation/ }).click();
    await expect(page.getByRole('dialog', { name: 'Opening: calls below expectation' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'By call type' }).click();
    await expect(page.getByRole('columnheader', { name: 'Call type' })).toBeVisible();
  });

  test('agent performance: roster drills into an agent, steps through the team and returns', async ({ page }) => {
    await go(page, 'performance');
    await expect(page.getByRole('heading', { level: 1, name: 'Agent Performance' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Team filter' }).selectOption('Billing Support');
    await expect(page.getByRole('row', { name: 'Open Camille Dubois' })).toHaveCount(0);
    await page.getByRole('row', { name: 'Open Mateo Silva' }).click();
    await expect(page).toHaveURL(/#\/performance\/a5\?team=Billing/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mateo Silva' })).toBeVisible();
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await page.getByRole('link', { name: /^Next agent:/ }).click();
    await expect(crumbs.getByText('Billing Support')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Mateo Silva' })).toHaveCount(0);
    await crumbs.getByRole('link', { name: 'Agent Performance' }).click();
    await expect(page).toHaveURL(/#\/performance\?team=Billing/);
    await expect(page.getByRole('combobox', { name: 'Team filter' })).toHaveValue('Billing Support');
  });

  test('call grading: roster opens an agent, the call picker updates the URL, arrows switch agent', async ({ page }) => {
    await go(page, 'grading');
    await expect(page.getByRole('heading', { level: 1, name: 'Call Grading' })).toBeVisible();
    await page.getByRole('row', { name: 'Open Ingrid Larsen' }).click();
    await expect(page).toHaveURL(/#\/grading\/a6$/);
    await expect(page.getByRole('textbox', { name: 'Agent' })).toHaveValue('Ingrid Larsen');
    const pick = page.getByRole('combobox', { name: 'Call ID' });
    const second = await pick.locator('option').nth(1).getAttribute('value');
    await pick.selectOption(second);
    await expect(page).toHaveURL(new RegExp(`#/grading/a6\\?call=${second}$`));
    await page.getByRole('link', { name: /^Next agent:/ }).click();
    await expect(page.getByRole('textbox', { name: 'Agent' })).not.toHaveValue('Ingrid Larsen');
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Call Grading' }).click();
    await expect(page).toHaveURL(/#\/grading$/);
  });

  test('agent performance: unknown agent id falls back to the roster', async ({ page }) => {
    await page.goto('#/performance/nobody');
    await expect(page).toHaveURL(/#\/performance$/);
  });

  test('goals: create a goal (validation) and switch scope tabs with the keyboard', async ({ page }) => {
    await go(page, 'goals');
    await page.getByRole('button', { name: 'Create goal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create goal' });
    const create = dialog.getByRole('button', { name: 'Create goal' });
    await expect(create).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Goal' }).fill('Confirm the callback number');
    await create.click();
    await expect(toast(page)).toContainText('Goal created for Camille Dubois');
    await page.getByRole('tab', { name: 'Selected agent' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Team goals' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Team goals' })).toBeFocused();
  });

  test('QA template: weights must total 100% before publishing', async ({ page }) => {
    await go(page, 'settings');
    const publish = page.getByRole('button', { name: 'Publish as v4' });
    await expect(publish).toBeDisabled();
    await page.getByRole('spinbutton', { name: 'Weight for Accuracy' }).fill('25');
    await expect(page.getByText('Total weight 105%')).toBeVisible();
    await expect(page.getByText('Weights must total 100% before publishing.')).toBeVisible();
    await expect(publish).toBeDisabled();
    await page.getByRole('spinbutton', { name: 'Weight for Tone' }).fill('0');
    await expect(page.getByText('Total weight 100%')).toBeVisible();
    await publish.click();
    await expect(toast(page)).toContainText('Template v4 published');
    await expect(page.getByText(/Active: v4/)).toBeVisible();
    await page.getByRole('tab', { name: 'Alerts' }).click();
    await page.getByRole('button', { name: 'Send test alert' }).click();
    await expect(toast(page)).toContainText('Test alert sent to');
  });

  test('reports: switch report, export CSV, review an alert', async ({ page }) => {
    await go(page, 'reports');
    await page.getByRole('button', { name: /Sentiment/ }).click();
    await expect(page).toHaveURL(/r=sentiment/);
    await expect(page.getByRole('heading', { name: 'Sentiment', level: 2 })).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    expect(download.suggestedFilename()).toBe('sentiment-report.csv');
    await page.getByRole('button', { name: /Policy Alerts/ }).click();
    await page.getByRole('button', { name: 'Mark reviewed' }).first().click();
    await expect(toast(page)).toContainText('Alert marked reviewed');
    await expect(page.getByRole('button', { name: '1 open alerts' })).toBeVisible();
  });

  test('ask about your team shows one answer at a time, with recent questions to switch back', async ({ page }) => {
    await go(page, 'home');
    await page.getByRole('button', { name: 'Who are my top performers this month?' }).first().click();
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(1);
    await page.getByRole('textbox', { name: 'Ask a question' }).fill('Any open policy alerts?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.locator('p.italic', { hasText: 'Any open policy alerts?' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(1); // previous answer is not stacked
    await page.getByRole('button', { name: 'Show answer: Who are my top performers this month?' }).click();
    await expect(page.locator('p.italic', { hasText: 'Who are my top performers this month?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Ask a question' }).fill('asdf');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByRole('heading', { name: "I can't answer that one yet" })).toBeVisible();
    await page.getByRole('button', { name: 'Clear answer' }).click();
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Show answer:/ })).toHaveCount(3);
    await page.getByRole('button', { name: 'Clear history' }).click();
    await expect(page.getByRole('button', { name: /^Show answer:/ })).toHaveCount(0);
  });

  test('agent search combobox works with the keyboard', async ({ page }, testInfo) => {
    await go(page, 'home');
    if (isMobile(testInfo)) await page.getByRole('button', { name: 'Search agent' }).click();
    const box = page.getByRole('combobox', { name: 'Search agent' });
    await box.fill('Ingrid');
    await expect(page.getByRole('option', { name: /Ingrid Larsen/ })).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/#\/performance\/a\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Ingrid Larsen' })).toBeVisible();
  });

  test('alert bell opens, closes with Escape and links to alerts', async ({ page }) => {
    await go(page, 'home');
    const bell = page.getByRole('button', { name: '2 open alerts' });
    await bell.click();
    await expect(page.getByText('Open policy alerts', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Open policy alerts', { exact: true })).toBeHidden();
    await expect(bell).toBeFocused();
    await bell.click();
    await page.getByRole('button', { name: 'View all alerts' }).click();
    await expect(page).toHaveURL(/r=alerts/);
  });

  test('reset demo data from the profile menu restores the seed', async ({ page }) => {
    await go(page, 'queue');
    await page.getByRole('button', { name: 'Accept AI score' }).first().click();
    await expect(page.getByRole('button', { name: /^All 30$/ })).toBeVisible();
    await page.getByRole('button', { name: /^Profile:/ }).click();
    await page.getByRole('menuitem', { name: 'Reset demo data' }).click();
    await page.getByRole('dialog', { name: 'Reset demo data?' }).getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(toast(page)).toContainText('Demo data reset');
    await go(page, 'queue');
    await expect(page.getByRole('button', { name: /^All 31$/ })).toBeVisible();
  });

});

test.describe('theme', () => {
  test('defaults to dark, switches and persists light, and System follows the OS', async ({ page }) => {
    await boot(page);
    await go(page, 'home');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const trigger = page.getByRole('button', { name: 'Theme: Dark' });
    await trigger.click();
    await page.getByRole('menuitemradio', { name: 'Light' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Theme: Light' })).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('coaching360-theme'))).toBe('light');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Theme: Light' }).click();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitemradio', { name: 'Dark' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Theme: Light' })).toBeFocused();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.getByRole('button', { name: 'Theme: Light' }).click();
    await page.getByRole('menuitemradio', { name: 'System' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Theme: System' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    expect(await page.evaluate(() => localStorage.getItem('coaching360-theme'))).toBeNull();
  });

  test('no flash: the saved theme is applied before the app script runs', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('coaching360-theme', 'light'));
    await page.route('**/assets/*.js', (route) => new Promise((r) => setTimeout(r, 300)).then(() => route.continue()));
    await page.goto('./', { waitUntil: 'commit' });
    await page.waitForSelector('#root', { state: 'attached' });
    // App bundle is still loading (root empty) but the theme is already applied
    expect(await page.evaluate(() => [document.documentElement.dataset.theme, document.querySelector('#root').children.length])).toEqual(['light', 0]);
  });
});

test.describe('sidebar', () => {
  test('collapses to icons, keeps the choice after reload, and expands again', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), 'the collapsible sidebar is desktop-only');
    await boot(page);
    await go(page, 'home');
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Call Grading' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByText('Call Grading')).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByText('Call Grading')).toBeVisible();
  });
});

test.describe('mobile navigation', () => {
  test('drawer opens, navigates, closes on Escape and returns focus', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), 'drawer is mobile-only');
    await boot(page);
    await go(page, 'home');
    const menu = page.getByRole('button', { name: 'Open navigation' });
    await menu.click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Call Library' }).click();
    await expect(page).toHaveURL(/#\/library$/);
    await expect(drawer).toBeHidden();
    await menu.click();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
    // Touch targets in the header are at least 36px
    for (const b of await page.locator('header button').all()) {
      const box = await b.boundingBox();
      if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(36);
    }
  });
});

test.describe('sign in', () => {
  let errors;
  test.beforeEach(async ({ page }) => { errors = trackErrors(page); await boot(page, { role: null }); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('rejects a wrong password, then signs a supervisor in and out', async ({ page }) => {
    await page.goto('#/home');
    await expect(page).toHaveURL(/#\/login$/);
    await page.getByRole('textbox', { name: 'Email' }).fill('steve@powerconnect.ai');
    await page.getByLabel(/^password$/i).fill('wrong');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
    await page.getByLabel(/^password$/i).fill('admin');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Steve' })).toBeVisible();
    await page.getByRole('button', { name: 'Profile: Steve' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/#\/login$/);
    await page.goto('#/queue');
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('returns to the deep link after signing in, and the agent account gets the agent workspace', async ({ page }) => {
    await page.goto('#/grading/a1?call=2857391');
    await signInAs(page, 'admin@gmail.com');
    await expect(page).toHaveURL(/#\/grading\/a1\?call=2857391$/);
    await signInAs(page, 'agent@gmail.com');
    await expect(page).toHaveURL(/#\/me$/);
    await expect(page.getByRole('button', { name: 'Profile: Camille Dubois' })).toBeVisible();
    await page.goto('#/grading');
    await expect(page).toHaveURL(/#\/me$/);
  });
});
