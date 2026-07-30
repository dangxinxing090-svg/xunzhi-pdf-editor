import { create } from 'zustand';
import type { Page, SourceDoc, Command, EditorMode, Annotation, ContentTool, AnnoSpec, MarqueeAnno, ImageAnno } from '../types/pdf';
import { workerClient } from '../worker/workerClient';
import { loadPdfForRender, disposeRenderDoc, renderPageRegionToDataURL } from '../lib/pdfRenderer';
import { resolvePageNumberText } from '../lib/pageNumber';

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
  dirtyDocs: Set<string>; // 有未保存编辑的文档 id(关闭时提醒)

  setMode: (mode: EditorMode) => void;
  setZoom: (zoom: number) => void;
  setCurrentPageIndex: (index: number) => void;
  setActiveTool: (tool: ContentTool) => void;
  addAnnotation: (anno: Annotation) => void;
  /** 圈取"复制":把 marquee 标注范围的 PDF 渲染成图片,立即在原框右侧生成图片标注副本。 */
  copyAnnoAsImage: (annoId: string) => Promise<void>;
  updateAnnotation: (id: string, patch: Partial<Annotation>, opts?: { transient?: boolean }) => void;
  /** 拖拽移动/缩放结束时提交一条合并的历史命令(prev = 拖拽前快照)。无变化时不入栈。 */
  commitAnnotationDrag: (prev: { annotations: Record<string, Annotation[]>; selectedAnnoId: string | null }) => void;
  /** 按类型批量更新水印/页眉/页脚/页码:scope='all' 全部页,'current' 仅 pageId 对应页。transient=true 时不入历史(供批量拖拽逐像素更新,由 commitAnnotationDrag 合并提交)。 */
  updateAnnotationsByType: (type: 'watermark' | 'header' | 'footer' | 'pageNumber', patch: Partial<Annotation>, scope: 'all' | 'current', pageId?: string, opts?: { transient?: boolean }) => void;
  removeAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  clearAnnotationsForPage: (pageId: string) => void;
  clearAllAnnotations: () => void;
  applyAnnotations: () => Promise<void>;
  addWatermark: (opts: { text: string; fontSize: number; opacity: number; rotation: number; color: string; scope: 'all' | 'current' }) => void;
  addHeaderFooter: (opts: { type: 'header' | 'footer'; text: string; fontSize: number; color: string; scope: 'all' | 'current' }) => void;
  /** 页码页脚:template 含 {n}(页码)/{total}(总页数)占位符,渲染与烘焙时解析。align 设初始横向位置,之后可拖动。 */
  addPageNumber: (opts: { template: string; fontSize: number; color: string; align: 'left' | 'center' | 'right'; scope: 'all' | 'current' }) => void;
  removeAnnotationsByType: (type: 'watermark' | 'header' | 'footer' | 'pageNumber', scope: 'all' | 'current', pageId?: string) => void;

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

/**
 * 推入一条标注历史命令(快照式)。
 * prev 为修改前的 {annotations, selectedAnnoId};调用时读取当前(修改后)状态作为 next。
 * undo 恢复 prev,redo 恢复 next。
 */
function pushAnnoCmd(
  set: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState,
  prev: { annotations: Record<string, Annotation[]>; selectedAnnoId: string | null },
): void {
  const next = { annotations: get().annotations, selectedAnnoId: get().selectedAnnoId };
  const cmd: Command = {
    type: 'anno',
    payload: { prev, next },
    undo: () => set({ annotations: prev.annotations, selectedAnnoId: prev.selectedAnnoId }),
  };
  set((state) => ({ past: [...state.past, cmd], future: [] }));
  // 标注编辑作用于当前活动文档,标记为已编辑
  const docId = get().activeDocId;
  if (docId) markDirty(set, docId);
}

