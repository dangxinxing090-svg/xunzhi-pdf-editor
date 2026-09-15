import { chromium } from '@playwright/test';
const PORT = process.env.PROBE_PORT || '5199';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// 打开设置 → 开源许可
await page.getByRole('button', { name: '设置' }).click();
await page.waitForTimeout(300);
const entry = await page.locator('.settings-row-btn').textContent();
await page.locator('.settings-row-btn').click();
await page.waitForTimeout(400);

const info = await page.evaluate(() => {
  const pre = document.querySelector('.license-text');
  const t = pre?.textContent ?? '';
  const cs = pre ? getComputedStyle(pre) : null;
  return {
    panelOpen: !!document.querySelector('.license-panel'),
    textChars: t.length,
    hasMit: t.includes('Permission is hereby granted'),
    hasApache: t.includes('Apache License'),
    hasOfl: t.includes('SIL OPEN FONT LICENSE Version 1.1'),
    hasFontCopyright: t.includes('Adobe'),
    scrollable: pre ? pre.scrollHeight > pre.clientHeight : false,
    fontFamily: cs?.fontFamily?.split(',')[0],
    fontSize: cs?.fontSize,
  };
});
await page.screenshot({ path: '.impeccable/review/desktop-licenses.png' });

// Esc 返回设置,Esc 再关闭
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
const backToSettings = await page.locator('.settings-title').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
const fullyClosed = (await page.locator('.settings-overlay').count()) === 0;

console.log(JSON.stringify({ entry, ...info, backToSettings: backToSettings === 1, escClosedAll: fullyClosed }, null, 1));
await browser.close();
