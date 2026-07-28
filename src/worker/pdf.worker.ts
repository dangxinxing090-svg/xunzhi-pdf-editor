import { loadPdfFromBuffer, extractPageMeta, buildExportPdf } from './pdfEngine';
import { loadPdfForRender } from './thumbRenderer';
import type { WorkerRequest, WorkerResponse } from './protocol';

const docs = new Map<string, import('pdf-lib').PDFDocument>();
// 缓存已渲染的 OffscreenCanvas(按 docId:pageIndex),不随 transfer 失效。
// 每次请求从此 canvas 生成新的 ImageBitmap 用于 transfer。
const canvasCache = new Map<string, OffscreenCanvas>();

function respond(msg: WorkerResponse, transfer?: Transferable[]): void {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

function cacheKey(docId: string, pageIndex: number): string {
  return `${docId}:${pageIndex}`;
}

async function handleRequest(req: WorkerRequest): Promise<void> {
  try {
    switch (req.type) {
      case 'loadDoc': {
        const { docId, buffer } = req.payload as { docId: string; buffer: ArrayBuffer };
        const pdf = await loadPdfFromBuffer(buffer);
        docs.set(docId, pdf);
        await loadPdfForRender(docId, buffer);
        const meta = extractPageMeta(pdf);
        respond({ id: req.id, ok: true, data: meta });
        break;
      }
      case 'renderThumb': {
        const { docId, pageIndex } = req.payload as {
          docId: string;
          pageIndex: number;
        };
        const key = cacheKey(docId, pageIndex);
        let canvas = canvasCache.get(key);
        if (!canvas) {
          // renderThumb 现在渲染原始方向位图(无 rotation),由渲染进程统一旋转。
          const { renderToCanvas } = await import('./thumbRenderer');
          canvas = await renderToCanvas(docId, pageIndex);
          canvasCache.set(key, canvas);
        }
        // 从缓存 canvas 生成新的 ImageBitmap(transfer 不会消耗 canvas)。
        const bitmap = await createImageBitmap(canvas);
        respond({ id: req.id, ok: true, data: bitmap }, [bitmap]);
        break;
      }
      case 'exportPdf': {
        const { pages } = req.payload as { pages: Array<{ sourceDocId: string; sourcePageIndex: number; rotation: 0 | 90 | 180 | 270 }> };
        const newPdf = await buildExportPdf(docs, pages);
        const bytes = await newPdf.save();
        const buffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        respond({ id: req.id, ok: true, data: buffer }, [buffer]);
        break;
      }
      default:
        respond({ id: req.id, ok: false, error: `Unknown request type: ${(req as { type: string }).type}` });
    }
  } catch (err) {
    respond({ id: req.id, ok: false, error: String(err) });
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  handleRequest(e.data);
};
