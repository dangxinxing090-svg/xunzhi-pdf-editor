import type { AnnoSpec } from '../types/pdf';

export type WorkerRequestType =
  | 'loadDoc' | 'exportPdf' | 'disposeDoc' | 'createDocFromPages' | 'insertPagesIntoDoc'
  | 'applyAnnotations' | 'applyCrop';

export interface WorkerRequest {
  id: string;
  type: WorkerRequestType;
  payload:
    | LoadDocPayload
    | ExportPdfPayload
    | DisposeDocPayload
    | CreateDocFromPagesPayload
    | InsertPagesIntoDocPayload
    | ApplyAnnotationsPayload
    | ApplyCropPayload;
}

export interface LoadDocPayload {
  docId: string;
  buffer: ArrayBuffer;
}

export interface ExportPdfPayload {
  pages: Array<{
    sourceDocId: string;
    sourcePageIndex: number;
    rotation: 0 | 90 | 180 | 270;
  }>;
}

export interface DisposeDocPayload {
  docId: string;
}

/** 构建合成文档的单页规格:引用已有源页 或 空白页。 */
export type PageSpec =
  | { sourceDocId: string; sourcePageIndex: number; rotation: 0 | 90 | 180 | 270 }
  | { blank: true; width: number; height: number };

export interface CreateDocFromPagesPayload {
  targetDocId: string;
  pages: PageSpec[];
}

/** 在已有文档的指定位置插入页面(空白或拷贝自其他文档)。 */
export interface InsertPagesIntoDocPayload {
  docId: string;
  insertAt: number;  // 插入到此索引之前(0=最前)
  pages: PageSpec[];
}

/** 烘焙标注到文档:在指定页上绘制矩形/椭圆/高亮/文本/图片等。 */
export interface ApplyAnnotationsPayload {
  docId: string;
  annotations: AnnoSpec[];
}

/** 裁剪:设置指定页的裁剪框(setCropBox)。 */
export interface ApplyCropPayload {
  docId: string;
  crops: Array<{ pageIndex: number; x: number; y: number; width: number; height: number }>;
}

export interface WorkerResponse {
  id: string;
  ok: boolean;
  data?: any;
  error?: string;
  transfer?: Transferable[];
}

export interface LoadDocResult {
  pageCount: number;
  pages: Array<{ width: number; height: number; rotation: 0 | 90 | 180 | 270 }>;
}

/** loadDoc / createDocFromPages 返回:元数据 + 供主线程 pdf.js 渲染的字节。 */
export interface DocLoadResult {
  meta: LoadDocResult;
  renderBuffer: ArrayBuffer;
}
