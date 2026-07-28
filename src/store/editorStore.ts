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
  selectPage: (pageId: string, ctrl: boolean, shift: boolean) => void;
  clearSelection: () => void;
  movePages: (pageIds: string[], toIndex: number) => void;
}

let docCounter = 0;

export const useEditorStore = create<EditorState>((set, get) => ({
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

  selectPage: (pageId, ctrl, shift) => {
    const { pages, selection, lastSelectedId } = get();
    if (shift && lastSelectedId) {
      const ids = pages.map((p) => p.id);
      const start = ids.indexOf(lastSelectedId);
      const end = ids.indexOf(pageId);
      if (start === -1 || end === -1) return;
      const [from, to] = start < end ? [start, end] : [end, start];
      const range = ids.slice(from, to + 1);
      set({ selection: new Set([...selection, ...range]) });
    } else if (ctrl) {
      const next = new Set(selection);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      set({ selection: next, lastSelectedId: pageId });
    } else {
      set({ selection: new Set([pageId]), lastSelectedId: pageId });
    }
  },

  clearSelection: () => set({ selection: new Set(), lastSelectedId: null }),

  movePages: (pageIds, toIndex) => {
    const { pages } = get();
    const fromIndices = pageIds
      .map((id) => pages.findIndex((p) => p.id === id))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);
    if (fromIndices.length === 0) return;

    const movingPages = fromIndices.map((i) => pages[i]);
    const remaining = pages.filter((p) => !pageIds.includes(p.id));

    // toIndex 指向原 pages 中的目标页;将移动块插入到该目标页之后。
    // 若目标页不存在或自身被移动,则插入末尾。
    const targetId = pages[toIndex]?.id;
    let insertAt = remaining.length;
    if (targetId) {
      const targetInRemaining = remaining.findIndex((p) => p.id === targetId);
      if (targetInRemaining !== -1) {
        insertAt = targetInRemaining + 1;
      }
    }

    const newPages = [
      ...remaining.slice(0, insertAt),
      ...movingPages,
      ...remaining.slice(insertAt),
    ];

    const fromStart = fromIndices[0];
    const undo = () => {
      const currentPages = get().pages;
      const movingBack = newPages.filter((p) => pageIds.includes(p.id));
      const stayingBack = currentPages.filter((p) => !pageIds.includes(p.id));
      const result = [...stayingBack];
      result.splice(fromStart, 0, ...movingBack);
      set({ pages: result });
    };

    set((state) => ({
      pages: newPages,
      past: [
        ...state.past,
        { type: 'move' as const, payload: { pageIds, fromIndices, toIndex }, undo },
      ],
      future: [],
    }));
  },
}));
