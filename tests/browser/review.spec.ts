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
  await page.getByRole('button', { name: /^Issues/ }).click();
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
  await page
    .getByRole('button', { name: 'Inspect input Total wages', exact: true })
    .click();
  const parent = page.getByRole('button', {
    name: 'Total income',
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
  await expect(evidence.getByRole('heading', { name: /^D08/ })).toBeVisible();
  await expect(
    evidence.getByText('Source details', { exact: true }),
  ).toHaveCount(0);
});

test('shows the canonical issue UI only when manual review reaches its calculation level', async ({
  page,
}) => {
  await openCase(page);
  await income(page);
  await expect(page.locator('.issue-context')).toHaveCount(0);
  await page
    .getByRole('button', {
      name: 'Inspect input Capital gain or (loss)',
      exact: true,
    })
    .click();
  await expect(page.locator('.issue-context')).toHaveCount(0);
  await page
    .getByRole('button', {
      name: 'Inspect input Net short-term gain or (loss)',
      exact: true,
    })
    .click();
  await expect(page.locator('.issue-context')).toHaveCount(0);
  await page
    .getByRole('button', {
      name: 'Inspect input Short-term from Form 8949 box B',
      exact: true,
    })
    .click();
  const context = page.locator('.issue-context');
  await expect(context).toContainText('Lot N1 cost basis was treated as zero');
  await expect(context).toContainText('Cross-document comparison');
  await expect(context).toContainText('Review point');
  await expect(context).toContainText('Box B totals');
  await expect(context.locator('.contextual-review')).toBeVisible();
});

test('records a correction proposal and persists it independently of engine totals', async ({
  page,
}) => {
  await openCase(page);
  await issue(page, 'duplicate-sweep');
  const result = page.locator('.schedule-breakdown');
  await result.locator('[data-line="SchB.2"] .action-menu > summary').click();
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
  await page.getByRole('button', { name: /^Issues/ }).click();
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
    page.locator('.review-event').filter({ hasText: 'Undid action' }),
  ).toBeVisible();
});

