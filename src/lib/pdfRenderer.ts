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
 * rotation 由渲染层烘焙进位图(交换宽高并旋转),与 renderPageToCanvas 一致:
 * 这样 <img> 物理尺寸 = 旋转后真实朝向,缩略图外框自然跟随旋转,内容不缩放变形。
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
  const viewport = page.getViewport({ scale: 1 });
  const isLandscape = rotation === 90 || rotation === 270;
  // 90°/270° 旋转后宽高交换:旋转后的宽度 = 原始高度。为使缩略图显示宽度与未旋转一致(≤ maxWidth),
  // 按原始高度计算 scale;0°/180° 按原始宽度。这样旋转只是改变朝向,不改变预览图大小。
  const scale = maxWidth / (isLandscape ? viewport.height : viewport.width);
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  if (!isLandscape) {
    // 0°/180°:canvas 物理尺寸与页面一致,180° 仅视觉翻转不影响布局盒
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    if (rotation === 180) {
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
    }
    await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport }).promise;
    return canvas.toDataURL('image/png');
  }

  // 90°/270°:交换 canvas 宽高,先渲染到离屏 canvas,再旋转绘制
  canvas.width = scaledViewport.height;
  canvas.height = scaledViewport.width;
  const offscreen = document.createElement('canvas');
  offscreen.width = scaledViewport.width;
  offscreen.height = scaledViewport.height;
  const offCtx = offscreen.getContext('2d')!;
  await page.render({ canvas: offscreen, canvasContext: offCtx, viewport: scaledViewport }).promise;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (rotation === 90) {
    ctx.translate(canvas.width, 0);
  } else {
    ctx.translate(0, canvas.height);
  }
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(offscreen, 0, 0);

  return canvas.toDataURL('image/png');
}

/**
 * 高分辨率渲染页面到独立 Canvas 元素(供右侧真实页面预览,可滚动)。
 * 调用方提供目标 canvas,函数负责设置尺寸并渲染。
 * rotation 由渲染层处理(交换 canvas 宽高并在位图上旋转),
 * 这样 canvas 物理尺寸 = 旋转后真实朝向,布局自然,不依赖 CSS transform(会留空白)。
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
  const viewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const isLandscape = rotation === 90 || rotation === 270;

  if (!isLandscape) {
    // 0°/180°:canvas 物理尺寸与页面一致,180° 仅视觉翻转不影响布局盒
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d')!;
    if (rotation === 180) {
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
    }
    await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport }).promise;
    return;
  }

  // 90°/270°:交换 canvas 宽高,先渲染到离屏 canvas,再旋转绘制
  canvas.width = scaledViewport.height;
  canvas.height = scaledViewport.width;
  const ctx = canvas.getContext('2d')!;

  const offscreen = document.createElement('canvas');
  offscreen.width = scaledViewport.width;
  offscreen.height = scaledViewport.height;
  const offCtx = offscreen.getContext('2d')!;
  await page.render({ canvas: offscreen, canvasContext: offCtx, viewport: scaledViewport }).promise;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (rotation === 90) {
    ctx.translate(canvas.width, 0);
  } else {
    // 270°
    ctx.translate(0, canvas.height);
  }
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(offscreen, 0, 0);
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
