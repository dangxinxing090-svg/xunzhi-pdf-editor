import { create } from 'zustand';
import type { Page, SourceDoc, Command } from '../types/pdf';
import { workerClient } from '../worker/workerClient';

interface EditorState {
  sourceDocs: SourceDoc[];
  pages: Page[];
  activeDocId: string | null;
  selection: Set<string>;
  lastSelectedId: string | null;
  past: Command[];
  future: Command[];
  loadingThumbs: Set<string>;
  isExporting: boolean;
  error: string | null;

  loadDocument: (path: string, fileName: string) => Promise<void>;
  setPageThumbnail: (pageId: string, bitmap: ImageBitmap) => void;
  setError: (err: string | null) => void;
}

let docCounter = 0;

export const useEditorStore = create<EditorState>((set) => ({
  sourceDocs: [],
  pages: [],
  activeDocId: null,
  selection: new Set(),
  lastSelectedId: null,
  past: [],
  future: [],
  loadingThumbs: new Set(),
  isExporting: false,
  error: null,

  loadDocument: async (path, fileName) => {
    try {
      const buffer = await window.electronAPI.readPdf(path);
      const docId = `doc-${++docCounter}`;
      const meta = await workerClient.loadDoc(docId, buffer);

      const doc: SourceDoc = {
        id: docId,
        fileName,
        pageCount: meta.pageCount,
      };

      const pages: Page[] = meta.pages.map((p, i) => ({
        id: `${docId}-p${i}`,
        sourceDocId: docId,
        sourcePageIndex: i,
        rotation: 0,
        width: p.width,
        height: p.height,
        thumbnail: null,
        deleted: false,
      }));

      set((state) => ({
        sourceDocs: [...state.sourceDocs, doc],
        pages: [...state.pages, ...pages],
        activeDocId: docId,
        error: null,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  setPageThumbnail: (pageId, bitmap) => {
    set((state) => ({
      pages: state.pages.map((p) => (p.id === pageId ? { ...p, thumbnail: bitmap } : p)),
    }));
  },

  setError: (err) => set({ error: err }),
}));
