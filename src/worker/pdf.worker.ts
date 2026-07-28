import { loadPdfFromBuffer, extractPageMeta, buildExportPdf } from './pdfEngine';
import { loadPdfForRender, renderThumb } from './thumbRenderer';
import type { WorkerRequest, WorkerResponse } from './protocol';

const docs = new Map<string, import('pdf-lib').PDFDocument>();
const thumbCache = new Map<string, ImageBitmap>();

function respond(msg: WorkerResponse, transfer?: Transferable[]): void {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

function thumbKey(docId: string, pageIndex: number, rotation: number): string {
  return `${docId}:${pageIndex}:${rotation}`;
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
        const { docId, pageIndex, rotation } = req.payload as {
          docId: string;
          pageIndex: number;
          rotation: 0 | 90 | 180 | 270;
        };
        const key = thumbKey(docId, pageIndex, rotation);
        let bitmap = thumbCache.get(key);
        if (!bitmap) {
          bitmap = await renderThumb(docId, pageIndex, rotation);
          thumbCache.set(key, bitmap);
        }
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
