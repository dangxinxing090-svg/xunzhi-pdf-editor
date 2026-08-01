import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import zlib from 'zlib';
import { applyAnnotations, invalidateContentStreamCaches } from '../../src/worker/pdfEngine';
import type { AnnoSpec } from '../../src/types/pdf';

/**
 * 统计已保存 PDF 字节中的页面文本绘制算子数量(Tj/TJ)。
 * 与 worker 流程一致:pdf-lib 文档的缓存只被 save() 填充,并在 save 后立即失效;
 * 渲染侧读取的是保存出来的文件,而非内存中的 pdf-lib 文档。
 */
async function countTextOpsInBytes(bytes: Uint8Array, pageIndex = 0): Promise<number> {
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPage(pageIndex);
  const contents = page.node.Contents() as any;
  const items: any[] = contents?.asArray ? contents.asArray() : contents ? [contents] : [];
  let count = 0;
  for (const ref of items) {
    const obj = pdf.context.lookup(ref);
    if (!obj || typeof obj.getContents !== 'function') continue;
    const raw = obj.getContents();
    let text = '';
    try {
      text = zlib.inflateSync(Buffer.from(raw)).toString();
    } catch {
      text = Buffer.from(raw).toString();
    }
    count += (text.match(/Tj|TJ/g) ?? []).length;
  }
  return count;
}

/** 从保存的 PDF 提取所有 CIDFontType0C 字体流(裸 CFF 数据) */
async function extractCffFonts(bytes: Uint8Array): Promise<Buffer[]> {
  const pdf = await PDFDocument.load(bytes);
  const fonts: Buffer[] = [];
  for (const [, obj] of pdf.context.enumerateIndirectObjects() as any) {
    if (!obj || typeof obj.getContents !== 'function' || !obj.dict) continue;
    const subtype = obj.dict.get(PDFName.of('Subtype'));
    if (subtype?.encodedName === '/CIDFontType0C') {
      const raw = obj.getContents();
      try {
        fonts.push(zlib.inflateSync(Buffer.from(raw)));
      } catch {
        fonts.push(Buffer.from(raw));
      }
    }
  }
  return fonts;
}

async function makeTestPdf(): Promise<{ docs: Map<string, PDFDocument>; docId: string }> {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]); // A4
  return { docs: new Map<string, PDFDocument>([['doc1', pdf]]), docId: 'doc1' };
}

describe('double apply (烘焙两次, Bug2 回归)', () => {
  it('第二次烘焙应保留第一次烘焙的内容', async () => {
    const { docs, docId } = await makeTestPdf();
    const annos1: AnnoSpec[] = [
      { pageIndex: 0, type: 'text', x: 50, y: 700, width: 200, height: 24, text: '第一次烘焙', color: '#000000', fontSize: 24 },
    ];
    const after1 = await applyAnnotations(docs, docId, annos1);
    const bytes1 = await after1.save();
    invalidateContentStreamCaches(after1); // 镜像 worker pdfToBuffer
    expect(await countTextOpsInBytes(bytes1)).toBeGreaterThan(0);

    // 第二次烘焙:worker 内存文档为第一次烘焙后的文档,应原地累积
    const annos2: AnnoSpec[] = [
      { pageIndex: 0, type: 'text', x: 50, y: 600, width: 200, height: 24, text: '第二次烘焙', color: '#000000', fontSize: 24 },
    ];
    const after2 = await applyAnnotations(docs, docId, annos2);
    const bytes2 = await after2.save();
    invalidateContentStreamCaches(after2);
    // 修复前:第二次烘焙内容丢失(仅 1 个文本算子);修复后应有 2 个
    expect(await countTextOpsInBytes(bytes2)).toBe(2);
  });
});

describe('CJK 字体子集有效性 (Bug1 回归)', () => {
  it('嵌入的 CFF 子集头部 offSize 应为合法值 1-4', async () => {
    const { docs, docId } = await makeTestPdf();
    // 长文本 + 中文标点 + 英文混排,覆盖"多于4字/标点/英文"场景
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'text', x: 50, y: 700, width: 400, height: 24, text: '你好,世界!测试 Hello 123', color: '#000000', fontSize: 24 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();

    const cffFonts = await extractCffFonts(bytes);
    expect(cffFonts.length).toBeGreaterThan(0);
    for (const cff of cffFonts) {
      // 裸 CFF 头部:major/minor/hdrSize/offSize(修复前 offSize=27,非法)
      expect(cff.length).toBeGreaterThan(7);
      const offSize = cff[3];
      expect(offSize).toBeGreaterThanOrEqual(1);
      expect(offSize).toBeLessThanOrEqual(4);
    }
  });
});

describe('文本基线锚点 (Bug3 回归)', () => {
  it('烘焙文本基线应锚在框顶部下方一个升部(而非框底部)', async () => {
    const { docs, docId } = await makeTestPdf();
    // 框:y=700, height=24, fontSize=14 -> 块顶=724, CJK 升部=0.88*14=12.32
    // 未旋转时基线 y = 724 - 12.32 = 711.68
    const annos: AnnoSpec[] = [
      { pageIndex: 0, type: 'text', x: 50, y: 700, width: 200, height: 24, text: '位置测试', color: '#000000', fontSize: 14 },
    ];
    const result = await applyAnnotations(docs, docId, annos);
    const bytes = await result.save();
    const pdf = await PDFDocument.load(bytes);

    const page = pdf.getPage(0);
    const contents = page.node.Contents() as any;
    const items: any[] = contents?.asArray ? contents.asArray() : [contents];
    let content = '';
    for (const ref of items) {
      const obj = pdf.context.lookup(ref);
      const raw = obj.getContents();
      try {
        content += zlib.inflateSync(Buffer.from(raw)).toString();
      } catch {
        content += Buffer.from(raw).toString();
      }
    }
    // 文本矩阵形如 "1 0 0 1 50 711.68 Tm",取最后一个矩阵的 y(基线)
    const tms = [...content.matchAll(/([-\d.]+) ([-\d.]+) Tm\b/g)];
    expect(tms.length).toBeGreaterThan(0);
    const baselineY = Number(tms[tms.length - 1][2]);
    expect(Math.abs(baselineY - 711.68)).toBeLessThan(0.5);
  });
});
