import type { WorkerRequest, WorkerResponse, PageSpec, DocLoadResult, ApplyAnnotationsPayload, ApplyCropPayload } from './protocol';
import type { AnnoSpec } from '../types/pdf';

interface Pending {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
}

const pending = new Map<string, Pending>();

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const res = e.data;
      const p = pending.get(res.id);
      if (!p) return;
      pending.delete(res.id);
      if (res.ok) {
        p.resolve(res.data);
      } else {
        p.reject(new Error(res.error || 'Worker error'));
      }
    };
  }
  return worker;
}

let nextId = 0;

function request<T = unknown>(
  type: WorkerRequest['type'],
  payload: unknown,
  transfer?: Transferable[],
): Promise<T> {
  const id = String(++nextId);
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (data: unknown) => void, reject });
    const req: WorkerRequest = { id, type, payload } as WorkerRequest;
    getWorker().postMessage(req, transfer ?? []);
  });
}

export const workerClient = {
  loadDoc: (docId: string, buffer: ArrayBuffer) =>
    request<DocLoadResult>('loadDoc', { docId, buffer }, [buffer]),
  exportPdf: (
    pages: Array<{ sourceDocId: string; sourcePageIndex: number; rotation: 0 | 90 | 180 | 270 }>,
  ) => request<ArrayBuffer>('exportPdf', { pages }),
  disposeDoc: (docId: string) => request<null>('disposeDoc', { docId }),
  createDocFromPages: (targetDocId: string, pages: PageSpec[]) =>
    request<DocLoadResult>('createDocFromPages', { targetDocId, pages }),
  insertPagesIntoDoc: (docId: string, insertAt: number, pages: PageSpec[]) =>
    request<DocLoadResult>('insertPagesIntoDoc', { docId, insertAt, pages }),
  applyAnnotations: (docId: string, annotations: AnnoSpec[]) =>
    request<DocLoadResult>('applyAnnotations', { docId, annotations } as ApplyAnnotationsPayload),
  applyCrop: (docId: string, crops: ApplyCropPayload['crops']) =>
    request<DocLoadResult>('applyCrop', { docId, crops } as ApplyCropPayload),
};
