import { test, expect, type Page } from '@playwright/test';
// Workflow tests must not wait on the external font service. Browser fallback fonts are sufficient.
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.abort(),
  );
});
async function openCase(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
}
async function income(page: Page) {
  await page
    .getByRole('button', { name: 'Inspect Federal Total income', exact: true })
    .click();
}
async function issue(page: Page, id: string) {
  const banner = page.locator('.issues-section');
  if (!((await banner.getAttribute('open')) !== null))
    await banner.locator(':scope > summary').click();
  await page.locator(`[data-finding-id="${id}"]`).click();
}

test('one summary traces income to evidence without a separate explorer or schedule tabs', async ({
  page,
}) => {
  await openCase(page);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(
    page.getByText('All calculations & schedules', { exact: true }),
  ).toHaveCount(0);
  await income(page);
  const parent = page.getByRole('button', {
    name: 'Collapse Total income',
    exact: true,
  });
  await page
    .getByRole('button', { name: /Corvane Systems.*W-2 · p. 1/ })
    .click();
  const evidence = page.getByRole('complementary', { name: 'Source evidence' });
  await expect(evidence.locator('mark')).toHaveText('104,600.00');
  await expect(parent).toBeVisible();
  await expect(page.locator('.schedule-breakdown')).toBeVisible();
  await expect(page.getByRole('button', { name: /W-2 · p. 1/ })).toHaveCount(2);
  await expect(
    page.getByText(/Supplied calculation · Inputs below/),
  ).toHaveCount(0);
  await expect(evidence.getByText('Document reference: D08')).not.toBeVisible();
  await evidence.getByText('Source details', { exact: true }).click();
  await expect(evidence.getByText('Document reference: D08')).toBeVisible();
});

