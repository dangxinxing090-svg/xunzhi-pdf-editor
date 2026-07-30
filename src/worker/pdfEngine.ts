import { PDFDocument, degrees, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { LoadDocResult, ExportPdfPayload, PageSpec, ApplyCropPayload } from './protocol';
import type { AnnoSpec } from '../types/pdf';
import { loadCjkFontBytes } from './fontLoader';

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

/**
 * 在已有文档的指定位置插入页面(空白或拷贝自其他文档)。
 * insertAt 是插入到此索引之前(0=最前)。
 */
export async function insertPagesIntoDoc(
  docs: Map<string, PDFDocument>,
  docId: string,
  insertAt: number,
  pageSpecs: PageSpec[],
): Promise<PDFDocument> {
  const targetPdf = docs.get(docId);
  if (!targetPdf) {
    throw new Error(`Target document not found: ${docId}`);
  }
  const pageCount = targetPdf.getPageCount();
  const insertIndex = Math.max(0, Math.min(insertAt, pageCount));

  // 逐个插入。insertPage(index) 在该索引前插入新页,后续页索引自动后移。
  // 为保持 pageSpecs 顺序,从最后一个开始倒序插入到同一位置,
  // 或正序插入并递增位置。用正序 + 递增位置更直观:
  for (let i = 0; i < pageSpecs.length; i++) {
    const spec = pageSpecs[i];
    const pos = insertIndex + i;
    if ('blank' in spec) {
      targetPdf.insertPage(pos, [spec.width, spec.height]);
    } else {
      const sourcePdf = docs.get(spec.sourceDocId);
      if (!sourcePdf) {
        throw new Error(`Source document not found: ${spec.sourceDocId}`);
      }
      const [copied] = await targetPdf.copyPages(sourcePdf, [spec.sourcePageIndex]);
      copied.setRotation(degrees(spec.rotation));
      targetPdf.insertPage(pos, copied);
    }
  }

  return targetPdf;
}

/** 将 #rrggbb 转为 pdf-lib 的 rgb(0-1 浮点)。 */
function hexToRgb(hex: string) {
  const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

/**
 * 将标注烘焙到文档:在指定页上绘制矩形/椭圆/高亮/文本/图片。
 * 就地修改内存中的 PDFDocument 并返回。
 */
export async function applyAnnotations(
  docs: Map<string, PDFDocument>,
  docId: string,
  annos: AnnoSpec[],
): Promise<PDFDocument> {
  const pdf = docs.get(docId);
  if (!pdf) throw new Error(`Document not found: ${docId}`);
  if (annos.length === 0) return pdf;

  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // 懒加载 CJK 字体:仅当存在含非 ASCII(中文等)的文本标注时才嵌入,
  // subset:true 只嵌入用到的字形,避免输出体积膨胀。
  let cjkFont: PDFFont | null = null;
  async function getCjkFont(): Promise<PDFFont> {
    if (!cjkFont) {
      const doc = docs.get(docId)!;
      doc.registerFontkit(fontkit);
      const bytes = await loadCjkFontBytes();
      cjkFont = await doc.embedFont(bytes, { subset: true });
    }
    return cjkFont;
  }

  // 预嵌入所有图片(按 dataUrl 去重)
  const imgCache = new Map<string, any>();
  for (const a of annos) {
    if (a.type === 'image' && a.imageDataUrl && !imgCache.has(a.imageDataUrl)) {
      const isJpeg = /^data:image\/jpe?g/i.test(a.imageDataUrl);
      imgCache.set(a.imageDataUrl, isJpeg ? await pdf.embedJpg(a.imageDataUrl) : await pdf.embedPng(a.imageDataUrl));
    }
  }

  for (const a of annos) {
    const page = pdf.getPage(a.pageIndex);
    const color = a.color ? hexToRgb(a.color) : rgb(0, 0, 0);
    switch (a.type) {
      case 'rect':
      case 'marquee':
        page.drawRectangle({
          x: a.x, y: a.y, width: a.width, height: a.height,
          borderColor: a.stroke ? hexToRgb(a.stroke) : color,
          borderWidth: a.strokeWidth ?? 1,
          color: a.fill ? hexToRgb(a.fill) : undefined,
        });
        break;
      case 'ellipse':
        page.drawEllipse({
          x: a.x + a.width / 2, y: a.y + a.height / 2,
          xScale: a.width / 2, yScale: a.height / 2,
          borderColor: a.stroke ? hexToRgb(a.stroke) : color,
          borderWidth: a.strokeWidth ?? 1,
        });
        break;
      case 'highlight':
        page.drawRectangle({
          x: a.x, y: a.y, width: a.width, height: a.height,
          color: hexToRgb(a.color ?? '#ffff00'),
          opacity: a.opacity ?? 0.4,
        });
        break;
      case 'text':
      case 'watermark':
      case 'header':
      case 'footer':
      case 'pageNumber': {
        const rawText = a.text ?? '';
        // 含非 ASCII(中文等)用 CJK 字体;纯 ASCII 用 Helvetica(体积更小)
        const hasCjk = /[^\x00-\x7F]/.test(rawText);
        const textFont = hasCjk ? await getCjkFont() : font;
        // 按行绘制:drawText 不支持自动换行,逐行定位
        const lines = rawText.split('\n');
        const lineHeight = (a.fontSize ?? 12) * 1.2;
        // drawText 的 y 是该行基线(左下锚点);多行从底部向上排
        for (let i = 0; i < lines.length; i++) {
          const baselineY = a.y + (lines.length - 1 - i) * lineHeight;
          page.drawText(lines[i], {
            x: a.x, y: baselineY,
            size: a.fontSize ?? 12,
            font: textFont,
            color,
            opacity: a.opacity,
            rotate: degrees(a.rotation ?? 0),
          });
        }
        // 外边框:有 stroke 时在文本框外绘制矩形描边
        if (a.stroke && a.strokeWidth) {
          page.drawRectangle({
            x: a.x, y: a.y, width: a.width, height: a.height,
            borderColor: hexToRgb(a.stroke),
            borderWidth: a.strokeWidth,
            color: undefined,
            opacity: a.opacity,
          });
        }
        break;
      }
      case 'image': {
        const img = a.imageDataUrl ? imgCache.get(a.imageDataUrl) : undefined;
        if (img) {
          page.drawImage(img, { x: a.x, y: a.y, width: a.width, height: a.height });
        }
        break;
      }
    }
  }
  return pdf;
}

/** 裁剪:设置指定页的裁剪框。 */
export async function applyCrop(
  docs: Map<string, PDFDocument>,
  docId: string,
  crops: ApplyCropPayload['crops'],
): Promise<PDFDocument> {
  const pdf = docs.get(docId);
  if (!pdf) throw new Error(`Document not found: ${docId}`);
  for (const c of crops) {
    pdf.getPage(c.pageIndex).setCropBox(c.x, c.y, c.width, c.height);
  }
  return pdf;
}
