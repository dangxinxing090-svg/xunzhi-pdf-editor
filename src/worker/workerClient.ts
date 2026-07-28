import type { WorkerRequest, WorkerResponse } from './protocol';

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
    request<{ pageCount: number; pages: Array<{ width: number; height: number }> }>(
      'loadDoc',
      { docId, buffer },
      [buffer],
    ),
  renderThumb: (docId: string, pageIndex: number) =>
    request<ImageBitmap>('renderThumb', { docId, pageIndex }),
  exportPdf: (
    pages: Array<{ sourceDocId: string; sourcePageIndex: number; rotation: 0 | 90 | 180 | 270 }>,
  ) => request<ArrayBuffer>('exportPdf', { pages }),
};
