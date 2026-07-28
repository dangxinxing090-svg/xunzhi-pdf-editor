import { loadPdfFromBuffer, extractPageMeta, buildExportPdf, buildDocFromPages, insertPagesIntoDoc, applyAnnotations, applyCrop } from './pdfEngine';
import type { WorkerRequest, WorkerResponse, PageSpec, ApplyAnnotationsPayload, ApplyCropPayload } from './protocol';

// Worker 只负责 pdf-lib 操作(加载/导出/合成)。pdf.js 渲染在渲染进程主线程进行。
const docs = new Map<string, import('pdf-lib').PDFDocument>();

function respond(msg: WorkerResponse, transfer?: Transferable[]): void {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

/**
 * 把 pdf-lib PDFDocument 序列化为 ArrayBuffer,供主线程的 pdf.js 重新加载渲染。
 */
async function pdfToBuffer(pdf: import('pdf-lib').PDFDocument): Promise<ArrayBuffer> {
  const bytes = await pdf.save();
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function handleRequest(req: WorkerRequest): Promise<void> {
  try {
    switch (req.type) {
      case 'loadDoc': {
        const { docId, buffer } = req.payload as { docId: string; buffer: ArrayBuffer };
        const pdf = await loadPdfFromBuffer(buffer);
        docs.set(docId, pdf);
        const meta = extractPageMeta(pdf);
        // 返回元数据 + 序列化字节(主线程用它加载到 pdf.js 渲染)
        const renderBuffer = await pdfToBuffer(pdf);
        respond({ id: req.id, ok: true, data: { meta, renderBuffer } }, [renderBuffer]);
        break;
      }
      case 'exportPdf': {
        const { pages } = req.payload as { pages: Array<{ sourceDocId: string; sourcePageIndex: number; rotation: 0 | 90 | 180 | 270 }> };
        const newPdf = await buildExportPdf(docs, pages);
        const buffer = await pdfToBuffer(newPdf);
        respond({ id: req.id, ok: true, data: buffer }, [buffer]);
        break;
      }
      case 'disposeDoc': {
        const { docId } = req.payload as { docId: string };
        docs.delete(docId);
        respond({ id: req.id, ok: true, data: null });
        break;
      }
      case 'createDocFromPages': {
        const { targetDocId, pages } = req.payload as { targetDocId: string; pages: PageSpec[] };
        const newPdf = await buildDocFromPages(docs, pages);
        docs.set(targetDocId, newPdf);
        const meta = extractPageMeta(newPdf);
        const renderBuffer = await pdfToBuffer(newPdf);
        respond({ id: req.id, ok: true, data: { meta, renderBuffer } }, [renderBuffer]);
        break;
      }
      case 'insertPagesIntoDoc': {
        const { docId, insertAt, pages } = req.payload as {
          docId: string;
          insertAt: number;
          pages: PageSpec[];
        };
        const pdf = await insertPagesIntoDoc(docs, docId, insertAt, pages);
        const meta = extractPageMeta(pdf);
        // 重新序列化供主线程 pdf.js 重新加载(页面索引已变)
        const renderBuffer = await pdfToBuffer(pdf);
        respond({ id: req.id, ok: true, data: { meta, renderBuffer } }, [renderBuffer]);
        break;
      }
      case 'applyAnnotations': {
        const { docId, annotations } = req.payload as ApplyAnnotationsPayload;
        const pdf = await applyAnnotations(docs, docId, annotations);
        const meta = extractPageMeta(pdf);
        const renderBuffer = await pdfToBuffer(pdf);
        respond({ id: req.id, ok: true, data: { meta, renderBuffer } }, [renderBuffer]);
        break;
      }
      case 'applyCrop': {
        const { docId, crops } = req.payload as ApplyCropPayload;
        const pdf = await applyCrop(docs, docId, crops);
        const meta = extractPageMeta(pdf);
        const renderBuffer = await pdfToBuffer(pdf);
        respond({ id: req.id, ok: true, data: { meta, renderBuffer } }, [renderBuffer]);
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
