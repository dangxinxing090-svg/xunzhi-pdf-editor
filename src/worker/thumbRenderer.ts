import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// 设置 worker 路径(pdf.js 内部 worker)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

const docCache = new Map<string, PDFDocumentProxy>();

export async function loadPdfForRender(
  docId: string,
  buffer: ArrayBuffer,
): Promise<PDFDocumentProxy> {
  const cached = docCache.get(docId);
  if (cached) return cached;
  const task = pdfjsLib.getDocument({ data: buffer });
  const doc = await task.promise;
  docCache.set(docId, doc);
  return doc;
}

export async function renderThumb(
  docId: string,
  pageIndex: number,
  rotation: 0 | 90 | 180 | 270,
  maxWidth: number = 200,
): Promise<ImageBitmap> {
  const doc = docCache.get(docId);
  if (!doc) throw new Error(`Document not loaded for render: ${docId}`);

  const page = await doc.getPage(pageIndex + 1); // pdf.js 用 1-based
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale, rotation });

  const canvas = new OffscreenCanvas(scaledViewport.width, scaledViewport.height);
  const ctx = canvas.getContext('2d')!;
  await page.render({
    // pdfjs-dist v6: 优先使用 canvas(HTMLCanvasElement),但 Worker 中只有 OffscreenCanvas。
    // 传 canvas:null + canvasContext 是官方支持的后备路径(见 RenderParameters 注释)。
    // 类型标注为 CanvasRenderingContext2D,OffscreenCanvasRenderingContext2D 运行时兼容。
    canvas: null,
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport: scaledViewport,
  }).promise;

  return canvas.transferToImageBitmap();
}

export function disposeDoc(docId: string): void {
  const doc = docCache.get(docId);
  if (doc) {
    // pdf.js v6: destroy() 在 loadingTask 上,返回 Promise<void>(此处 fire-and-forget)
    doc.loadingTask.destroy();
    docCache.delete(docId);
  }
}
