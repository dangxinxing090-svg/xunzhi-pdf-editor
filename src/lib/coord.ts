import type { Page } from '../types/pdf';

/**
 * 坐标转换工具:PDF 坐标系(pt,左下原点,y 向上) <-> 屏幕像素(左上原点,y 向下)。
 *
 * 渲染约定:页面 canvas 按 rotation 烘焙,旋转后 canvas 的物理宽高已对应真实朝向。
 * 因此无论 rotation 多少,canvas 的左上角始终对应"旋转后页面"的左上角。
 *
 * 对未旋转页(0/180):
 *   屏幕 x = pdfX * scale
 *   屏幕 y = (pageHeight - pdfY) * scale   (0°);180° 需额外翻转
 * 对旋转页(90/270):
 *   旋转后宽高交换,坐标系也相应改变。下面按 pdf.js 渲染结果统一处理。
 */

export interface PageRenderMeta {
  width: number;   // PDF 页宽(pt,未旋转)
  height: number;  // PDF 页高(pt,未旋转)
  rotation: 0 | 90 | 180 | 270;
  scale: number;   // px / pt
}

/**
 * 由 Page 与渲染目标宽度计算 PageRenderMeta。
 * scale = 目标显示宽度 / 旋转后页面宽度。
 */
export function makePageRenderMeta(page: Pick<Page, 'width' | 'height' | 'rotation'>, displayWidth: number): PageRenderMeta {
  const isLandscape = page.rotation === 90 || page.rotation === 270;
  const rotatedWidth = isLandscape ? page.height : page.width;
  const scale = displayWidth / rotatedWidth;
  return { width: page.width, height: page.height, rotation: page.rotation, scale };
}

/**
 * PDF 坐标 -> 屏幕像素(相对于 canvas 左上角)。
 */
export function pdfToScreen(pdfX: number, pdfY: number, meta: PageRenderMeta): { x: number; y: number } {
  const { width, height, rotation, scale } = meta;
  switch (rotation) {
    case 0:
      return { x: pdfX * scale, y: (height - pdfY) * scale };
    case 180:
      return { x: (width - pdfX) * scale, y: pdfY * scale };
    case 90: {
      // 顺时针 90°:原左侧变顶部。canvas 宽=height,高=width。
      return { x: pdfY * scale, y: pdfX * scale };
    }
    case 270: {
      // 逆时针 90°(顺时针 270°):原右侧变顶部。
      return { x: (height - pdfY) * scale, y: (width - pdfX) * scale };
    }
    default:
      return { x: pdfX * scale, y: (height - pdfY) * scale };
  }
}

/**
 * 屏幕像素(相对于 canvas 左上角) -> PDF 坐标。
 */
export function screenToPdf(screenX: number, screenY: number, meta: PageRenderMeta): { x: number; y: number } {
  const { width, height, rotation, scale } = meta;
  switch (rotation) {
    case 0:
      return { x: screenX / scale, y: height - screenY / scale };
    case 180:
      return { x: width - screenX / scale, y: screenY / scale };
    case 90:
      return { x: screenY / scale, y: screenX / scale };
    case 270:
      return { x: width - screenY / scale, y: height - screenX / scale };
    default:
      return { x: screenX / scale, y: height - screenY / scale };
  }
}

/**
 * 将标注的 PDF 矩形转换为屏幕矩形 {left, top, width, height}（CSS 定位用）。
 * 因为标注用左下角 + 宽高表示,需先算出四个角再取屏幕边界框。
 */
export function pdfRectToScreen(
  pdfX: number,
  pdfY: number,
  pdfW: number,
  pdfH: number,
  meta: PageRenderMeta,
): { left: number; top: number; width: number; height: number } {
  const tl = pdfToScreen(pdfX, pdfY + pdfH, meta); // PDF 左上角
  const br = pdfToScreen(pdfX + pdfW, pdfY, meta); // PDF 右下角
  const left = Math.min(tl.x, br.x);
  const top = Math.min(tl.y, br.y);
  const width = Math.abs(br.x - tl.x);
  const height = Math.abs(br.y - tl.y);
  return { left, top, width, height };
}

/**
 * 将屏幕拖拽矩形(左上 + 宽高)转换为 PDF 矩形(左下 + 宽高)。
 */
export function screenRectToPdf(
  left: number,
  top: number,
  width: number,
  height: number,
  meta: PageRenderMeta,
): { x: number; y: number; width: number; height: number } {
  const tl = screenToPdf(left, top, meta);        // 屏幕左上 -> PDF
  const br = screenToPdf(left + width, top + height, meta); // 屏幕右下 -> PDF
  const x = Math.min(tl.x, br.x);
  const yBottom = Math.min(tl.y, br.y);           // PDF 较小的 y = 底边
  return {
    x,
    y: yBottom,
    width: Math.abs(br.x - tl.x),
    height: Math.abs(br.y - tl.y),
  };
}
