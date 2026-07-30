import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
// Vite 推荐方式:用 ?url import 让构建工具正确解析 worker 资源路径。
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { pdfRectToScreen } from './coord';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const docCache = new Map<string, PDFDocumentProxy>();

/**
 * 在渲染进程主线程加载 PDF 用于渲染(用 pdf.js 的 worker,不是我们的 Worker)。
 */
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

/**
 * 渲染页面到 HTMLCanvasElement(渲染进程主线程,有 DOM 环境)。
 * 返回 dataURL 供 <img> 显示。
 * rotation 用 pdf.js 原生 viewport.rotation 烘焙进位图:
 * canvas 物理尺寸 = 旋转后真实朝向,缩略图外框自然跟随旋转,内容不缩放变形。
 *
 * maxWidth 是"未旋转方向"的目标宽度;内部用 rotation:0 取原始尺寸算 scale,
 * 再用 rotation 参数渲染,canvas 尺寸自动为旋转后朝向。
 */
export async function renderPageToDataURL(
  docId: string,
  pageIndex: number,
  maxWidth: number = 200,
  rotation: number = 0,
): Promise<string> {
  const doc = docCache.get(docId);
  if (!doc) throw new Error(`Document not loaded for render: ${docId}`);

  const page = await doc.getPage(pageIndex + 1); // pdf.js 用 1-based
  // rotation:0 强制取原始未旋转尺寸(忽略 PDF 内嵌 /Rotate),与 Page.width 对齐
  const baseVp = page.getViewport({ scale: 1, rotation: 0 });
  const scale = maxWidth / baseVp.width;
  // rotation 参数为绝对旋转(含 PDF 内嵌旋转);getViewport 返回旋转后尺寸
  const scaledViewport = page.getViewport({ scale, rotation });

  // HiDPI/Retina 适配:位图后备存储按 devicePixelRatio 放大,缩略图更清晰。
  const outputScale = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(scaledViewport.width * outputScale);
  canvas.height = Math.floor(scaledViewport.height * outputScale);
  const ctx = canvas.getContext('2d')!;
  const transform =
    outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
  await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport, transform }).promise;
  return canvas.toDataURL('image/png');
}

/**
 * 高分辨率渲染页面到独立 Canvas 元素(供右侧真实页面预览,可滚动)。
 * 调用方提供目标 canvas,函数负责设置尺寸并渲染。
 * rotation 用 pdf.js 原生 viewport.rotation 烘焙进位图:
 * canvas 物理尺寸 = 旋转后真实朝向,布局自然,不依赖 CSS transform(会留空白)。
 *
 * targetWidth 是"未旋转方向"的目标宽度(= BASE_WIDTH * zoom);
 * 内部用 rotation:0 取原始尺寸算 scale,再用 rotation 参数渲染,
 * canvas 尺寸自动为旋转后朝向,与 ReaderPage 的 CSS displayWidth/displayHeight 一致。
 */
export async function renderPageToCanvas(
  canvas: HTMLCanvasElement,
  docId: string,
  pageIndex: number,
  targetWidth: number,
  rotation: number = 0,
): Promise<void> {
  const doc = docCache.get(docId);
  if (!doc) throw new Error(`Document not loaded for render: ${docId}`);

  const page = await doc.getPage(pageIndex + 1);
  // rotation:0 强制取原始未旋转尺寸(忽略 PDF 内嵌 /Rotate),与 Page.width 对齐
  const baseVp = page.getViewport({ scale: 1, rotation: 0 });
  const scale = targetWidth / baseVp.width;
  // rotation 参数为绝对旋转(含 PDF 内嵌旋转);getViewport 返回旋转后尺寸
  const scaledViewport = page.getViewport({ scale, rotation });

  // HiDPI/Retina 适配:位图后备存储按 devicePixelRatio 放大,
  // CSS 显示尺寸由调用方通过 style.width/height(CSS 像素)控制,保持不变。
  // 成熟 PDF 阅读器均采用此模式,避免位图被浏览器放大导致模糊。
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(scaledViewport.width * outputScale);
  canvas.height = Math.floor(scaledViewport.height * outputScale);
  const ctx = canvas.getContext('2d')!;
  const transform =
    outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
  await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport, transform }).promise;
}

/**
 * 渲染页面指定 PDF 矩形区域为 PNG dataURL(供圈取"复制":把范围内的 PDF 内容渲染成图片)。
 * 思路:整页渲染到离屏 canvas(rotation 烘焙),用 pdfRectToScreen 把 PDF 矩形映射到 canvas 像素源矩形,
 * 再用 drawImage 源矩形裁剪到第二个 canvas,toDataURL 返回。
 */
export async function renderPageRegionToDataURL(
  docId: string,
  pageIndex: number,
  pdfRect: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number,
  rotation: 0 | 90 | 180 | 270 = 0,
  targetWidth: number = 1000,
): Promise<string> {
  // 1. 整页渲染到离屏 canvas(rotation 烘焙,物理尺寸 = 旋转后朝向)
  const full = document.createElement('canvas');
  await renderPageToCanvas(full, docId, pageIndex, targetWidth, rotation);

  // 2. PDF 矩形 -> canvas 像素源矩形(canvas 左上原点,旋转后朝向)
  const isLandscape = rotation === 90 || rotation === 270;
  const rotatedWidth = isLandscape ? pageHeight : pageWidth;
  const scale = full.width / rotatedWidth;
  const meta = { width: pageWidth, height: pageHeight, rotation, scale };
  const src = pdfRectToScreen(pdfRect.x, pdfRect.y, pdfRect.width, pdfRect.height, meta);

  // 3. 裁剪到第二个 canvas
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(src.width));
  out.height = Math.max(1, Math.round(src.height));
  const ctx = out.getContext('2d')!;
  ctx.drawImage(
    full,
    Math.round(src.left), Math.round(src.top), Math.round(src.width), Math.round(src.height),
    0, 0, out.width, out.height,
  );
  return out.toDataURL('image/png');
}

export function disposeRenderDoc(docId: string): void {
  const doc = docCache.get(docId);
  if (doc) {
    void doc.loadingTask.destroy();
    docCache.delete(docId);
  }
}
