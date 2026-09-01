import { chromium } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
async function makeSamplePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 4; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Sample Document`, { x: 64, y: 760, size: 22, font, color: rgb(0.12, 0.16, 0.22) });
    for (let line = 0; line < 18; line++) {
      page.drawText(`Lorem ipsum dolor sit amet line ${line + 1}.`, { x: 64, y: 690 - line * 22, size: 10.5, font, color: rgb(0.25, 0.3, 0.38) });
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
await page.getByRole('button', { name: '打开' }).click();
await page.locator('.reader-page-wrap').first().waitFor({ timeout: 20000 });
await page.waitForTimeout(2000);
const probe = await page.evaluate(() => {
  const sb = document.querySelector('.status-bar');
  const labels = [...document.querySelectorAll('.status-label')].map((e) => e.textContent);
  const rulerNums = document.querySelectorAll('.ruler-num').length;
  const svgBtns = [...document.querySelectorAll('.toolbar button svg')].length;
  const notes = document.querySelectorAll('.empty-note').length;
  const radius = getComputedStyle(document.documentElement).getPropertyValue('--radius-3').trim();
  const pressMode = (() => {
    const btn = document.querySelector('.mode-switcher button:not(.active)');
    return btn ? getComputedStyle(btn).transitionDuration : 'n/a';
  })();
  return {
    statusCells: sb ? sb.querySelectorAll('.status-cell').length : 0,
    statusLabels: labels,
    statusText: sb?.textContent,
    rulerNums, svgBtns, notes, radius3: radius,
  };
});
console.log(JSON.stringify(probe, null, 1));
await browser.close();
