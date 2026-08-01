import { test, expect } from '@playwright/test';

test('app loads with empty state', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.toolbar')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.page-grid.empty')).toBeVisible();
  await expect(page.locator('.inspector-panel')).toBeVisible();
  await expect(page.locator('.status-bar')).toContainText('共 0 页');
});

test('toolbar shows open and export buttons', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.toolbar button')).toContainText(['打开', '另存为']);
});

test('toolbar undo/redo disabled when no history', async ({ page }) => {
  await page.goto('/');
  const buttons = page.locator('.toolbar button');
  // 最后两个按钮是撤销/重做,初始应禁用
  await expect(buttons.nth(-1)).toBeDisabled();
  await expect(buttons.nth(-2)).toBeDisabled();
});
