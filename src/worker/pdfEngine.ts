import { PDFDocument, degrees } from 'pdf-lib';
import type { LoadDocResult, ExportPdfPayload, PageSpec } from './protocol';

export async function loadPdfFromBuffer(buffer: ArrayBuffer): Promise<PDFDocument> {
  return PDFDocument.load(buffer, { ignoreEncryption: true });
}

export function extractPageMeta(pdf: PDFDocument): LoadDocResult {
  const pages = pdf.getPages().map((page) => ({
    width: page.getWidth(),
    height: page.getHeight(),
  }));
  return {
    pageCount: pages.length,
    pages,
  };
}

/**
 * 从一组页面规格构建新的 PDFDocument(不 save)。
 * 规格可为引用已有源页 或 空白页。支持跨文档拷贝。
 */
export async function buildDocFromPages(
  docs: Map<string, PDFDocument>,
  pageSpecs: PageSpec[],
): Promise<PDFDocument> {
  const newPdf = await PDFDocument.create();
  for (const spec of pageSpecs) {
    if ('blank' in spec) {
      newPdf.addPage([spec.width, spec.height]);
    } else {
      const sourcePdf = docs.get(spec.sourceDocId);
      if (!sourcePdf) {
        throw new Error(`Source document not found: ${spec.sourceDocId}`);
      }
      const [copied] = await newPdf.copyPages(sourcePdf, [spec.sourcePageIndex]);
      copied.setRotation(degrees(spec.rotation));
      newPdf.addPage(copied);
    }
  }
  return newPdf;
}

export async function buildExportPdf(
  docs: Map<string, PDFDocument>,
  pages: ExportPdfPayload['pages'],
): Promise<PDFDocument> {
  // 复用 buildDocFromPages:导出规格与 PageSpec 的源页变体结构一致。
  return buildDocFromPages(docs, pages);
}