test('records a correction proposal and persists it independently of engine totals', async ({
  page,
}) => {
  await openCase(page);
  await page
    .getByRole('textbox', { name: 'Search return calculations' })
    .fill('SchB.1.2');
  const result = page.getByRole('region', { name: 'Search results' });
  await result.locator('[data-line="SchB.1.2"] .action-menu > summary').click();
  await result
    .getByRole('button', { name: 'Propose correction', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Corrected value', { exact: false }).fill('0');
  await dialog.getByLabel('Tax-effect category').selectOption('interest');
  await dialog
    .getByLabel('Evidence and reason')
    .fill('Duplicate sweep confirmed using D28 and D29.');
  await dialog.getByRole('button', { name: 'Save proposal' }).click();
  await expect(result.getByText(/Proposed value:/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign off return', exact: true }),
  ).toBeDisabled();
  await page.locator('.issues-section > summary').click();
  await page
    .locator('.finding-link')
    .filter({ hasText: 'Correction proposal:' })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Review proposal in History',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Resolve issue', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(
    page.getByText('Duplicate sweep confirmed using D28 and D29.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.getByText('undo · SchB.1.2', { exact: true }),
  ).toBeVisible();
});

test('supports mobile evidence inspection and read-only roles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCase(page);
  await page.getByLabel('Viewing as').selectOption('st-05');
  await income(page);
  const link = page.getByRole('button', {
    name: /Corvane Systems.*W-2 · p. 1/,
  });
  await link.click();
  await expect(
    page.getByRole('complementary', { name: 'Source evidence' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Flag issue', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Close evidence' }).click();
  await expect(link).toBeFocused();
});

test('final sign-off persists and reopens when a note changes the review snapshot', async ({
  page,
}) => {
  await openCase(page);
  await page.locator('.issues-section > summary').click();
  const ids = await page
    .locator('.finding-link[data-severity="warning"]')
    .evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.findingId!),
    );
  for (const id of ids) {
    await issue(page, id);
    const context = page.locator('.issue-context');
    const review = context.locator('.contextual-review');
    if ((await review.getAttribute('open')) === null)
      await review.locator(':scope > summary').click();
    await context
      .getByLabel('Resolution evidence')
      .fill('Test-only documented disposition after source inspection.');
    await context
      .getByRole('button', { name: 'Resolve issue', exact: true })
      .click();
  }
  await page.getByRole('checkbox').check();
  await page
    .getByRole('button', { name: 'Sign off return', exact: true })
    .click();
  await page.reload();
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Signed off', exact: true }),
  ).toBeVisible();
  await income(page);
  const leaf = page.locator('.schedule-breakdown [data-line="F1040.1z"]');
  await leaf.locator('.action-menu > summary').click();
  await leaf.getByRole('button', { name: 'Add note', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Evidence and reason')
    .fill('Additional source context recorded after approval.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(
    page.getByText('Review reopened: records changed after sign-off.'),
  ).toBeVisible();
});

test('compares packet summary figures without filling unmapped cells', async ({
  page,
}) => {
  await openCase(page);
  await expect(
    page.getByRole('button', { name: 'Inspect Federal Adjusted gross income' }),
  ).toContainText('$445,590');
  await expect(
    page.getByRole('button', {
      name: 'Inspect California Total AGI using California law',
    }),
  ).toContainText('$481,096');
  const row = page.getByRole('row').filter({
    has: page.getByRole('rowheader', {
      name: 'California-source AGI',
      exact: true,
    }),
  });
  await expect(row.getByRole('cell').first()).toHaveText('—');
  await page
    .getByRole('button', { name: 'Inspect Federal Adjusted gross income' })
    .click();
  await expect(
    page.locator('.schedule-breakdown .calculation-explanation').first(),
  ).toContainText('How this is calculated');
});

test('resizes evidence with pointer and keyboard and keeps mobile full width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openCase(page);
  await income(page);
  await page
    .getByRole('button', { name: /Corvane Systems.*W-2 · p. 1/ })
    .click();
  const panel = page.getByRole('complementary', { name: 'Source evidence' });
  const handle = page.getByRole('separator', {
    name: 'Resize source evidence',
  });
  const start = (await panel.boundingBox())!;
  const grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, 200);
  await page.mouse.down();
  await page.mouse.move(grip.x - 120, 200, { steps: 10 });
  await page.mouse.up();
  expect((await panel.boundingBox())!.width).toBeGreaterThan(start.width + 100);
  await handle.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowLeft');
  await expect(panel).toHaveCSS('width', '324px');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(handle).not.toBeVisible();
  await expect(panel).toHaveCSS('width', '390px');
});

test('issue banner contains links only, opens the summary chain and scrolls to its source', async ({
  page,
}) => {
  await openCase(page);
  await expect(
    page.getByRole('button', { name: 'Inspect Federal Adjusted gross income' }),
  ).toHaveClass(/amount-issue-upstream/);
  await issue(page, 'duplicate-sweep');
  await expect(
    page.locator(
      '.issues-section textarea, .issues-section .calculation, .issues-section details',
    ),
  ).toHaveCount(0);
  const source = page.locator('.schedule-breakdown [data-reference="ev-0492"]');
  await expect(source).toBeFocused();
  await expect(source).toBeInViewport();
  await expect(source.locator('.amount-issue')).toContainText('1,840');
  await expect(
    page.locator(
      '.schedule-breakdown [data-line="F1040.9"] > .calculation-heading .amount-issue',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      '.schedule-breakdown [data-line="F1040.2b"] > .calculation-heading .amount-issue',
    ),
  ).toBeVisible();
  await expect(page.locator('.issues-section .finding-content')).toHaveCount(0);
  await page.locator('.issue-references button').nth(1).click();
  await expect(
    page.locator('.schedule-breakdown [data-reference="ev-0538"]'),
  ).toBeFocused();
  await expect(
    page.locator('.schedule-breakdown [data-reference="ev-0538"]'),
  ).toBeInViewport();
});

test('handles deep sources and nonnumeric issues without inventing a numeric link', async ({
  page,
}) => {
  await openCase(page);
  await issue(page, 'DIGITAL_ASSET_BASIS_MISSING');
  await expect(
    page.locator('.schedule-breakdown [data-reference="ev-0879"]'),
  ).toBeFocused();
  await page.locator('.issue-references button').last().click();
  await expect(
    page.locator('.schedule-breakdown [data-reference="ev-0919"]'),
  ).toBeFocused();
  await expect(
    page.locator('.schedule-breakdown [data-reference="ev-0919"]'),
  ).toBeInViewport();
  await issue(page, 'QUESTIONNAIRE_SALES_CONFLICT');
  const record = page.locator('.standalone-record');
  await expect(record).toBeFocused();
  await expect(record).toContainText(
    'This issue concerns a record rather than a calculated number.',
  );
  await expect(record.locator('.amount-issue')).toHaveCount(0);
});

test('case count follows resolutions and reload returns to cases', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.case-card')).toHaveCount(1);
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '9 issues to resolve',
  );
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await issue(page, 'duplicate-sweep');
  await page.locator('.contextual-review > summary').click();
  await page.getByLabel('Resolution evidence').fill('Test-only disposition.');
  await page
    .getByRole('button', { name: 'Resolve issue', exact: true })
    .click();
  await page.getByRole('button', { name: 'All cases', exact: true }).click();
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '8 issues to resolve',
  );
  await page.reload();
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '8 issues to resolve',
  );
});
