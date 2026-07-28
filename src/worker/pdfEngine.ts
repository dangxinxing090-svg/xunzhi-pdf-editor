import { PDFDocument, degrees } from 'pdf-lib';
import type { LoadDocResult, ExportPdfPayload } from './protocol';

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

export async function buildExportPdf(
  docs: Map<string, PDFDocument>,
  pages: ExportPdfPayload['pages'],
): Promise<PDFDocument> {
  const newPdf = await PDFDocument.create();
  for (const pageSpec of pages) {
    const sourcePdf = docs.get(pageSpec.sourceDocId);
    if (!sourcePdf) {
      throw new Error(`Source document not found: ${pageSpec.sourceDocId}`);
    }
    const [copied] = await newPdf.copyPages(sourcePdf, [pageSpec.sourcePageIndex]);
    copied.setRotation(degrees(pageSpec.rotation));
    newPdf.addPage(copied);
  }
  return newPdf;
}
