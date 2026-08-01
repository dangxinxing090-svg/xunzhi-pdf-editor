import { PDFDocument, degrees, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { LoadDocResult, ExportPdfPayload, PageSpec, ApplyCropPayload } from './protocol';
import type { AnnoSpec } from '../types/pdf';
import { loadCjkFontBytes } from './fontLoader';

/** 文本行高倍数(与叠加层 AnnotationLayer.css 的 line-height: 1.2 一致)。 */
const TEXT_LINE_HEIGHT = 1.2;
/** 字体升部(em):烘焙文本基线 = 块顶 - 升部,使字形顶部对齐块顶(叠加层同规则)。 */
const CJK_ASCENT = 0.88; // Noto Sans CJK ascender
const HELVETICA_ASCENT = 0.718; // Helvetica ascender

/** 是否已修补 fontkit CFF 子集化 bug(进程内只补一次)。 */
let cffSubsetPatched = false;

/**
 * fontkit(@pdf-lib/fontkit@1.1.1)的 CFF 子集化有两个 bug,导致嵌入字体损坏:
 *
 * 1. CFFSubset.encode 把 CFF 头部的 offSize(合法值 1-4)写成原始 CFF 表长度,
 *    OTS(Chromium)直接拒绝字体,pdf.js 字体加载失败(文本错乱漏字)。
 *    修复:encode 前临时把 cff.length 改为合法值 4(上游 fontkit@2 同款修复)。
 *
 * 2. subsetFontdict 构建 FDSelect 时 fds.push(FDArray.length - 1),即"最后压入的 FD",
 *    而不是当前字形所属的 FD(fd_select[fd])。多 FD 字体(如 NotoSansCJKsc 有 3 个 FD)
 *    字形交错时映射错误:字形用了别的 FD 的局部 subr 表,导致 pdf.js 报
 *    "Out of bounds subrIndex for callsubr",字形形状损坏(漏字)。
 *    同时 used_subrs 的槽位取 used_subrs.length - 1 也错,导致用到的 subr 被错误
 *    替换成 return 占位(形状缺失)。按上游 fontkit@2 的修复重写本函数。
 *
 * 升级到 fontkit@2 后可删除整个补丁。
 */
function patchFontkitCffSubsetBugs(fontBytes: ArrayBuffer): void {
  if (cffSubsetPatched) return;
  cffSubsetPatched = true;
  // CFFSubset 类未从打包产物导出,用实例拿到其原型后替换方法
  const probeFont = fontkit.create(new Uint8Array(fontBytes));
  const probeSubset = probeFont.createSubset();
  const proto = Object.getPrototypeOf(probeSubset) as {
    encode?: (stream: unknown) => void;
    subsetFontdict?: (topDict: any) => void;
  };

  // Bug 1:offSize 头字段
  const origEncode = proto.encode;
  if (origEncode) {
    proto.encode = function (this: { cff?: { length: number } }, stream: unknown) {
      const cff = this.cff;
      const origLen = cff ? cff.length : undefined;
      if (cff && origLen !== undefined && (origLen < 1 || origLen > 4)) {
        cff.length = 4; // 修正 offSize 头字段的取值来源
      }
      try {
        origEncode.call(this, stream);
      } finally {
        if (cff && origLen !== undefined) cff.length = origLen;
      }
    };
  }

  // Bug 2:FDSelect 映射 + used_subrs 槽位(fontkit@2 的修复逻辑)
  if (proto.subsetFontdict) {
    proto.subsetFontdict = function (this: any, topDict: any) {
      topDict.FDArray = [];
      topDict.FDSelect = { version: 0, fds: [] };
      const usedFds: Record<number, boolean> = {};
      const usedSubrs: Record<string, boolean>[] = [];
      const fdSelect: Record<number, number> = {};
      for (const gid of this.glyphs) {
        const fd = this.cff.fdForGlyph(gid);
        if (fd == null) continue;
        if (!usedFds[fd]) {
          topDict.FDArray.push(Object.assign({}, this.cff.topDict.FDArray[fd]));
          usedSubrs.push({});
          fdSelect[fd] = topDict.FDArray.length - 1;
        }
        usedFds[fd] = true;
        topDict.FDSelect.fds.push(fdSelect[fd]);
        const glyph = this.font.getGlyph(gid);
        void glyph.path; // 触发字形解析,记录用到的局部 subr
        for (const subr in glyph._usedSubrs) {
          usedSubrs[fdSelect[fd]][subr] = true;
        }
      }
      for (let i = 0; i < topDict.FDArray.length; i++) {
        const dict = topDict.FDArray[i];
        delete dict.FontName;
        if (dict.Private && dict.Private.Subrs) {
          dict.Private = Object.assign({}, dict.Private);
          dict.Private.Subrs = this.subsetSubrs(dict.Private.Subrs, usedSubrs[i]);
        }
      }
    };
  }
}

export async function loadPdfFromBuffer(buffer: ArrayBuffer): Promise<PDFDocument> {
  return PDFDocument.load(buffer, { ignoreEncryption: true });
}

/**
 * 失效所有页面内容流的编码缓存。
 * pdf-lib 缺陷:PDFFlateStream.contentsCache 在首次 getContents()/save() 后填充,
 * 之后再 push 算子不会失效缓存,导致"烘焙一次后再次烘焙"的新内容丢失。
 * 每次 save 后调用本函数,确保下一次绘制/保存可见。
 */
export function invalidateContentStreamCaches(pdf: PDFDocument): void {
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    if (!contents) continue;
    // pdf-lib 未公开 Contents 的数组形态,用鸭子类型判断(asArray 仅 PDFArray 有)
    const items = (contents as { asArray?: () => Array<unknown> }).asArray
      ? (contents as { asArray: () => Array<unknown> }).asArray()
      : [contents];
    for (const ref of items) {
      const obj = pdf.context.lookup(ref as never);
      (obj as { contentsCache?: { invalidate?: () => void } } | undefined)
        ?.contentsCache?.invalidate?.();
    }
  }
}

