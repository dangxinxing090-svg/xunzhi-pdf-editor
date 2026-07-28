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
  isExporting: boolean;
  error: string | null;

  loadDocument: (path: string, fileName: string) => Promise<void>;
  setPageThumbnail: (pageId: string, bitmap: ImageBitmap) => void;
  setError: (err: string | null) => void;
  selectPage: (pageId: string, ctrl: boolean, shift: boolean) => void;
  clearSelection: () => void;
  movePages: (pageIds: string[], toIndex: number) => void;
  rotatePages: (pageIds: string[], degrees: 90 | 180 | 270) => void;
  deletePages: (pageIds: string[]) => void;
  undo: () => void;
  redo: () => void;
  exportPdf: (mode: 'current' | 'selected' | 'all') => Promise<void>;
  closeDocument: (docId: string) => Promise<void>;
  setActiveDoc: (docId: string) => void;
  insertBlankPage: () => Promise<void>;
  duplicatePages: (pageIds: string[]) => Promise<void>;
  splitToNewDocument: (pageIds: string[]) => Promise<void>;
  saveSelectionAsDoc: (pageIds: string[]) => Promise<void>;
  mergeAllDocuments: () => Promise<void>;
}

let docCounter = 0;
let pageCounter = 0;

function nextDocId(): string {
  return `doc-${++docCounter}`;
}

