export type WorkerRequestType = 'loadDoc' | 'renderThumb' | 'exportPdf' | 'disposeDoc';

export interface WorkerRequest {
  id: string;
  type: WorkerRequestType;
  payload: LoadDocPayload | RenderThumbPayload | ExportPdfPayload | DisposeDocPayload;
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
