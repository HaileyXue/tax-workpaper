import { test, expect, type Page } from '@playwright/test';

async function wages(page: Page) {
  await page.getByText('All calculations & schedules', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Expand Total income (F1040.9)', exact: true })
    .click();
  // Wages are a simple two-source amount. Both W-2s appear without nested toggles.
  await expect(
    page.getByRole('button', { name: /Expand (Total wages|Wages)/ }),
  ).toHaveCount(0);
}

test('expands in place and shows contextual evidence without losing the calculation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(3);
  await expect(
    page.getByText('Record your review', { exact: true }),
  ).toHaveCount(0);
  await wages(page);
  const parent = page.getByRole('button', {
    name: 'Collapse Total income (F1040.9)',
    exact: true,
  });
  await page.getByRole('button', { name: /D08 · W-2 · p. 1/ }).click();
  const evidence = page.getByRole('complementary', { name: 'Source evidence' });
  await expect(evidence.locator('mark')).toHaveText('104,600.00');
  await expect(
    evidence.getByText('Page 1 · Field box1 · ev-0016'),
  ).toBeVisible();
  await expect(parent).toBeVisible();
  await parent.click();
  await page
    .getByRole('button', { name: 'Expand Total income (F1040.9)', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: /D08 · W-2 · p. 1/ }),
  ).toBeVisible();
  await expect(evidence.locator('mark')).toBeVisible();
  expect(errors).toEqual([]);
});

test('records exceptions only on request and persists correction proposals', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await page.getByText('All calculations & schedules', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Search return calculations' })
    .fill('SchB.1.2');
  await expect(
    page.getByRole('button', { name: /Expand Interest.*SchB.1.2/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /D29 · 1099-INT/ }),
  ).toBeVisible();
  await page
    .getByRole('region', { name: 'Search results' })
    .getByLabel('Actions for SchB.1.2')
    .click();
  await page
    .getByRole('button', { name: 'Propose correction', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Corrected value', { exact: false }).fill('0');
  await dialog
    .getByRole('combobox', { name: 'Tax-effect category' })
    .selectOption('interest');
  await dialog
    .getByLabel('Evidence and reason')
    .fill('Duplicate sweep confirmed using D28 and D29.');
  await expect(
    dialog.getByText('Estimated tax change', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Save proposal' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Search results' })
      .getByText(/Proposed value:/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign off return', exact: true }),
  ).toBeDisabled();
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
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await page.getByLabel('Viewing as').selectOption('st-05');
  await wages(page);
  await page.getByRole('button', { name: /D08 · W-2 · p. 1/ }).click();
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
  await expect(
    page.getByRole('button', { name: /D08 · W-2 · p. 1/ }),
  ).toBeFocused();
});

test('final sign-off persists and reopens when a note changes the review snapshot', async ({
  page,
}) => {
  // Resolve the supplied warnings through the UI; no fabricated verification records.
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await page.locator('.issues-section > summary').click();
  for (const finding of await page.locator('.finding').all()) {
    await finding.locator(':scope > summary').click();
    await finding
      .getByRole('textbox', { name: 'Resolution evidence' })
      .fill('Test-only documented disposition after source inspection.');
    await finding
      .getByRole('button', { name: 'Resolve issue', exact: true })
      .click();
    await finding.locator(':scope > summary').click();
  }
  await page.getByRole('checkbox').check();
  await page
    .getByRole('button', { name: 'Sign off return', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Signed off', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Signed off', exact: true }),
  ).toBeVisible();
  await wages(page);
  const leaf = page.locator('.return-group [data-line="F1040.1z"]');
  await leaf.getByLabel('Actions for F1040.1z').click();
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
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  const panel = page.getByRole('tabpanel');
  const agi = panel.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: /^Adjusted gross income/ }),
  });
  await expect(
    agi.getByRole('button', { name: 'Inspect Federal F1040.11' }),
  ).toContainText('$445,590');
  await expect(
    agi.getByRole('button', { name: 'Inspect California F540NR.17' }),
  ).toContainText('$481,096');
  const caSource = panel.getByRole('row').filter({
    has: page.getByRole('rowheader', {
      name: 'California-source AGI',
      exact: true,
    }),
  });
  await expect(caSource.getByRole('cell').first()).toHaveText('—');
  await agi.getByRole('button', { name: 'Inspect Federal F1040.11' }).click();
  await expect(panel.locator('.schedule-breakdown')).toBeVisible();
  await expect(agi).toBeVisible();
});

