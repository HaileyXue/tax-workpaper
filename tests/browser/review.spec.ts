import { test, expect } from '@playwright/test';

test('traces wages, verifies the printed field, and persists a review across reloads', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Trace wages to the W-2s' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('$212,400', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'ev-0016', exact: true }).click();
  await expect(dialog.locator('mark')).toHaveText('104,600.00');
  await expect(dialog.getByText('Page 1 · Field box1 · ev-0016')).toBeVisible();
  await dialog
    .getByLabel('Evidence and reason')
    .fill('Agreed to D08 page 1 box 1 printed wages.');
  await dialog.getByRole('button', { name: 'Save review record' }).click();
  await expect(
    dialog.getByText('Agreed to D08 page 1 box 1 printed wages.'),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'Changes & filing', exact: true })
    .click();
  await expect(
    page.getByText('Agreed to D08 page 1 box 1 printed wages.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('records a correction estimate, resolves the finding, and undoes the resolution', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Review queue', exact: false })
    .first()
    .click();
  const finding = page
    .locator('.finding')
    .filter({ hasText: 'Same bank sweep interest counted twice' });
  await finding.getByRole('button', { name: 'ev-0538', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: 'SchB.1.2', exact: true })
    .first()
    .click();
  await dialog
    .getByRole('combobox', { name: 'Action', exact: true })
    .selectOption('adjust');
  await dialog.getByLabel('Corrected value', { exact: false }).fill('0');
  await dialog.getByLabel('Tax-effect category').selectOption('interest');
  await dialog
    .getByLabel('Evidence and reason')
    .fill('Duplicate Northlake sweep confirmed against D28 and D29.');
  await expect(
    dialog.getByText('Estimated tax change', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Save review record' }).click();
  await dialog.getByRole('button', { name: 'Close explorer' }).click();
  await finding
    .getByRole('textbox')
    .fill(
      'Compared both statements; correction proposed for reviewer approval.',
    );
  await finding.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(finding.getByText('Resolved', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Changes & filing', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Undo resolve duplicate-sweep' })
    .click();
  await page
    .getByRole('button', { name: 'Review queue', exact: false })
    .first()
    .click();
  await expect(
    finding.getByText('Needs review', { exact: true }),
  ).toBeVisible();
});

test('supports narrow screens and read-only staff roles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel('Viewing as').selectOption('st-05');
  await page.getByRole('button', { name: 'Trace wages to the W-2s' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('button', { name: 'Save review record' }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Trace wages to the W-2s' }),
  ).toBeFocused();
});