function nextPageId(): string {
  return `p-${++pageCounter}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  sourceDocs: [],
  pages: [],
  activeDocId: null,
  selection: new Set(),
  lastSelectedId: null,
  past: [],
  future: [],
  isExporting: false,
  error: null,

  loadDocument: async (path, fileName) => {
    try {
      const buffer = await window.electronAPI.readPdf(path);
      const docId = nextDocId();
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
    const { pages, activeDocId } = get();
    // 只在当前活跃文档的页面范围内重排(多文档各自独立)。
    const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
    const fromIndices = pageIds
      .map((id) => docPages.findIndex((p) => p.id === id))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);
    if (fromIndices.length === 0) return;

    const movingPages = fromIndices.map((i) => docPages[i]);
    const remainingDocPages = docPages.filter((p) => !pageIds.includes(p.id));

    // toIndex 指向当前文档视图中的目标页;将移动块插入到该目标页之后。
    const targetId = docPages[toIndex]?.id;
    let insertAt = remainingDocPages.length;
    if (targetId) {
      const targetInRemaining = remainingDocPages.findIndex((p) => p.id === targetId);
      if (targetInRemaining !== -1) {
        insertAt = targetInRemaining + 1;
      }
    }

    const reorderedDocPages = [
      ...remainingDocPages.slice(0, insertAt),
      ...movingPages,
      ...remainingDocPages.slice(insertAt),
    ];

    // 重建全局 pages:用重排后的文档页面替换原位置,保留其他文档页面不变。
    const newPages: Page[] = [];
    let consumed = false;
    for (const p of pages) {
      if (p.sourceDocId === activeDocId) {
        if (!consumed) {
          newPages.push(...reorderedDocPages);
          consumed = true;
        }
        // 跳过原来的该文档页面(已被 reorderedDocPages 替换)
      } else {
        newPages.push(p);
      }
    }

    const fromStart = fromIndices[0];
    const undo = () => {
      const currentDocPages = get().pages.filter((p) => p.sourceDocId === activeDocId);
      const movingBack = reorderedDocPages.filter((p) => pageIds.includes(p.id));
      const stayingBack = currentDocPages.filter((p) => !pageIds.includes(p.id));
      const resultDocPages = [...stayingBack];
      resultDocPages.splice(fromStart, 0, ...movingBack);

      const undonePages: Page[] = [];
      let undoneConsumed = false;
      for (const p of get().pages) {
        if (p.sourceDocId === activeDocId) {
          if (!undoneConsumed) {
            undonePages.push(...resultDocPages);
            undoneConsumed = true;
          }
        } else {
          undonePages.push(p);
        }
      }
      set({ pages: undonePages });
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

  rotatePages: (pageIds, degrees) => {
    const { pages } = get();
    const targetPages = pages.filter((p) => pageIds.includes(p.id));
    const oldRotations = new Map(targetPages.map((p) => [p.id, p.rotation]));

    const newPages = pages.map((p) =>
      pageIds.includes(p.id)
        ? { ...p, rotation: ((p.rotation + degrees) % 360) as 0 | 90 | 180 | 270 }
        : p,
    );

    const undo = () => {
      set((state) => ({
        pages: state.pages.map((p) =>
          oldRotations.has(p.id) ? { ...p, rotation: oldRotations.get(p.id)! } : p,
        ),
      }));
    };

    set((state) => ({
      pages: newPages,
      past: [
        ...state.past,
        { type: 'rotate' as const, payload: { pageIds, degrees }, undo },
      ],
      future: [],
    }));
  },

  deletePages: (pageIds) => {
    const { pages, selection } = get();
    const oldStates = new Map(
      pages.filter((p) => pageIds.includes(p.id)).map((p) => [p.id, p.deleted]),
    );

    const undo = () => {
      set((state) => ({
        pages: state.pages.map((p) =>
          oldStates.has(p.id) ? { ...p, deleted: oldStates.get(p.id)! } : p,
        ),
      }));
    };

    const nextSelection = new Set(selection);
    pageIds.forEach((id) => nextSelection.delete(id));

    set((state) => ({
      pages: pages.map((p) => (pageIds.includes(p.id) ? { ...p, deleted: true } : p)),
      selection: nextSelection,
      past: [
        ...state.past,
        { type: 'delete' as const, payload: { pageIds }, undo },
      ],
      future: [],
    }));
  },

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return;
    const cmd = past[past.length - 1];
    cmd.undo();
    set({
      past: past.slice(0, -1),
      future: [...future, cmd],
    });
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;
    const cmd = future[future.length - 1];
    // 重做 = 重新执行原操作。movePages/rotatePages 会 push past,需在调用后移除多余条目。
    if (cmd.type === 'delete') {
      const { pageIds } = cmd.payload as { pageIds: string[] };
      set((state) => ({
        pages: state.pages.map((p) =>
          pageIds.includes(p.id) ? { ...p, deleted: true } : p,
        ),
      }));
    } else if (cmd.type === 'move') {
      const { pageIds, toIndex } = cmd.payload as {
        pageIds: string[];
        toIndex: number;
      };
      get().movePages(pageIds, toIndex);
      set((state) => ({ past: state.past.slice(0, -1) }));
    } else if (cmd.type === 'rotate') {
      const { pageIds, degrees } = cmd.payload as {
        pageIds: string[];
        degrees: 90 | 180 | 270;
      };
      get().rotatePages(pageIds, degrees);
      set((state) => ({ past: state.past.slice(0, -1) }));
    } else if (cmd.type === 'insert' || cmd.type === 'duplicate') {
      // insert/duplicate 的 undo 不释放 worker 文档,redo 可同步重新插入。
      const { newPages, newDocs, insertIndex } = cmd.payload as {
        newPages: Page[];
        newDocs: SourceDoc[];
        insertIndex?: number;
      };
      set((state) => {
        const pages = [...state.pages];
        const idx = insertIndex ?? pages.length;
        pages.splice(idx, 0, ...newPages);
        return { pages, sourceDocs: [...state.sourceDocs, ...newDocs] };
      });
    } else if (cmd.type === 'split') {
      // split 的 redo:重新移动 pages 到拆分文档(undo 已还原回原文档)
      const { pageIds, toDocId } = cmd.payload as {
        pageIds: string[];
        fromDocId: string;
        toDocId: string;
      };
      set((state) => ({
        pages: state.pages.map((p) =>
          pageIds.includes(p.id) ? { ...p, sourceDocId: toDocId } : p,
        ),
        activeDocId: toDocId,
      }));
    }
    set({
      past: [...past, cmd],
      future: future.slice(0, -1),
    });
  },

  exportPdf: async (mode) => {
    const { pages, selection, activeDocId } = get();
    let exportPages: Page[];
    if (mode === 'current') {
      exportPages = pages.filter((p) => p.sourceDocId === activeDocId && !p.deleted);
    } else if (mode === 'selected') {
      exportPages = pages.filter((p) => selection.has(p.id) && !p.deleted);
    } else {
      exportPages = pages.filter((p) => !p.deleted);
    }
    if (exportPages.length === 0) {
      set({ error: '没有可导出的页面' });
      return;
    }

    set({ isExporting: true, error: null });
    try {
      const savePath = await window.electronAPI.savePdfDialog();
      if (!savePath) {
        set({ isExporting: false });
        return;
      }
      const workerPages = exportPages.map((p) => ({
        sourceDocId: p.sourceDocId,
        sourcePageIndex: p.sourcePageIndex,
        rotation: p.rotation,
      }));
      const buffer = await workerClient.exportPdf(workerPages);
      await window.electronAPI.writePdf(savePath, buffer);
      set({ isExporting: false });
    } catch (err) {
      set({ isExporting: false, error: String(err) });
    }
  },

  closeDocument: async (docId) => {
    const { pages, selection, sourceDocs, activeDocId } = get();
    // 找到该文档的所有页面,释放其 ImageBitmap
    const removedPages = pages.filter((p) => p.sourceDocId === docId);
    removedPages.forEach((p) => {
      if (p.thumbnail) p.thumbnail.close();
    });
    const removedIds = new Set(removedPages.map((p) => p.id));

    const remainingPages = pages.filter((p) => p.sourceDocId !== docId);
    const remainingDocs = sourceDocs.filter((d) => d.id !== docId);
    const remainingSelection = new Set(
      [...selection].filter((id) => !removedIds.has(id)),
    );
    // 若关闭的是当前活跃文档,切到剩余的第一个(或 null)
    const nextActive =
      activeDocId === docId
        ? remainingDocs[0]?.id ?? null
        : activeDocId;

    set({
      pages: remainingPages,
      sourceDocs: remainingDocs,
      selection: remainingSelection,
      lastSelectedId: removedIds.has(selection.values().next().value ?? '')
        ? null
        : get().lastSelectedId,
      activeDocId: nextActive,
      // 历史栈中可能引用已删除页面,清空避免撤销到无效状态
      past: [],
      future: [],
    });

    // 通知 Worker 释放该文档的 pdf-lib/pdf.js 文档与缩略图缓存
    try {
      await workerClient.disposeDoc(docId);
    } catch {
      // 文档可能从未成功加载,忽略释放错误
    }
  },

  setActiveDoc: (docId) => {
    // 切换文档时清空选择(选择作用于当前文档视图)
    set({ activeDocId: docId, selection: new Set(), lastSelectedId: null });
  },

  insertBlankPage: async () => {
    const { pages, selection, activeDocId } = get();
    // 确定尺寸:选中页的尺寸,或默认 A4
    let width = 595;
    let height = 842;
    let insertIndex = pages.length; // 默认末尾
    if (selection.size > 0) {
      const selPage = pages.find((p) => selection.has(p.id));
      if (selPage) {
        width = selPage.width;
        height = selPage.height;
        insertIndex = pages.indexOf(selPage) + 1;
      }
    } else if (activeDocId) {
      // 无选中:插到当前文档最后一页之后
      const lastInDoc = [...pages].reverse().find((p) => p.sourceDocId === activeDocId);
      if (lastInDoc) insertIndex = pages.indexOf(lastInDoc) + 1;
    }

    const syntheticDocId = nextDocId();
    const meta = await workerClient.createDocFromPages(syntheticDocId, [
      { blank: true, width, height },
    ]);

    const newPage: Page = {
      id: nextPageId(),
      sourceDocId: syntheticDocId,
      sourcePageIndex: 0,
      rotation: 0,
      width: meta.pages[0].width,
      height: meta.pages[0].height,
      thumbnail: null,
      deleted: false,
    };
    const newDoc: SourceDoc = {
      id: syntheticDocId,
      fileName: '空白页',
      pageCount: 1,
    };

    const newPages = [...pages];
    newPages.splice(insertIndex, 0, newPage);

    const undo = () => {
      // 不 dispose 合成文档:redo 需要重新引用它(避免再次异步调用 worker)。
      // 文档关闭时会统一释放。
      set((state) => ({
        pages: state.pages.filter((p) => p.id !== newPage.id),
        sourceDocs: state.sourceDocs.filter((d) => d.id !== syntheticDocId),
      }));
    };

    set((state) => ({
      pages: newPages,
      sourceDocs: [...state.sourceDocs, newDoc],
      past: [
        ...state.past,
        {
          type: 'insert' as const,
          payload: { newPages: [newPage], newDocs: [newDoc], insertIndex },
          undo,
        },
      ],
      future: [],
    }));
  },

  duplicatePages: async (pageIds) => {
    const { pages } = get();
    // 按在 pages 中的顺序取选中页(保持副本插入顺序)
    const sourcePages = pages.filter((p) => pageIds.includes(p.id));
    if (sourcePages.length === 0) return;

    const syntheticDocId = nextDocId();
    const specs = sourcePages.map((p) => ({
      sourceDocId: p.sourceDocId,
      sourcePageIndex: p.sourcePageIndex,
      rotation: p.rotation,
    }));
    const meta = await workerClient.createDocFromPages(syntheticDocId, specs);

    // 为每个选中页生成一个副本 Page,插入到原页之后
    const newPages: Page[] = [];
    const resultPages = [...pages];
    sourcePages.forEach((srcPage, i) => {
      const dup: Page = {
        id: nextPageId(),
        sourceDocId: syntheticDocId,
        sourcePageIndex: i,
        rotation: srcPage.rotation,
        width: meta.pages[i].width,
        height: meta.pages[i].height,
        thumbnail: null,
        deleted: false,
      };
      newPages.push(dup);
      const srcIdx = resultPages.indexOf(srcPage);
      resultPages.splice(srcIdx + 1, 0, dup);
    });
    const newDoc: SourceDoc = {
      id: syntheticDocId,
      fileName: '副本',
      pageCount: newPages.length,
    };

    const undo = () => {
      const dupIds = new Set(newPages.map((p) => p.id));
      set((state) => ({
        pages: state.pages.filter((p) => !dupIds.has(p.id)),
        sourceDocs: state.sourceDocs.filter((d) => d.id !== syntheticDocId),
      }));
    };

    set((state) => ({
      pages: resultPages,
      sourceDocs: [...state.sourceDocs, newDoc],
      past: [
        ...state.past,
        {
          type: 'duplicate' as const,
          payload: { newPages, newDocs: [newDoc], insertIndex: undefined },
          undo,
        },
      ],
      future: [],
    }));
  },

  splitToNewDocument: async (pageIds) => {
    const { pages, sourceDocs, activeDocId } = get();
    const movingPages = pages.filter((p) => pageIds.includes(p.id) && !p.deleted);
    if (movingPages.length === 0) return;
    const fromDocId = activeDocId!;

    const toDocId = nextDocId();
    const specs = movingPages.map((p) => ({
      sourceDocId: p.sourceDocId,
      sourcePageIndex: p.sourcePageIndex,
      rotation: p.rotation,
    }));
    const meta = await workerClient.createDocFromPages(toDocId, specs);

    // 选中页的 sourceDocId 改为新文档,pageIndex 重新编序
    const newPages = pages.map((p) => {
      const idx = movingPages.indexOf(p);
      if (idx === -1) return p;
      return {
        ...p,
        sourceDocId: toDocId,
        sourcePageIndex: idx,
        width: meta.pages[idx].width,
        height: meta.pages[idx].height,
      };
    });
    const newDoc: SourceDoc = {
      id: toDocId,
      fileName: `拆分自 ${sourceDocs.find((d) => d.id === fromDocId)?.fileName ?? '文档'}`,
      pageCount: movingPages.length,
    };

    const undo = () => {
      set((state) => ({
        pages: state.pages.map((p) =>
          pageIds.includes(p.id) ? { ...p, sourceDocId: fromDocId } : p,
        ),
        sourceDocs: state.sourceDocs.filter((d) => d.id !== toDocId),
        activeDocId: fromDocId,
      }));
    };

    set((state) => ({
      pages: newPages,
      sourceDocs: [...state.sourceDocs, newDoc],
      activeDocId: toDocId,
      selection: new Set(),
      lastSelectedId: null,
      past: [
        ...state.past,
        {
          type: 'split' as const,
          payload: { pageIds, fromDocId, toDocId },
          undo,
        },
      ],
      future: [],
    }));
  },

  saveSelectionAsDoc: async (pageIds) => {
    const { pages } = get();
    const sourcePages = pages.filter((p) => pageIds.includes(p.id) && !p.deleted);
    if (sourcePages.length === 0) return;

    const toDocId = nextDocId();
    const specs = sourcePages.map((p) => ({
      sourceDocId: p.sourceDocId,
      sourcePageIndex: p.sourcePageIndex,
      rotation: p.rotation,
    }));
    const meta = await workerClient.createDocFromPages(toDocId, specs);

    // 复制选中页为新文档的页面(不从原文档移除)
    const newPages: Page[] = sourcePages.map((src, i) => ({
      id: nextPageId(),
      sourceDocId: toDocId,
      sourcePageIndex: i,
      rotation: src.rotation,
      width: meta.pages[i].width,
      height: meta.pages[i].height,
      thumbnail: null,
      deleted: false,
    }));
    const newDoc: SourceDoc = {
      id: toDocId,
      fileName: `另存 ${sourcePages.length}页`,
      pageCount: sourcePages.length,
    };

    set((state) => ({
      pages: [...state.pages, ...newPages],
      sourceDocs: [...state.sourceDocs, newDoc],
      activeDocId: toDocId,
      selection: new Set(),
      lastSelectedId: null,
    }));
    // 不推入历史(另存为是复制操作,不易撤销;如需可后续补充)
  },

  mergeAllDocuments: async () => {
    const { pages, sourceDocs } = get();
    const allPages = pages.filter((p) => !p.deleted);
    if (sourceDocs.length < 2 || allPages.length === 0) return;

    const toDocId = nextDocId();
    const specs = allPages.map((p) => ({
      sourceDocId: p.sourceDocId,
      sourcePageIndex: p.sourcePageIndex,
      rotation: p.rotation,
    }));
    const meta = await workerClient.createDocFromPages(toDocId, specs);

    const newPages: Page[] = allPages.map((src, i) => ({
      id: nextPageId(),
      sourceDocId: toDocId,
      sourcePageIndex: i,
      rotation: src.rotation,
      width: meta.pages[i].width,
      height: meta.pages[i].height,
      thumbnail: null,
      deleted: false,
    }));
    const newDoc: SourceDoc = {
      id: toDocId,
      fileName: '合并文档',
      pageCount: allPages.length,
    };

    set((state) => ({
      pages: [...state.pages, ...newPages],
      sourceDocs: [...state.sourceDocs, newDoc],
      activeDocId: toDocId,
      selection: new Set(),
      lastSelectedId: null,
    }));
  },
}));
