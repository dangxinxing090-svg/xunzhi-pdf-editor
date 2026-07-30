// Stub for pdfjs-dist in Node test environment (no DOM).
export const GlobalWorkerOptions = { workerSrc: '', workerPort: null };
export async function getDocument() {
  return { promise: Promise.resolve({}) };
}