export function extractPageMeta(pdf: PDFDocument): LoadDocResult {
  const pages = pdf.getPages().map((page) => {
    // pdf-lib 的 getWidth/getHeight 返回 MediaBox 尺寸(不受 /Rotate 影响),保持原始未旋转尺寸。
    // 旋转完全由 rotation 字段表达,由渲染层(pdfjs rotation 参数)和坐标层(coord.ts)处理。
    const rotation = ((page.getRotation().angle % 360) + 360) % 360 as 0 | 90 | 180 | 270;
    return { width: page.getWidth(), height: page.getHeight(), rotation };
  });
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
      patchFontkitCffSubsetBugs(bytes);
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
        const fontSize = a.fontSize ?? 12;
        const lineHeight = fontSize * TEXT_LINE_HEIGHT;
        // 文本块从框顶部(a.y + a.height)向下排布,与叠加层一致(叠加层 div 顶 = 框顶)。
        // 基线 = 块顶 - 字体升部;多行自上而下递增行高。
        const ascent = (hasCjk ? CJK_ASCENT : HELVETICA_ASCENT) * fontSize;
        const lines = rawText.split('\n');
        // 块宽 = 最宽行(叠加层 width:max-content 同规则),用于旋转中心对齐
        let textWidth = 0;
        for (const line of lines) {
          textWidth = Math.max(textWidth, textFont.widthOfTextAtSize(line, fontSize));
        }
        const blockTop = a.y + a.height;
        const centerX = a.x + textWidth / 2;
        const centerY = blockTop - (lines.length * lineHeight) / 2;
        const theta = ((a.rotation ?? 0) * Math.PI) / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        // 叠加层旋转以文本块中心为原点;pdf-lib 旋转以 drawText 锚点(x,y)为原点。
        // 把每个基线起点绕块中心旋转后作为锚点,使烘焙结果与叠加层一致。
        for (let i = 0; i < lines.length; i++) {
          const bx = a.x;
          const by = blockTop - ascent - i * lineHeight;
          const ox = centerX + (bx - centerX) * cos - (by - centerY) * sin;
          const oy = centerY + (bx - centerX) * sin + (by - centerY) * cos;
          page.drawText(lines[i], {
            x: ox, y: oy,
            size: fontSize,
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