test('groups W-2 fields and attaches packet-linked warnings to affected interest rows', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await page
    .getByRole('tab', { name: 'Wages & interest', exact: true })
    .click();
  const panel = page.getByRole('tabpanel');
  const employer = panel
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: /Corvane Systems/ }) });
  await expect(
    employer.getByRole('button', { name: 'Inspect Wages ev-0016' }),
  ).toHaveText('$104,600');
  await expect(
    employer.getByRole('button', {
      name: 'Inspect Federal withholding ev-0017',
    }),
  ).toHaveText('$15,800');
  await employer
    .getByRole('button', { name: 'Inspect Federal withholding ev-0017' })
    .click();
  await expect(
    page
      .getByRole('complementary', { name: 'Source evidence' })
      .locator('mark'),
  ).toHaveText('15,800.00');
  await expect(employer).toBeVisible();
  await expect(panel.getByRole('button', { name: /D10/ })).toHaveCount(0);
  const bank = panel.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: /^Northlake Bank, N.A./ }),
  });
  await bank.locator('.inline-findings > summary').click();
  await expect(
    bank.getByText('Same bank sweep interest counted twice', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Dividends', exact: true }).click();
  await expect(
    page
      .getByRole('tabpanel')
      .getByRole('button', { name: 'Inspect Qualified dividends ev-0490' }),
  ).toBeVisible();
});

test('resizes source evidence by dragging and keyboard without losing context', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await expect(page).toHaveTitle('Tax workpaper');
  await expect(
    page.getByRole('link', { name: 'Tax workpaper', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('tab', { name: 'Wages & interest', exact: true })
    .click();
  await page.getByRole('button', { name: 'Inspect Wages ev-0016' }).click();
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
  await expect(panel.locator('mark')).toHaveText('104,600.00');
  await handle.focus();
  await page.keyboard.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '300');
  await page.keyboard.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '324');
  await expect(panel).toHaveCSS('width', '324px');
  await page.getByRole('button', { name: 'Close evidence' }).click();
  await page.getByRole('button', { name: 'Inspect Wages ev-0016' }).click();
  await expect(panel).toHaveCSS('width', '324px');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(handle).not.toBeVisible();
  await expect(panel).toHaveCSS('width', '390px');
});

test('highlights source amounts only and explains calculations using packet rules', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await expect(page.locator('.issues-section')).toHaveClass(/has-issues/);
  const agi = page.getByRole('button', {
    name: 'Inspect Federal F1040.11',
    exact: true,
  });
  await expect(agi).not.toHaveClass(/amount-issue/);
  await agi.click();
  await expect(
    page.locator('.schedule-breakdown .calculation-explanation').first(),
  ).toContainText('How this is calculated');
  await page
    .getByRole('tab', { name: 'Wages & interest', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Inspect Interest SchB.1.2',
      exact: true,
    }),
  ).not.toHaveClass(/amount-issue/);
  await expect(
    page.getByRole('button', { name: 'Inspect Wages ev-0016', exact: true }),
  ).not.toHaveClass(/amount-issue/);
});

test('lands on the supplied case and keeps issue counts consistent after resolution', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Cases', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.case-card')).toHaveCount(1);
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '9 issues to resolve',
  );
  await expect(
    page.getByRole('button', { name: 'Return', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await expect(page.getByRole('button', { name: /open items/i })).toHaveCount(
    0,
  );
  await expect(page.locator('.issues-section > summary')).toContainText(
    '9 issues to resolve',
  );
  await page.locator('.issues-section > summary').click();
  const finding = page
    .locator('.findings > .finding')
    .filter({ hasText: 'Same bank sweep interest counted twice' });
  await finding.locator(':scope > summary').click();
  await finding
    .getByRole('textbox', { name: 'Resolution evidence' })
    .fill('Test-only disposition for count synchronization.');
  await finding
    .getByRole('button', { name: 'Resolve issue', exact: true })
    .click();
  await expect(page.locator('.issues-section > summary')).toContainText(
    '8 issues to resolve',
  );
  await page.getByRole('button', { name: 'All cases', exact: true }).click();
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '8 issues to resolve',
  );
  await page.reload();
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '8 issues to resolve',
  );
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Return version' })
    .selectOption('v1');
  await page.getByRole('link', { name: 'Tax workpaper', exact: true }).click();
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '8 issues to resolve',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: 'Open case', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('issue links jump to the source schedule or a referenced record below', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await page.locator('.issues-section > summary').click();
  const sweep = page
    .locator('.findings > .finding')
    .filter({ hasText: 'Same bank sweep interest counted twice' });
  await sweep
    .getByRole('button', {
      name: 'Same bank sweep interest counted twice',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('tab', { name: 'Wages & interest', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  const amount = page.getByRole('button', {
    name: 'Inspect Interest SchB.1.1',
    exact: true,
  });
  await expect(amount).toBeFocused();
  await expect(amount).not.toHaveClass(/amount-issue/);
  await expect(
    page.locator('.schedule-breakdown .source-value .amount-issue'),
  ).toHaveText('! $1,840');
  const crypto = page
    .locator('.findings > .finding')
    .filter({ hasText: 'digital asset basis missing' });
  await crypto.locator(':scope > summary').click();
  const location = page.getByRole('region', { name: 'Issue location' });
  await expect(location).toBeFocused();
  await expect(
    location.locator('.issue-source-number .amount-issue'),
  ).toBeVisible();
  const questionnaire = page
    .locator('.findings > .finding')
    .filter({ hasText: 'questionnaire sales conflict' });
  await questionnaire.locator(':scope > summary').click();
  await expect(location).toContainText(
    'This issue points to a record rather than a calculated number.',
  );
  await expect(location.locator('.amount-issue')).toHaveCount(0);
});
