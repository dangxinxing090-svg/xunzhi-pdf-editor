import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { loadPdfFromBuffer, extractPageMeta, buildExportPdf, buildDocFromPages } from '../../src/worker/pdfEngine';
import type { PageSpec } from '../../src/worker/protocol';

async function makeTestPdf(pageCount: number): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([595, 842]); // A4
    page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 24 });
  }
  const bytes = await pdf.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('pdfEngine', () => {
  it('loads PDF from ArrayBuffer and returns PDFDocument', async () => {
    const buffer = await makeTestPdf(3);
    const pdf = await loadPdfFromBuffer(buffer);
    expect(pdf.getPageCount()).toBe(3);
  });

  it('extracts page metadata (width, height, count)', async () => {
    const buffer = await makeTestPdf(2);
    const pdf = await loadPdfFromBuffer(buffer);
    const meta = extractPageMeta(pdf);
    expect(meta.pageCount).toBe(2);
    expect(meta.pages).toHaveLength(2);
    expect(meta.pages[0].width).toBe(595);
    expect(meta.pages[0].height).toBe(842);
  });
});

describe('buildExportPdf', () => {
  it('builds new PDF from selected pages with rotation applied', async () => {
    const buffer = await makeTestPdf(3);
    const pdf = await loadPdfFromBuffer(buffer);
    const docs = new Map([['doc1', pdf]]);

    const result = await buildExportPdf(docs, [
      { sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 90 },
      { sourceDocId: 'doc1', sourcePageIndex: 2, rotation: 0 },
    ]);

    expect(result.getPageCount()).toBe(2);
    const pages = result.getPages();
    expect(pages[0].getRotation().angle).toBe(90);
    expect(pages[1].getRotation().angle).toBe(0);
  });

  it('throws when source doc not found', async () => {
    await expect(buildExportPdf(new Map(), [
      { sourceDocId: 'missing', sourcePageIndex: 0, rotation: 0 },
    ])).rejects.toThrow('Source document not found: missing');
  });
});

describe('buildDocFromPages', () => {
  it('builds a PDFDocument from source pages and blank pages', async () => {
    const buffer = await makeTestPdf(2);
    const pdf = await loadPdfFromBuffer(buffer);
    const docs = new Map([['doc1', pdf]]);

    const specs: PageSpec[] = [
      { sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0 },
      { blank: true, width: 595, height: 842 },
      { sourceDocId: 'doc1', sourcePageIndex: 1, rotation: 90 },
    ];

    const result = await buildDocFromPages(docs, specs);
    expect(result.getPageCount()).toBe(3);
    const pages = result.getPages();
    // 源页 0 原始尺寸
    expect(pages[0].getWidth()).toBe(595);
    // 空白页尺寸
    expect(pages[1].getWidth()).toBe(595);
    expect(pages[1].getHeight()).toBe(842);
    // 源页 1 应用了旋转
    expect(pages[2].getRotation().angle).toBe(90);
  });

  it('handles blank pages across multiple source docs', async () => {
    const buffer1 = await makeTestPdf(1);
    const buffer2 = await makeTestPdf(1);
    const docs = new Map<string, PDFDocument>([
      ['doc1', await loadPdfFromBuffer(buffer1)],
      ['doc2', await loadPdfFromBuffer(buffer2)],
    ]);

    const specs: PageSpec[] = [
      { sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0 },
      { sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 180 },
    ];

    const result = await buildDocFromPages(docs, specs);
    expect(result.getPageCount()).toBe(2);
    expect(result.getPages()[1].getRotation().angle).toBe(180);
  });

  it('throws when source doc not found', async () => {
    await expect(buildDocFromPages(new Map(), [
      { sourceDocId: 'missing', sourcePageIndex: 0, rotation: 0 },
    ])).rejects.toThrow('Source document not found: missing');
  });
});
