export type WorkerRequestType = 'loadDoc' | 'renderThumb' | 'exportPdf' | 'disposeDoc' | 'createDocFromPages';

export interface WorkerRequest {
  id: string;
  type: WorkerRequestType;
  payload:
    | LoadDocPayload
    | RenderThumbPayload
    | ExportPdfPayload
    | DisposeDocPayload
    | CreateDocFromPagesPayload;
}

export interface LoadDocPayload {
  docId: string;
  buffer: ArrayBuffer;
}

export interface RenderThumbPayload {
  docId: string;
  pageIndex: number;
  rotation: 0 | 90 | 180 | 270;
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

export interface WorkerResponse {
  id: string;
  ok: boolean;
  data?: any;
  error?: string;
  transfer?: Transferable[];
}

export interface LoadDocResult {
  pageCount: number;
  pages: Array<{ width: number; height: number }>;
}
