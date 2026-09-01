import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const OUT = '.impeccable/review';
mkdirSync(OUT, { recursive: true });

// 生成 4 页样例 PDF(合成演示数据)
async function makeSamplePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 4; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Sample Document`, { x: 64, y: 760, size: 22, font, color: rgb(0.12, 0.16, 0.22) });
    page.drawText(`Page ${i} of 4`, { x: 64, y: 732, size: 12, font, color: rgb(0.3, 0.36, 0.45) });
    for (let line = 0; line < 18; line++) {
      page.drawText(
        `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ${line + 1}.`,
        { x: 64, y: 690 - line * 22, size: 10.5, font, color: rgb(0.25, 0.3, 0.38) },
      );
    }
  }
  return Buffer.from(await doc.save()).toString('base64');
}

const pdfB64 = await makeSamplePdf();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript((b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  window.electronAPI = {
    openPdfDialog: async () => [{ path: '/sample/demo-document.pdf', name: 'demo-document.pdf' }],
    readPdf: async () => bytes.buffer.slice(0),
    openExternal: async () => {},
  };
}, pdfB64);

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// 0. 空态(图纸签注块 + 引线标注)
await page.screenshot({ path: `${OUT}/desktop-empty.png` });

await page.getByRole('button', { name: '打开' }).click();
await page.locator('.reader-page-wrap').first().waitFor({ timeout: 20000 });
await page.waitForTimeout(2500); // 等首屏 canvas 渲染完成

// 1. 阅读模式(已载入文档,首屏)
await page.screenshot({ path: `${OUT}/desktop-read.png` });

// 2. 设置对话框(阅读模式可见)
await page.getByRole('button', { name: '设置' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/desktop-settings.png` });
await page.mouse.click(80, 500);
await page.waitForTimeout(300);

// 3. 页面编辑模式(缩略图网格 + 选中两页的修订标记)
await page.getByRole('button', { name: '页面编辑' }).click();
await page.locator('.page-card').first().waitFor({ timeout: 20000 });
await page.waitForTimeout(2500);
const cards = page.locator('.page-card');
if ((await cards.count()) >= 2) {
  await cards.nth(0).click();
  await page.keyboard.down('Control');
  await cards.nth(1).click();
  await page.keyboard.up('Control');
}
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/desktop-pages.png` });

// 4. 内容编辑模式
await page.getByRole('button', { name: '内容编辑' }).click();
await page.locator('.reader-page-wrap').first().waitFor({ timeout: 20000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/desktop-content.png` });

// 5. 1280 宽度检查(阅读模式首屏)
await page.getByRole('button', { name: '阅读' }).click();
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/desktop-1280.png` });

const dom = await page.evaluate(() => ({
  docs: document.querySelectorAll('.doc-item').length,
  readerPages: document.querySelectorAll('.reader-page-wrap').length,
}));
console.log('captured', JSON.stringify(dom));
await browser.close();
