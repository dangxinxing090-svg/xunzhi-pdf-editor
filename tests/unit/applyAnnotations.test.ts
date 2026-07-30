import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { loadPdfFromBuffer, applyAnnotations, applyCrop } from '../../src/worker/pdfEngine';
import type { AnnoSpec } from '../../src/types/pdf';

async function makeTestPdf(pageCount: number): Promise<{ docs: Map<string, PDFDocument>; docId: string }> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdf.addPage([595, 842]); // A4
  }
  const docs = new Map<string, PDFDocument>([['doc1', pdf]]);
  return { docs, docId: 'doc1' };
}

describe('applyAnnotations', () => {
  it('bakes a rect annotation onto the page without error', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'rect', x: 50, y: 50, width: 200, height: 100, stroke: '#ff0000', strokeWidth: 2 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    expect(result.getPageCount()).toBe(1);
    // 重新序列化验证可正常保存(说明绘制未破坏 PDF 结构)
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('bakes an ellipse annotation', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'ellipse', x: 50, y: 50, width: 200, height: 100, stroke: '#0000ff', strokeWidth: 3 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('bakes a highlight annotation with opacity', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'highlight', x: 50, y: 50, width: 200, height: 30, color: '#ffff00', opacity: 0.4 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('bakes a text annotation (English, StandardFonts.Helvetica)', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'text', x: 50, y: 750, width: 200, height: 20, text: 'Hello World', color: '#000000', fontSize: 24 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('bakes a Chinese text annotation (CJK font embedded)', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'text', x: 50, y: 750, width: 200, height: 24, text: '你好世界', color: '#000000', fontSize: 24 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    // CJK 字体子集嵌入后体积应显著大于纯英文(含字形子集)
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('bakes a mixed Chinese/English text annotation', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'text', x: 50, y: 750, width: 300, height: 20, text: 'Hello 你好 World 世界', color: '#333333', fontSize: 16 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('bakes a multi-line text annotation with newlines', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'text', x: 50, y: 700, width: 200, height: 60, text: '第一行\n第二行\nThird line', color: '#000000', fontSize: 14 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('bakes a watermark with rotation', async () => {
    const { docs, docId } = await makeTestPdf(2);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'watermark', x: 200, y: 400, width: 200, height: 48, text: 'CONFIDENTIAL', color: '#ff0000', fontSize: 48, rotation: 45, opacity: 0.2 },
      { pageIndex: 1, type: 'watermark', x: 200, y: 400, width: 200, height: 48, text: 'CONFIDENTIAL', color: '#ff0000', fontSize: 48, rotation: 45, opacity: 0.2 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    expect(result.getPageCount()).toBe(2);
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('bakes an image annotation (PNG)', async () => {
    const { docs, docId } = await makeTestPdf(1);
    // 1x1 红色 PNG dataURL
    const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'image', x: 50, y: 50, width: 100, height: 100, imageDataUrl: pngDataUrl },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('bakes multiple annotations of different types on one page', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'rect', x: 10, y: 10, width: 100, height: 50, stroke: '#ff0000', strokeWidth: 1 },
      { pageIndex: 0, type: 'highlight', x: 10, y: 700, width: 300, height: 20, color: '#ffff00', opacity: 0.3 },
      { pageIndex: 0, type: 'text', x: 50, y: 400, width: 200, height: 20, text: 'Note', color: '#000000', fontSize: 12 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('bakes a pageNumber annotation (resolved literal text, like a normal text)', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'pageNumber', x: 50, y: 36, width: 80, height: 12, text: '第 1 页', color: '#000000', fontSize: 12 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('returns the document unchanged when annotations list is empty', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const result = await applyAnnotations(docs, docId, []);
    expect(result.getPageCount()).toBe(1);
  });

  it('throws when document not found', async () => {
    await expect(applyAnnotations(new Map(), 'missing', [])).rejects.toThrow('Document not found: missing');
  });
});

describe('applyCrop', () => {
  it('sets the crop box on the specified page', async () => {
    const { docs, docId } = await makeTestPdf(1);
    const result = await applyCrop(docs, docId, [
      { pageIndex: 0, x: 50, y: 50, width: 400, height: 600 },
    ]);
    const page = result.getPage(0);
    const crop = page.getCropBox();
    expect(crop.x).toBe(50);
    expect(crop.y).toBe(50);
    expect(crop.width).toBe(400);
    expect(crop.height).toBe(600);
  });

  it('throws when document not found', async () => {
    await expect(applyCrop(new Map(), 'missing', [])).rejects.toThrow('Document not found: missing');
  });
});