test('supports mobile evidence inspection and read-only roles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCase(page);
  await page.getByLabel('Viewing as').selectOption('st-05');
  await income(page);
  await page
    .getByRole('button', { name: 'Inspect input Total wages', exact: true })
    .click();
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

test('shows assignment beside correction and enforces assignment authority', async ({
  page,
}) => {
  await openCase(page);
  await page.getByLabel('Viewing as').selectOption('st-01');
  await issue(page, 'missing-zero-ev-0498');
  const context = page.locator('.issue-context');
  await context.locator('.contextual-review > summary').click();
  const assignment = context.getByLabel('Assign issue to');
  await expect(assignment).toBeDisabled();
  await expect(context).toContainText(
    'Reviewer or partner permission is required to assign work.',
  );
  await page.getByLabel('Viewing as').selectOption('st-02');
  await expect(assignment).toBeEnabled();
  await assignment.selectOption({ label: 'Priya Raman' });
  await page.getByRole('button', { name: /^Issues/ }).click();
  const issueRow = page
    .locator('.finding-list-item')
    .filter({ hasText: 'Lot N1 cost basis was treated as zero' });
  await expect(issueRow.locator('.finding-history')).toContainText(
    'Assigned to Priya Raman',
  );
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const thread = page
    .locator('.issue-history-thread')
    .filter({ hasText: 'Lot N1 cost basis was treated as zero' });
  await expect(thread).toContainText('Assigned to Priya Raman');
});

test('saves a supplied correction, enforces role approval, and preserves its audit trail', async ({
  page,
}) => {
  await openCase(page);
  await page.getByLabel('Viewing as').selectOption('st-01');
  await issue(page, 'missing-zero-ev-0498');
  const context = page.locator('.issue-context');
  await expect(context).toContainText('Cross-document comparison');
  await expect(context).toContainText(
    'A second supplied statement reports an adjusted basis of $19,100',
  );
  await context.locator('.contextual-review > summary').click();
  await context
    .getByRole('button', { name: 'Propose correction', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByLabel('Corrected value', { exact: false }),
  ).toHaveValue('19100');
  await expect(dialog.locator('.correction-preview')).toContainText(
    '$19,240 → $140 proposed gain',
  );
  await dialog
    .getByLabel('Evidence and reason')
    .fill('Matched D28 lot N1 to D11 using the supplied acquisition date.');
  await dialog.getByRole('button', { name: 'Save proposal' }).click();
  await expect(context.getByLabel('Correction review')).toContainText(
    'Submitted',
  );
  await expect(
    context.getByRole('button', { name: 'Approve correction' }),
  ).toBeDisabled();
  await expect(context).toContainText('Reviewer or partner approval required.');

  await page.reload();
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await page.getByLabel('Viewing as').selectOption('st-02');
  await issue(page, 'missing-zero-ev-0498');
  await page.locator('.issue-context .contextual-review > summary').click();
  const persisted = page.getByLabel('Correction review');
  await expect(persisted).toContainText(
    'Matched D28 lot N1 to D11 using the supplied acquisition date.',
  );
  await persisted
    .getByLabel('Reviewer decision')
    .fill('Agreed the acquisition date and adjusted basis to D11.');
  await persisted.getByRole('button', { name: 'Approve correction' }).click();
  await expect(persisted).toContainText('Approved');
  await expect(context.locator('.approval-complete')).toContainText(
    'this issue is complete for review',
  );
  await expect(page.getByLabel('11 issues to resolve')).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(
    page.getByText('Agreed the acquisition date and adjusted basis to D11.', {
      exact: true,
    }),
  ).toBeVisible();
  const approvedThread = page
    .locator('.issue-history-thread')
    .filter({ hasText: 'Lot N1 cost basis' });
  await expect(approvedThread).toContainText('Approved correction');
  await expect(approvedThread).toContainText('Approved');
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
    .getByRole('button', { name: 'Inspect input Total wages', exact: true })
    .click();
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

test('issue tab contains links only, opens the return chain and scrolls to its source', async ({
  page,
}) => {
  await openCase(page);
  await expect(
    page.getByRole('button', { name: 'Inspect Federal Adjusted gross income' }),
  ).toHaveClass(/amount-issue-upstream/);
  await page.getByRole('button', { name: /^Issues/ }).click();
  await expect(
    page.locator(
      '.issues-list-panel textarea, .issues-list-panel .calculation, .issues-list-panel details',
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Issues to resolve' }),
  ).toBeVisible();
  const issueRow = page.locator('[data-finding-id="duplicate-sweep"]');
  await expect(issueRow).toContainText('Go to issue');
  await expect(issueRow.locator('.finding-arrow')).toBeVisible();
  await issueRow.click();
  await expect(
    page.getByRole('button', { name: 'Return', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  const reviewLevel = page.locator(
    '.schedule-breakdown [data-aliases~="SchB.2"]',
  );
  await expect(reviewLevel).toBeFocused();
  await expect(reviewLevel).toBeInViewport();
  await expect(page.locator('.issue-context')).toContainText(
    'Same bank sweep interest counted twice',
  );
  await expect(
    page
      .getByRole('navigation', { name: 'Review path' })
      .getByRole('button', { name: 'Taxable interest', exact: true }),
  ).toHaveCount(1);
  await expect(
    page.locator('.calculation-trail .amount-issue').first(),
  ).toBeVisible();
  await expect(
    page.locator('.schedule-breakdown .calculation .calculation'),
  ).toHaveCount(0);
  await expect(page.locator('.issues-list-panel .finding-content')).toHaveCount(
    0,
  );
  await page.locator('.issue-references button').nth(1).click();
  const evidence = page.getByRole('complementary', { name: 'Source evidence' });
  await expect(evidence.getByRole('heading', { name: /^D29/ })).toBeVisible();
  await expect(evidence.locator('mark')).toContainText('1,840');
});

test('handles deep sources and nonnumeric issues without inventing a numeric link', async ({
  page,
}) => {
  await openCase(page);
  await issue(page, 'DIGITAL_ASSET_BASIS_MISSING');
  await expect(page.locator('.issue-context')).toContainText(
    'digital asset basis missing',
  );
  await page.locator('.issue-references button').first().click();
  const evidence = page.getByRole('complementary', { name: 'Source evidence' });
  await expect(evidence.getByRole('heading', { name: /^D34/ })).toBeVisible();
  await page.locator('.issue-references button').last().click();
  await expect(evidence.getByRole('heading', { name: /^D35/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close evidence' }).click();
  await issue(page, 'QUESTIONNAIRE_SALES_CONFLICT');
  const record = page.locator('.standalone-record');
  await expect(record).toBeFocused();
  await expect(record).toContainText(
    'This issue concerns a record rather than a calculated number.',
  );
  await expect(record.locator('.amount-issue')).toHaveCount(0);
  await page.locator('.contextual-review > summary').click();
  await page.getByRole('button', { name: 'Propose correction' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText('This issue does not point to one editable number.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel('Corrected value', { exact: false }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
});

test('case count follows approvals and reload returns to cases', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.case-card')).toHaveCount(1);
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '12 issues to resolve',
  );
  await page.getByRole('button', { name: 'Open case', exact: true }).click();
  await issue(page, 'duplicate-sweep');
  await page.locator('.contextual-review > summary').click();
  await page.getByRole('button', { name: 'Propose correction' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Corrected value', { exact: false }).fill('0');
  await dialog.getByLabel('Tax-effect category').selectOption('interest');
  await dialog
    .getByLabel('Evidence and reason')
    .fill('Confirmed both records describe the same sweep interest.');
  await dialog.getByRole('button', { name: 'Save proposal' }).click();
  await page
    .getByLabel('Reviewer decision')
    .fill('Confirmed the duplicate using both supplied documents.');
  await page.getByRole('button', { name: 'Approve correction' }).click();
  await page.getByRole('button', { name: 'All cases', exact: true }).click();
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '11 issues to resolve',
  );
  await page.reload();
  await expect(page.locator('.case-issue-badge')).toHaveText(
    '11 issues to resolve',
  );
});

test('focused statements navigate back without nesting and expose related records', async ({
  page,
}) => {
  await openCase(page);
  await income(page);
  await page
    .getByRole('button', { name: 'Inspect input Total wages', exact: true })
    .click();
  await expect(
    page.locator('.schedule-breakdown [data-line="F1040.1z"]'),
  ).toBeVisible();
  await expect(
    page.locator('.schedule-breakdown .calculation .calculation'),
  ).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Review path' })
    .getByRole('button', { name: 'Total income', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Inspect input Total wages',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Inspect input Taxable amount', exact: true })
    .click();
  const related = page.getByRole('region', {
    name: 'Related records',
    exact: true,
  });
  await related.getByRole('button', { name: /Basis carried to 2026/ }).click();
  await expect(
    page.locator('.schedule-breakdown [data-line="F8606.14"]'),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Review path' }),
  ).toContainText('Taxable amount');
});

test('documents show identity, selected row, page controls and all extracted fields', async ({
  page,
}) => {
  await openCase(page);
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  const first = page
    .locator('.document-row')
    .filter({ has: page.getByText('D01', { exact: true }) });
  await first.click();
  await expect(first).toHaveAttribute('aria-current', 'true');
  const panel = page.getByRole('complementary', { name: 'Source evidence' });
  await expect(panel.getByRole('heading', { name: /^D01/ })).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'Previous page' }),
  ).toBeDisabled();
  await panel.getByRole('button', { name: 'Next page' }).click();
  await expect(panel.getByRole('combobox', { name: 'Page' })).toHaveValue('2');
  await expect(panel.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await panel.getByRole('button', { name: 'Previous page' }).click();
  await expect(panel.getByRole('combobox', { name: 'Page' })).toHaveValue('1');
  await panel.getByRole('combobox', { name: 'Page' }).selectOption('2');
  await expect(panel.locator('.paper-footer')).toContainText('PAGE 2');
  await panel.getByText(/^Extracted fields \(/).click();
  await panel.getByRole('combobox', { name: 'Page' }).selectOption('1');
  await expect(panel.locator('.field-row')).toHaveCount(3);
  const pageTwoField = panel
    .locator('.field-row')
    .filter({ hasText: 'Page 2 ·' })
    .first();
  await pageTwoField.click();
  await expect(panel.getByRole('combobox', { name: 'Page' })).toHaveValue('2');
  await expect(first).toHaveAttribute('aria-current', 'true');
  const second = page
    .locator('.document-row')
    .filter({ has: page.getByText('D02', { exact: true }) });
  await second.click();
  await expect(second).toHaveAttribute('aria-current', 'true');
  await expect(first).not.toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Close evidence' }).click();
  await expect(second).not.toHaveAttribute('aria-current', 'true');
});

test('return inspection and action labels hide internal calculation references', async ({
  page,
}) => {
  await openCase(page);
  await expect(
    page.getByRole('textbox', { name: 'Search return calculations' }),
  ).toHaveCount(0);
  await income(page);
  await page
    .getByRole('button', { name: 'Inspect input Total wages', exact: true })
    .click();
  const statement = page.locator('.schedule-breakdown');
  await statement.locator('.action-menu > summary').click();
  await expect(statement).not.toContainText('F1040.1z');
  await expect(statement).not.toContainText('R-SUM');
  await statement
    .getByRole('button', { name: 'Add note', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Total wages');
  await expect(page.getByRole('dialog')).not.toContainText('F1040.1z');
});

test('document filters combine ownership, uploader and search; source page shows supplied metadata', async ({
  page,
}) => {
  await openCase(page);
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Belongs to', exact: true })
    .selectOption('taxpayer');
  await page
    .getByRole('combobox', { name: 'Uploaded by', exact: true })
    .selectOption('client');
  await page.getByRole('textbox', { name: 'Search documents' }).fill('D08');
  await expect(page.locator('.document-row')).toHaveCount(1);
  await page.locator('.document-row').click();
  const panel = page.getByRole('complementary', { name: 'Source evidence' });
  await expect(panel.getByText('EVIDENCE FOR', { exact: true })).toHaveCount(0);
  await expect(panel.locator('.paper-heading')).toHaveText(
    '2025 Form W-2 - Corvane Systems, Inc. (Ngozi Okafor)',
  );
  const metadata = panel.locator('.document-metadata');
  await expect(metadata).toContainText('Corvane Systems, Inc.');
  await expect(metadata).toContainText('Ngozi Okafor');
  await expect(metadata).toContainText('2025');
  await expect(metadata.locator('time')).toHaveAttribute(
    'datetime',
    '2026-01-29T18:40:00Z',
  );
  await expect(metadata).toContainText('Client');
  await page
    .getByRole('combobox', { name: 'Uploaded by', exact: true })
    .selectOption('firm');
  await expect(page.locator('.document-row')).toHaveCount(0);
  await expect(
    page.getByText('No documents match these filters.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.document-row')).toHaveCount(74);
  await page
    .getByRole('combobox', { name: 'Belongs to', exact: true })
    .selectOption('dependent:ada');
  await expect(page.locator('.document-row').first()).toBeVisible();
  await page.locator('.document-row').first().click();
  await expect(panel.locator('.document-metadata')).toContainText(
    'Ada Lindqvist-Okafor',
  );
});

test('return snapshot changes document use and superseded labels', async ({
  page,
}) => {
  await openCase(page);
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search documents' }).fill('D30');
  await expect(page.locator('.document-row')).toContainText('Superseded');
  await page
    .getByRole('combobox', { name: 'Return version' })
    .selectOption('v1');
  await expect(page.locator('.document-row')).not.toContainText('Superseded');
  await expect(page.locator('.document-row')).not.toContainText(
    'Not used in this snapshot',
  );
});

test('limits the case timeline to events through the current return snapshot', async ({
  page,
}) => {
  await openCase(page);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Review history' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Return versions' }).click();
  await expect(page.locator('.version-cards article')).toHaveCount(3);
  await page.getByRole('button', { name: 'Case timeline' }).click();
  await expect(page.getByText(/17 events supplied through/)).toBeVisible();
  await expect(page.locator('.history-row')).toHaveCount(17);
  await expect(page.getByText('efile rejected')).toHaveCount(0);
  await expect(page.getByText(/scenario replay/i)).toHaveCount(0);
});