/** 标记文档为已编辑(有未保存更改)。 */
function markDirty(set: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void, docId: string): void {
  set((state) => {
    if (state.dirtyDocs.has(docId)) return {};
    const next = new Set(state.dirtyDocs);
    next.add(docId);
    return { dirtyDocs: next };
  });
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
  dirtyDocs: new Set(),

  setMode: (mode) => set({ mode, activeTool: 'select', selectedAnnoId: null }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  setCurrentPageIndex: (index) => set({ currentPageIndex: index }),
  setActiveTool: (tool) => set({ activeTool: tool, selectedAnnoId: null }),

  addAnnotation: (anno) => {
    const prev = { annotations: get().annotations, selectedAnnoId: get().selectedAnnoId };
    set((state) => ({
      annotations: {
        ...state.annotations,
        [anno.pageId]: [...(state.annotations[anno.pageId] ?? []), anno],
      },
      selectedAnnoId: anno.id,
    }));
    pushAnnoCmd(set, get, prev);
  },

  copyAnnoAsImage: async (annoId) => {
    const { pages, annotations } = get();
    // 找到该 marquee 标注及其所属页
    let srcAnno: MarqueeAnno | null = null;
    let page: Page | null = null;
    for (const p of pages) {
      const found = (annotations[p.id] ?? []).find((a) => a.id === annoId);
      if (found && found.type === 'marquee') { srcAnno = found as MarqueeAnno; page = p; break; }
    }
    if (!srcAnno || !page) return;
    const dataUrl = await renderPageRegionToDataURL(
      page.sourceDocId,
      page.sourcePageIndex,
      { x: srcAnno.x, y: srcAnno.y, width: srcAnno.width, height: srcAnno.height },
      page.width,
      page.height,
      page.rotation,
    );
    // 在原框右侧偏移生成图片标注副本,保持圈取比例;复用 addAnnotation(入历史 + 选中)。
    const copy: ImageAnno = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pageId: page.id,
      type: 'image',
      x: srcAnno.x + srcAnno.width + 10,
      y: srcAnno.y,
      width: srcAnno.width,
      height: srcAnno.height,
      dataUrl,
    };
    get().addAnnotation(copy);
  },

  updateAnnotation: (id, patch, opts) => {
    const prev = { annotations: get().annotations, selectedAnnoId: get().selectedAnnoId };
    set((state) => ({
      annotations: Object.fromEntries(
        Object.entries(state.annotations).map(([pageId, list]) => [
          pageId,
          list.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
        ]),
      ),
    }));
    // transient(拖拽移动/缩放期间的逐像素更新)不入历史,由 commitAnnotationDrag 在拖拽结束时合并提交。
    if (!opts?.transient) pushAnnoCmd(set, get, prev);
    else { const docId = get().activeDocId; if (docId) markDirty(set, docId); }
  },

  commitAnnotationDrag: (prev) => {
    // 与 pushAnnoCmd 同构,但仅在标注确有变化时入栈(避免无位移拖拽产生空历史)。
    const next = { annotations: get().annotations, selectedAnnoId: get().selectedAnnoId };
    const changed = JSON.stringify(prev.annotations) !== JSON.stringify(next.annotations);
    if (!changed) return;
    const cmd: Command = {
      type: 'anno',
      payload: { prev, next },
      undo: () => set({ annotations: prev.annotations, selectedAnnoId: prev.selectedAnnoId }),
    };
    set((state) => ({ past: [...state.past, cmd], future: [] }));
    const docId = get().activeDocId;
    if (docId) markDirty(set, docId);
  },

  updateAnnotationsByType: (type, patch, scope, pageId, opts) => {
    const prev = { annotations: get().annotations, selectedAnnoId: get().selectedAnnoId };
    set((state) => {
      const { pages, activeDocId, currentPageIndex } = get();
      const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
      // 'current' 优先用传入 pageId(右键场景),否则用 currentPageIndex(属性面板场景)
      const currentPages = pageId
        ? docPages.filter((p) => p.id === pageId)
        : [docPages[currentPageIndex]].filter(Boolean);
      const targetPageIds = new Set(
        (scope === 'all' ? docPages : currentPages).map((p) => p.id),
      );
      return {
        annotations: Object.fromEntries(
          Object.entries(state.annotations).map(([pid, list]) => [
            pid,
            targetPageIds.has(pid)
              ? list.map((a) => (a.type === type ? ({ ...a, ...patch } as Annotation) : a))
              : list,
          ]),
        ),
      };
    });
    // transient(批量拖拽逐像素更新)不入历史,由 commitAnnotationDrag 在拖拽结束时合并提交。
    if (!opts?.transient) pushAnnoCmd(set, get, prev);
    else { const docId = get().activeDocId; if (docId) markDirty(set, docId); }
  },

  removeAnnotation: (id) => {
    const prev = { annotations: get().annotations, selectedAnnoId: get().selectedAnnoId };
    set((state) => ({
      annotations: Object.fromEntries(
        Object.entries(state.annotations).map(([pageId, list]) => [
          pageId,
          list.filter((a) => a.id !== id),
        ]),
      ),
      selectedAnnoId: state.selectedAnnoId === id ? null : state.selectedAnnoId,
    }));
    pushAnnoCmd(set, get, prev);
  },

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
    const total = docPages.length;
    const specs: AnnoSpec[] = [];
    docPages.forEach((page, displayIndex) => {
      const list = annotations[page.id] ?? [];
      for (const a of list) {
        const spec: AnnoSpec = {
          pageIndex: page.sourcePageIndex,
          type: a.type,
          x: a.x, y: a.y, width: a.width, height: a.height,
        };
        if (a.type === 'rect' || a.type === 'ellipse' || a.type === 'marquee') {
          spec.stroke = a.stroke; spec.strokeWidth = a.strokeWidth; spec.fill = a.fill;
        } else if (a.type === 'highlight') {
          spec.color = a.color; spec.opacity = a.opacity;
        } else if (a.type === 'image') {
          spec.imageDataUrl = a.dataUrl;
        } else {
          // text/watermark/header/footer/pageNumber
          const t = a as import('../types/pdf').TextAnno;
          // 页码标注:烘焙时按显示顺序解析占位符为字面文本(每页不同),worker 直接画字面值。
          spec.text = t.type === 'pageNumber'
            ? resolvePageNumberText(t.text, displayIndex + 1, total)
            : t.text;
          spec.color = t.color; spec.fontSize = t.fontSize;
          spec.rotation = t.rotation; spec.opacity = t.opacity;
          spec.stroke = t.stroke; spec.strokeWidth = t.strokeWidth;
        }
        specs.push(spec);
      }
    });
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
      markDirty(set, activeDocId);
    } catch (err) {
      set({ error: `应用标注失败:${String(err)}` });
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

  addHeaderFooter: ({ type, text, fontSize, color, scope }) => {
    const { pages, activeDocId, currentPageIndex } = get();
    if (!activeDocId) return;
    const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
    const targetPages = scope === 'all' ? docPages : [docPages[currentPageIndex]].filter(Boolean);
    const margin = 36; // 0.5 inch 边距
    const newAnnos: Record<string, Annotation[]> = {};
    for (const page of targetPages) {
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

  addPageNumber: ({ template, fontSize, color, align, scope }) => {
    const { pages, activeDocId, currentPageIndex } = get();
    if (!activeDocId) return;
    const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
    const targetPages = scope === 'all' ? docPages : [docPages[currentPageIndex]].filter(Boolean);
    const margin = 36; // 0.5 inch 边距
    // 初始宽度按模板估算(占位符按实际位数代入最坏情况);仅用于初始定位,渲染以 max-content 自适应。
    const sampleText = resolvePageNumberText(template, docPages.length, docPages.length);
    const w = sampleText.length * fontSize * 0.6;
    const newAnnos: Record<string, Annotation[]> = {};
    for (const page of targetPages) {
      const x = align === 'left' ? margin
        : align === 'right' ? page.width - margin - w
        : (page.width - w) / 2;
      const anno: Annotation = {
        id: nextStoreAnnoId(),
        pageId: page.id,
        type: 'pageNumber',
        x,
        y: margin, // 页脚底部
        width: w, height: fontSize,
        text: template, color, fontSize,
      } as import('../types/pdf').TextAnno;
      newAnnos[page.id] = [...(get().annotations[page.id] ?? []), anno];
    }
    set((state) => ({ annotations: { ...state.annotations, ...newAnnos } }));
  },

  removeAnnotationsByType: (type, scope, pageId) => {
    const prev = { annotations: get().annotations, selectedAnnoId: get().selectedAnnoId };
    const { pages, activeDocId, currentPageIndex, selectedAnnoId, annotations } = get();
    if (!activeDocId) return;
    const docPages = pages.filter((p) => p.sourceDocId === activeDocId);
    // 全部页:当前文档所有页;当前页:优先用传入的 pageId(右键菜单场景),
    // 否则回退到 currentPageIndex(属性面板场景,依赖滚动位置)。
    const currentPages = pageId
      ? docPages.filter((p) => p.id === pageId)
      : [docPages[currentPageIndex]].filter(Boolean);
    const targetPageIds = new Set(
      (scope === 'all' ? docPages : currentPages).map((p) => p.id),
    );
    const next: Record<string, Annotation[]> = {};
    let removedSelected = false;
    for (const [pid, list] of Object.entries(annotations)) {
      if (!targetPageIds.has(pid)) {
        next[pid] = list;
        continue;
      }
      const filtered = list.filter((a) => {
        const match = a.type === type;
        if (match && a.id === selectedAnnoId) removedSelected = true;
        return !match;
      });
      if (filtered.length > 0) next[pid] = filtered;
    }
    set({
      annotations: next,
      selectedAnnoId: removedSelected ? null : selectedAnnoId,
    });
    pushAnnoCmd(set, get, prev);
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

    // toIndex 指向拖拽释放时被替换的目标页(over 项的原位置)。
    // 所见即所得:被拖块应落在目标页原位置,即与 dnd-kit 的 arrayMove 语义一致:
    //   向后拖(from < to):插入目标页之后(目标页及其之前的页整体上移,被拖块占据其原位的后一格)。
    //   向前拖(from > to):插入目标页之前(目标页及其之后的页整体下移,被拖块占据其原位)。
    // 移动块可能是多页连续选取;以首个来源索引判断方向。
    const targetId = docPages[toIndex]?.id;
    let insertAt = remainingDocPages.length;
    if (targetId) {
      const targetInRemaining = remainingDocPages.findIndex((p) => p.id === targetId);
      if (targetInRemaining !== -1) {
        const movingFromAfter = fromIndices[0] > toIndex;
        insertAt = movingFromAfter ? targetInRemaining : targetInRemaining + 1;
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
    if (activeDocId) markDirty(set, activeDocId);
  },

  rotatePages: (pageIds, degrees) => {
    const { pages, activeDocId } = get();
    const targetPages = pages.filter((p) => pageIds.includes(p.id));
    const oldRotations = new Map(targetPages.map((p) => [p.id, p.rotation]));

    // 缩略图按原朝向渲染,旋转后需重渲染为新朝向(见 renderPageToDataURL 的 rotation 参数)。
    // 清空 thumbnail 触发 PageCard 重新渲染位图,避免旧位图上叠 CSS 旋转导致变形。
    const newPages = pages.map((p) =>
      pageIds.includes(p.id)
        ? {
            ...p,
            rotation: ((p.rotation + degrees) % 360) as 0 | 90 | 180 | 270,
            thumbnail: null,
          }
        : p,
    );

    const undo = () => {
      set((state) => ({
        pages: state.pages.map((p) =>
          oldRotations.has(p.id)
            ? { ...p, rotation: oldRotations.get(p.id)!, thumbnail: null }
            : p,
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
    if (activeDocId) markDirty(set, activeDocId);
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
    // 标记被删页所属文档为已编辑
    for (const rp of removedPages) markDirty(set, rp.page.sourceDocId);
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
    } else if (cmd.type === 'anno') {
      // 标注快照 redo:恢复修改后的状态 next
      const { next } = cmd.payload as {
        next: { annotations: Record<string, Annotation[]>; selectedAnnoId: string | null };
      };
      set({ annotations: next.annotations, selectedAnnoId: next.selectedAnnoId });
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
      // 导出成功后清除已导出文档的未保存标记(用户已保存工作)
      const nextDirty = new Set(get().dirtyDocs);
      if (mode === 'current') {
        if (activeDocId) nextDirty.delete(activeDocId);
      } else if (mode === 'all') {
        nextDirty.clear();
      } else {
        // selected:清除所选页所属文档
        for (const p of exportPages) nextDirty.delete(p.sourceDocId);
      }
      set({ isExporting: false, dirtyDocs: nextDirty });
    } catch (err) {
      set({ isExporting: false, error: String(err) });
    }
  },

  closeDocument: async (docId) => {
    // 文档有未保存编辑时,先弹窗确认
    if (get().dirtyDocs.has(docId)) {
      const ok = window.confirm('该文档的编辑尚未保存,关闭后所有编辑内容将丢失。是否确定关闭?');
      if (!ok) return;
    }
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

    // 从 dirtyDocs 移除已关闭的文档
    const nextDirty = new Set(get().dirtyDocs);
    nextDirty.delete(docId);

    set({
      pages: remainingPages,
      sourceDocs: remainingDocs,
      selection: remainingSelection,
      selectedDocIds: remainingSelectedDocs,
      lastSelectedId: removedIds.has(selection.values().next().value ?? '')
        ? null
        : get().lastSelectedId,
      activeDocId: nextActive,
      dirtyDocs: nextDirty,
      // 历史栈中可能引用已删除页面,清空避免撤销到无效状态
      past: [],
      future: [],
    });

    // 通知 Worker 释放 pdf-lib 文档,主进程释放 pdf.js 渲染文档
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
    // 仅页面编辑模式允许多选;阅读/内容编辑模式下 Ctrl 点击退化为单选,
    // 避免在没有多选交互(如合并)的模式里产生无法消费的多选态。
    if (ctrl && get().mode === 'pages') {
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
      // 另存为成功后清除该文档的未保存标记(用户已保存工作)
      const nextDirty = new Set(get().dirtyDocs);
      nextDirty.delete(docId);
      set({ isExporting: false, dirtyDocs: nextDirty });
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
    markDirty(set, activeDocId);
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
    markDirty(set, activeDocId);
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
    // 拆分会改变源文档页面归属,标记源文档与新文档为已编辑
    markDirty(set, fromDocId);
    markDirty(set, toDocId);
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
    // 另存产生的新文档为内存合成、未保存到磁盘,关闭时需提醒
    markDirty(set, toDocId);
    // 不推入历史(另存为是复制操作,不易撤销;如需可后续补充)
  },

  mergeAllDocuments: async () => {
    const { pages, sourceDocs } = get();
    if (sourceDocs.length < 2) return;
    // 按侧边栏(sourceDocs)顺序 gather 各文档页面,自上而下排列
    const allPages = sourceDocs.flatMap((d) =>
      pages.filter((p) => p.sourceDocId === d.id && !p.deleted),
    );
    if (allPages.length === 0) return;

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
    // 合并文档为内存合成、未保存到磁盘,关闭时需提醒
    markDirty(set, toDocId);
  },

  mergeDocuments: async (docIds) => {
    const { pages, sourceDocs } = get();
    if (docIds.length < 2) return;
    // 按文档在侧边栏(sourceDocs)中的顺序排列,而非用户点击顺序
    const orderedDocIds = sourceDocs.map((d) => d.id).filter((id) => docIds.includes(id));
    // 按侧边栏顺序 gather 各文档页面
    const mergedPages = orderedDocIds.flatMap((id) =>
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
    // 合并文档为内存合成、未保存到磁盘,关闭时需提醒
    markDirty(set, toDocId);
  },
}));
