import { create } from 'zustand';
import type { Page, SourceDoc, Command, EditorMode, Annotation, ContentTool, AnnoSpec } from '../types/pdf';
import { workerClient } from '../worker/workerClient';
import { loadPdfForRender, disposeRenderDoc } from '../lib/pdfRenderer';

interface EditorState {
  sourceDocs: SourceDoc[];
  pages: Page[];
  activeDocId: string | null;
  selection: Set<string>;
  lastSelectedId: string | null;
  selectedDocIds: Set<string>;
  past: Command[];
  future: Command[];
  isExporting: boolean;
  error: string | null;
  mode: EditorMode;
  zoom: number;
  currentPageIndex: number;
  activeTool: ContentTool;
  annotations: Record<string, Annotation[]>; // pageId -> annotations
  selectedAnnoId: string | null;
  cropDraft: { pageId: string; rect: { x: number; y: number; width: number; height: number } } | null;

  setMode: (mode: EditorMode) => void;
  setZoom: (zoom: number) => void;
  setCurrentPageIndex: (index: number) => void;
  setActiveTool: (tool: ContentTool) => void;
  addAnnotation: (anno: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  clearAnnotationsForPage: (pageId: string) => void;
  clearAllAnnotations: () => void;
  applyAnnotations: () => Promise<void>;
  applyCrop: () => Promise<void>;
  addWatermark: (opts: { text: string; fontSize: number; opacity: number; rotation: number; color: string; scope: 'all' | 'current' }) => void;
  addHeaderFooter: (opts: { type: 'header' | 'footer'; text: string; fontSize: number; color: string }) => void;

  loadDocument: (path: string, fileName: string) => Promise<void>;
  setPageThumbnail: (pageId: string, dataUrl: string) => void;
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
  selectDoc: (docId: string, ctrl: boolean) => void;
  moveDocUp: (docId: string) => void;
  moveDocDown: (docId: string) => void;
  saveDocAs: (docId: string) => Promise<void>;
  renameDocument: (docId: string, newName: string) => Promise<void>;
  insertBlankPage: () => Promise<void>;
  duplicatePages: (pageIds: string[]) => Promise<void>;
  splitToNewDocument: (pageIds: string[]) => Promise<void>;
  saveSelectionAsDoc: (pageIds: string[]) => Promise<void>;
  mergeAllDocuments: () => Promise<void>;
  mergeDocuments: (docIds: string[]) => Promise<void>;
}

let docCounter = 0;
let pageCounter = 0;
let storeAnnoCounter = 0;

function nextDocId(): string {
  return `doc-${++docCounter}`;
}

function nextPageId(): string {
  return `p-${++pageCounter}`;
}

function nextStoreAnnoId(): string {
  return `sa-${++storeAnnoCounter}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  sourceDocs: [],
  pages: [],
  activeDocId: null,
  selection: new Set(),
  lastSelectedId: null,
  selectedDocIds: new Set(),
  past: [],
  future: [],
  isExporting: false,
  error: null,
  mode: 'read',
  zoom: 1.0,
  currentPageIndex: 0,
  activeTool: 'select',
  annotations: {},
  selectedAnnoId: null,
  cropDraft: null,

  setMode: (mode) => set({ mode, activeTool: 'select', selectedAnnoId: null }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  setCurrentPageIndex: (index) => set({ currentPageIndex: index }),
  setActiveTool: (tool) => set({ activeTool: tool, selectedAnnoId: null }),

  addAnnotation: (anno) =>
    set((state) => ({
      annotations: {
        ...state.annotations,
        [anno.pageId]: [...(state.annotations[anno.pageId] ?? []), anno],
      },
      selectedAnnoId: anno.id,
    })),

  updateAnnotation: (id, patch) =>
    set((state) => ({
      annotations: Object.fromEntries(
        Object.entries(state.annotations).map(([pageId, list]) => [
          pageId,
          list.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
        ]),
      ),
    })),

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: Object.fromEntries(
        Object.entries(state.annotations).map(([pageId, list]) => [
          pageId,
          list.filter((a) => a.id !== id),
        ]),
      ),
      selectedAnnoId: state.selectedAnnoId === id ? null : state.selectedAnnoId,
    })),

  selectAnnotation: (id) => set({ selectedAnnoId: id }),

  clearAnnotationsForPage: (pageId) =>
    set((state) => {
      const next = { ...state.annotations };
      delete next[pageId];
      return { annotations: next };
    }),

  clearAllAnnotations: () => set({ annotations: {}, selectedAnnoId: null }),

  applyAnnotations: async () => {
    const { annotations, pages, activeDocId } = get();
    if (!activeDocId) return;
    // 收集活动文档所有页的标注,转成 AnnoSpec(pageIndex 替代 pageId)
    const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
    const specs: AnnoSpec[] = [];
    for (const page of docPages) {
      const list = annotations[page.id] ?? [];
      for (const a of list) {
        const spec: AnnoSpec = {
          pageIndex: page.sourcePageIndex,
          type: a.type,
          x: a.x, y: a.y, width: a.width, height: a.height,
        };
        if (a.type === 'rect' || a.type === 'ellipse') {
          spec.stroke = a.stroke; spec.strokeWidth = a.strokeWidth; spec.fill = a.fill;
        } else if (a.type === 'highlight') {
          spec.color = a.color; spec.opacity = a.opacity;
        } else if (a.type === 'image') {
          spec.imageDataUrl = a.dataUrl;
        } else {
          // text/watermark/header/footer
          const t = a as import('../types/pdf').TextAnno;
          spec.text = t.text; spec.color = t.color; spec.fontSize = t.fontSize;
          spec.rotation = t.rotation; spec.opacity = t.opacity;
        }
        specs.push(spec);
      }
    }
    if (specs.length === 0) {
      set({ error: '没有可应用的标注' });
      return;
    }

    try {
      const { renderBuffer } = await workerClient.applyAnnotations(activeDocId, specs);
      // 重载 pdf.js 渲染文档(内容已烘焙)
      disposeRenderDoc(activeDocId);
      await loadPdfForRender(activeDocId, renderBuffer);
      // 清空已应用的标注(已固化进 PDF),保留未应用的(此处全部已应用)
      set({ annotations: {}, selectedAnnoId: null, error: null });
    } catch (err) {
      set({ error: `应用标注失败:${String(err)}` });
    }
  },

  applyCrop: async () => {
    const { cropDraft, pages, activeDocId } = get();
    if (!activeDocId || !cropDraft) return;
    const page = pages.find((p) => p.id === cropDraft.pageId);
    if (!page) return;
    try {
      const { renderBuffer } = await workerClient.applyCrop(activeDocId, [
        { pageIndex: page.sourcePageIndex, ...cropDraft.rect },
      ]);
      disposeRenderDoc(activeDocId);
      await loadPdfForRender(activeDocId, renderBuffer);
      set({ cropDraft: null, error: null });
    } catch (err) {
      set({ error: `裁剪失败:${String(err)}` });
    }
  },

  addWatermark: ({ text, fontSize, opacity, rotation, color, scope }) => {
    const { pages, activeDocId, currentPageIndex } = get();
    if (!activeDocId) return;
    const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
    const targetPages = scope === 'all' ? docPages : [docPages[currentPageIndex]].filter(Boolean);
    const newAnnos: Record<string, Annotation[]> = {};
    for (const page of targetPages) {
      // 水印居中:以页面中心为锚点
      const w = text.length * fontSize * 0.6;
      const h = fontSize;
      const anno: Annotation = {
        id: nextStoreAnnoId(),
        pageId: page.id,
        type: 'watermark',
        x: (page.width - w) / 2,
        y: (page.height - h) / 2,
        width: w, height: h,
        text, color, fontSize, opacity, rotation,
      } as import('../types/pdf').TextAnno;
      newAnnos[page.id] = [...(get().annotations[page.id] ?? []), anno];
    }
    set((state) => ({ annotations: { ...state.annotations, ...newAnnos } }));
  },

  addHeaderFooter: ({ type, text, fontSize, color }) => {
    const { pages, activeDocId } = get();
    if (!activeDocId) return;
    const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
    const margin = 36; // 0.5 inch 边距
    const newAnnos: Record<string, Annotation[]> = {};
    for (const page of docPages) {
      const w = text.length * fontSize * 0.6;
      const anno: Annotation = {
        id: nextStoreAnnoId(),
        pageId: page.id,
        type,
        x: (page.width - w) / 2,
        y: type === 'header' ? page.height - margin - fontSize : margin,
        width: w, height: fontSize,
        text, color, fontSize,
      } as import('../types/pdf').TextAnno;
      newAnnos[page.id] = [...(get().annotations[page.id] ?? []), anno];
    }
    set((state) => ({ annotations: { ...state.annotations, ...newAnnos } }));
  },

  loadDocument: async (path, fileName) => {
    try {
      const buffer = await window.electronAPI.readPdf(path);
      const docId = nextDocId();
      const { meta, renderBuffer } = await workerClient.loadDoc(docId, buffer);
      // 主线程加载 pdf.js 文档用于渲染缩略图
      await loadPdfForRender(docId, renderBuffer);

      const doc: SourceDoc = {
        id: docId,
        fileName,
        pageCount: meta.pageCount,
        filePath: path,
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
        mode: 'read',
        currentPageIndex: 0,
        zoom: 1.0,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  setPageThumbnail: (pageId, dataUrl) => {
    set((state) => ({
      pages: state.pages.map((p) => (p.id === pageId ? { ...p, thumbnail: dataUrl } : p)),
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
    // 硬删除:从 pages 数组移除,记录被删页及其原始位置以便撤销
    const removedPages: Array<{ page: Page; index: number }> = [];
    const idSet = new Set(pageIds);
    const remaining: Page[] = [];
    pages.forEach((p, i) => {
      if (idSet.has(p.id)) {
        removedPages.push({ page: p, index: i });
      } else {
        remaining.push(p);
      }
    });

    const undo = () => {
      // 按原始索引插回
      set((state) => {
        const result = [...state.pages];
        // 按 index 升序插入(同位置连续插入保持原顺序)
        removedPages.sort((a, b) => a.index - b.index);
        for (const { page, index } of removedPages) {
          result.splice(index, 0, page);
        }
        return { pages: result };
      });
    };

    const nextSelection = new Set(selection);
    pageIds.forEach((id) => nextSelection.delete(id));

    set((state) => ({
      pages: remaining,
      selection: nextSelection,
      past: [
        ...state.past,
        { type: 'delete' as const, payload: { pageIds, removedPages }, undo },
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
      // 硬删除重做:再次从 pages 移除这些页
      const { pageIds } = cmd.payload as { pageIds: string[] };
      const idSet = new Set(pageIds);
      set((state) => ({
        pages: state.pages.filter((p) => !idSet.has(p.id)),
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
    } else if (cmd.type === 'insert') {
      // insert 涉及 worker 异步操作,redo 重新调用 insertBlankPage。
      // 先从 future 弹出(异步操作会自己 push past)。
      set({ future: future.slice(0, -1) });
      void get().insertBlankPage();
      return;
    } else if (cmd.type === 'duplicate') {
      const { pageIds } = cmd.payload as { pageIds: string[] };
      set({ future: future.slice(0, -1) });
      void get().duplicatePages(pageIds);
      return;
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
    const { pages, selection, sourceDocs, activeDocId, selectedDocIds } = get();
    // 找到该文档的所有页面
    const removedPages = pages.filter((p) => p.sourceDocId === docId);
    const removedIds = new Set(removedPages.map((p) => p.id));

    const remainingPages = pages.filter((p) => p.sourceDocId !== docId);
    const remainingDocs = sourceDocs.filter((d) => d.id !== docId);
    const remainingSelection = new Set(
      [...selection].filter((id) => !removedIds.has(id)),
    );
    const remainingSelectedDocs = new Set(
      [...selectedDocIds].filter((id) => id !== docId),
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
      selectedDocIds: remainingSelectedDocs,
      lastSelectedId: removedIds.has(selection.values().next().value ?? '')
        ? null
        : get().lastSelectedId,
      activeDocId: nextActive,
      // 历史栈中可能引用已删除页面,清空避免撤销到无效状态
      past: [],
      future: [],
    });

    // 通知 Worker 释放 pdf-lib 文档,主线程释放 pdf.js 渲染文档
    try {
      await workerClient.disposeDoc(docId);
      disposeRenderDoc(docId);
    } catch {
      // 文档可能从未成功加载,忽略释放错误
    }
  },

  setActiveDoc: (docId) => {
    // 切换文档时清空选择(选择作用于当前文档视图)
    set({ activeDocId: docId, selection: new Set(), lastSelectedId: null, currentPageIndex: 0, zoom: 1.0 });
  },

  selectDoc: (docId, ctrl) => {
    // Ctrl/Cmd+点击 多选文档(Set 保序 -> 合并顺序 = 用户点击顺序);
    // 普通点击单选该文档并设为 active(与 setActiveDoc 一致)。
    if (ctrl) {
      const next = new Set(get().selectedDocIds);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      set({ selectedDocIds: next });
    } else {
      set({
        activeDocId: docId,
        selectedDocIds: new Set([docId]),
        selection: new Set(),
        lastSelectedId: null,
        currentPageIndex: 0,
        zoom: 1.0,
      });
    }
  },

  moveDocUp: (docId) => {
    const { sourceDocs, pages } = get();
    const i = sourceDocs.findIndex((d) => d.id === docId);
    if (i <= 0) return;
    // 交换 sourceDocs 中相邻两个文档
    const swapped = sourceDocs.slice();
    [swapped[i - 1], swapped[i]] = [swapped[i], swapped[i - 1]];
    // 同步重排 pages:按新 sourceDocs 顺序重新拼接各文档的页面块
    const newPages = swapped.flatMap((d) =>
      pages.filter((p) => p.sourceDocId === d.id),
    );
    set({ sourceDocs: swapped, pages: newPages });
  },

  moveDocDown: (docId) => {
    const { sourceDocs, pages } = get();
    const i = sourceDocs.findIndex((d) => d.id === docId);
    if (i === -1 || i >= sourceDocs.length - 1) return;
    const swapped = sourceDocs.slice();
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    const newPages = swapped.flatMap((d) =>
      pages.filter((p) => p.sourceDocId === d.id),
    );
    set({ sourceDocs: swapped, pages: newPages });
  },

  saveDocAs: async (docId) => {
    const { pages, sourceDocs } = get();
    const docPages = pages.filter((p) => p.sourceDocId === docId && !p.deleted);
    if (docPages.length === 0) {
      set({ error: '没有可导出的页面' });
      return;
    }
    const doc = sourceDocs.find((d) => d.id === docId);
    const defaultName = doc ? `${doc.fileName}.pdf` : undefined;

    set({ isExporting: true, error: null });
    try {
      const savePath = await window.electronAPI.savePdfDialog(defaultName);
      if (!savePath) {
        set({ isExporting: false });
        return;
      }
      const workerPages = docPages.map((p) => ({
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

  renameDocument: async (docId, newName) => {
    const { sourceDocs } = get();
    const doc = sourceDocs.find((d) => d.id === docId);
    if (!doc || !doc.filePath) return; // 内存文档(合并/拆分/另存)不可重命名

    // 清理输入:去空格,拦截路径分隔符与父目录引用防注入
    const cleaned = newName.trim().replace(/\.pdf$/i, '').trim();
    if (!cleaned || /[\\/\u0000]/.test(cleaned) || cleaned === '.' || cleaned === '..') {
      set({ error: '文件名无效' });
      return;
    }
    const fileNameWithExt = `${cleaned}.pdf`;

    // 新路径 = 原文件所在目录 + 新文件名
    const sep = doc.filePath.includes('\\') ? '\\' : '/';
    const dir = doc.filePath.slice(0, doc.filePath.lastIndexOf(sep));
    const newPath = `${dir}${sep}${fileNameWithExt}`;
    if (newPath === doc.filePath) return; // 名字没变

    try {
      await window.electronAPI.renameFile(doc.filePath, newPath);
      set((state) => ({
        sourceDocs: state.sourceDocs.map((d) =>
          d.id === docId ? { ...d, fileName: cleaned, filePath: newPath } : d,
        ),
        error: null,
      }));
    } catch (err) {
      set({ error: `重命名失败:${String(err)}` });
    }
  },

  insertBlankPage: async () => {
    const { pages, selection, activeDocId } = get();
    if (!activeDocId) return;
    // 确定尺寸:选中页的尺寸,或默认 A4
    let width = 595;
    let height = 842;
    let insertAt = 0; // 默认最前
    if (selection.size > 0) {
      const selPage = pages.find((p) => selection.has(p.id) && p.sourceDocId === activeDocId);
      if (selPage) {
        width = selPage.width;
        height = selPage.height;
        // 插入到选中页前面 = 该页在文档中的索引
        const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
        insertAt = docPages.indexOf(selPage);
      }
    }

    const { meta, renderBuffer } = await workerClient.insertPagesIntoDoc(
      activeDocId, insertAt, [{ blank: true, width, height }],
    );
    // 重新加载 pdf.js 渲染文档(页面索引已变)
    disposeRenderDoc(activeDocId);
    await loadPdfForRender(activeDocId, renderBuffer);

    // 重建当前文档的 Page 列表:索引按新顺序重排,新页插入对应位置
    const newPageId = nextPageId();
    const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
    const otherPages = pages.filter((p) => p.sourceDocId !== activeDocId);

    const newPage: Page = {
      id: newPageId,
      sourceDocId: activeDocId,
      sourcePageIndex: insertAt,
      rotation: 0,
      width: meta.pages[insertAt].width,
      height: meta.pages[insertAt].height,
      thumbnail: null,
      deleted: false,
    };
    // 原有页的 sourcePageIndex 需调整:>=insertAt 的后移一位
    const shiftedDocPages = docPages.map((p) => {
      const newIdx = p.sourcePageIndex >= insertAt ? p.sourcePageIndex + 1 : p.sourcePageIndex;
      return { ...p, sourcePageIndex: newIdx, thumbnail: null }; // 缩略图失效需重渲染
    });
    const reorderedDocPages = [
      ...shiftedDocPages.slice(0, insertAt),
      newPage,
      ...shiftedDocPages.slice(insertAt),
    ];

    const undo = () => {
      // 撤销:还原原文档页面顺序(移除新页,恢复原 pageIndex)
      // 注意:worker 侧的 PDFDocument 已被修改,无法简单回退。
      // 简化:undo 移除新页并恢复 pageIndex,但不回退 worker 文档(导出时会有差异,
      // 但对编辑视图正确)。如需完全正确,需保存修改前的 buffer。
      set((state) => {
        const currentDocPages = state.pages.filter((p) => p.sourceDocId === activeDocId);
        const restored = currentDocPages
          .filter((p) => p.id !== newPageId)
          .map((p) => ({
            ...p,
            sourcePageIndex: p.sourcePageIndex > insertAt ? p.sourcePageIndex - 1 : p.sourcePageIndex,
          }));
        // 保持原文档页面在全局数组中的相对位置
        const result: Page[] = [];
        let inserted = false;
        for (const p of state.pages) {
          if (p.sourceDocId === activeDocId) {
            if (!inserted) {
              result.push(...restored);
              inserted = true;
            }
          } else {
            result.push(p);
          }
        }
        if (!inserted) result.push(...restored);
        return { pages: result };
      });
    };

    set((state) => ({
      pages: [...otherPages, ...reorderedDocPages],
      sourceDocs: state.sourceDocs.map((d) =>
        d.id === activeDocId ? { ...d, pageCount: meta.pageCount } : d,
      ),
      past: [
        ...state.past,
        { type: 'insert' as const, payload: { newPageId, activeDocId, insertAt }, undo },
      ],
      future: [],
    }));
  },

  duplicatePages: async (pageIds) => {
    const { pages, activeDocId } = get();
    if (!activeDocId) return;
    // 选中页按在当前文档中的顺序排列
    const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
    const sourcePages = docPages.filter((p) => pageIds.includes(p.id));
    if (sourcePages.length === 0) return;

    // 插入到第一个选中页前面
    const insertAt = docPages.indexOf(sourcePages[0]);
    const specs = sourcePages.map((p) => ({
      sourceDocId: p.sourceDocId,
      sourcePageIndex: p.sourcePageIndex,
      rotation: p.rotation,
    }));

    const { meta, renderBuffer } = await workerClient.insertPagesIntoDoc(
      activeDocId, insertAt, specs,
    );
    disposeRenderDoc(activeDocId);
    await loadPdfForRender(activeDocId, renderBuffer);

    // 重建当前文档页面:原页 >=insertAt 后移 N 位,新页插入 insertAt..insertAt+N
    const otherPages = pages.filter((p) => p.sourceDocId !== activeDocId);
    const n = sourcePages.length;
    const shiftedDocPages = docPages.map((p) => {
      const newIdx = p.sourcePageIndex >= insertAt ? p.sourcePageIndex + n : p.sourcePageIndex;
      return { ...p, sourcePageIndex: newIdx, thumbnail: null };
    });
    const newPages: Page[] = sourcePages.map((src, i) => ({
      id: nextPageId(),
      sourceDocId: activeDocId,
      sourcePageIndex: insertAt + i,
      rotation: src.rotation,
      width: meta.pages[insertAt + i].width,
      height: meta.pages[insertAt + i].height,
      thumbnail: null,
      deleted: false,
    }));
    const reorderedDocPages = [
      ...shiftedDocPages.slice(0, insertAt),
      ...newPages,
      ...shiftedDocPages.slice(insertAt),
    ];

    const newPageIds = newPages.map((p) => p.id);
    const undo = () => {
      set((state) => {
        const currentDocPages = state.pages.filter((p) => p.sourceDocId === activeDocId);
        const restored = currentDocPages
          .filter((p) => !newPageIds.includes(p.id))
          .map((p) => ({
            ...p,
            sourcePageIndex: p.sourcePageIndex >= insertAt + n
              ? p.sourcePageIndex - n
              : p.sourcePageIndex,
          }));
        const result: Page[] = [];
        let inserted = false;
        for (const p of state.pages) {
          if (p.sourceDocId === activeDocId) {
            if (!inserted) { result.push(...restored); inserted = true; }
          } else {
            result.push(p);
          }
        }
        if (!inserted) result.push(...restored);
        return { pages: result };
      });
    };

    set((state) => ({
      pages: [...otherPages, ...reorderedDocPages],
      sourceDocs: state.sourceDocs.map((d) =>
        d.id === activeDocId ? { ...d, pageCount: meta.pageCount } : d,
      ),
      past: [
        ...state.past,
        { type: 'duplicate' as const, payload: { pageIds, newPageIds, activeDocId, insertAt, n }, undo },
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
    const { meta, renderBuffer } = await workerClient.createDocFromPages(toDocId, specs);
    await loadPdfForRender(toDocId, renderBuffer);

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
      filePath: null,
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
    const { meta, renderBuffer } = await workerClient.createDocFromPages(toDocId, specs);
    await loadPdfForRender(toDocId, renderBuffer);

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
      filePath: null,
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
    const { meta, renderBuffer } = await workerClient.createDocFromPages(toDocId, specs);
    await loadPdfForRender(toDocId, renderBuffer);

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
      filePath: null,
    };

    set((state) => ({
      pages: [...state.pages, ...newPages],
      sourceDocs: [...state.sourceDocs, newDoc],
      activeDocId: toDocId,
      selection: new Set(),
      lastSelectedId: null,
    }));
  },

  mergeDocuments: async (docIds) => {
    const { pages } = get();
    if (docIds.length < 2) return;
    // 按用户选择顺序(传入的 docIds 顺序)gather 各文档页面
    const mergedPages = docIds.flatMap((id) =>
      pages.filter((p) => p.sourceDocId === id && !p.deleted),
    );
    if (mergedPages.length === 0) return;

    const toDocId = nextDocId();
    const specs = mergedPages.map((p) => ({
      sourceDocId: p.sourceDocId,
      sourcePageIndex: p.sourcePageIndex,
      rotation: p.rotation,
    }));
    const { meta, renderBuffer } = await workerClient.createDocFromPages(toDocId, specs);
    await loadPdfForRender(toDocId, renderBuffer);

    const newPages: Page[] = mergedPages.map((src, i) => ({
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
      pageCount: mergedPages.length,
      filePath: null,
    };

    set((state) => ({
      pages: [...state.pages, ...newPages],
      sourceDocs: [...state.sourceDocs, newDoc],
      activeDocId: toDocId,
      selectedDocIds: new Set(),
      selection: new Set(),
      lastSelectedId: null,
    }));
  },
}));
