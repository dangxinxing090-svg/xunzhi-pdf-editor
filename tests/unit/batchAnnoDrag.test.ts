import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

// 水印/页眉/页脚/页码这类"批量"标注:每页各有一个同类型实例。
// 拖动其中一页的实例时,应同步移动所有页的同类型实例(而非仅当前页)。
const BATCH_TYPES = ['watermark', 'header', 'footer', 'pageNumber'] as const;

function seedBatchAnnos(type: (typeof BATCH_TYPES)[number]): void {
  const pages = ['p0', 'p1', 'p2'].map((id, i) => ({
    id,
    sourceDocId: 'doc1',
    sourcePageIndex: i,
    rotation: 0 as const,
    width: 595,
    height: 842,
    thumbnail: null,
    deleted: false,
  }));
  // 每页一个同类型标注,初始 x/y 相同(模拟 addWatermark/addHeaderFooter/addPageNumber 的创建结果)
  const annotations: Record<string, any[]> = {};
  for (const p of pages) {
    annotations[p.id] = [{
      id: `${type}-${p.id}`,
      pageId: p.id,
      type,
      x: 100,
      y: 100,
      width: 80,
      height: 12,
      text: 't',
      color: '#000',
      fontSize: 12,
    }];
  }
  useEditorStore.setState({
    sourceDocs: [{ id: 'doc1', fileName: 'a.pdf', pageCount: 3 }],
    pages,
    activeDocId: 'doc1',
    currentPageIndex: 0,
    selection: new Set(),
    annotations,
    selectedAnnoId: `${type}-p0`,
    past: [],
    future: [],
  });
}

describe('batch annotation drag syncs across all pages', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sourceDocs: [],
      pages: [],
      activeDocId: null,
      selection: new Set(),
      lastSelectedId: null,
      annotations: {},
      selectedAnnoId: null,
      past: [],
      future: [],
    });
  });

  for (const type of BATCH_TYPES) {
    it(`${type}: updateAnnotationsByType with transient moves all pages' annos, no history`, () => {
      seedBatchAnnos(type);
      // 模拟拖动 p0 上的实例到新位置 -> 应同步所有页
      useEditorStore.getState().updateAnnotationsByType(
        type,
        { x: 250, y: 300 },
        'all',
        undefined,
        { transient: true },
      );
      const { annotations, past } = useEditorStore.getState();
      expect(past.length).toBe(0); // transient 不入栈
      for (const pid of ['p0', 'p1', 'p2']) {
        const a = annotations[pid][0];
        expect(a.x).toBe(250);
        expect(a.y).toBe(300);
      }
    });
  }

  it('commitAnnotationDrag after batch drag produces a single undo restoring all pages', () => {
    seedBatchAnnos('watermark');
    const store = useEditorStore.getState();
    const prev = { annotations: store.annotations, selectedAnnoId: store.selectedAnnoId };
    store.updateAnnotationsByType('watermark', { x: 250, y: 300 }, 'all', undefined, { transient: true });
    useEditorStore.getState().commitAnnotationDrag(prev);
    expect(useEditorStore.getState().past.length).toBe(1);
    // 一次撤销:所有页的水印回到原位
    useEditorStore.getState().undo();
    const { annotations } = useEditorStore.getState();
    for (const pid of ['p0', 'p1', 'p2']) {
      expect(annotations[pid][0].x).toBe(100);
      expect(annotations[pid][0].y).toBe(100);
    }
  });

  it('non-batch (text) annotation drag does NOT sync -- only the moved anno changes', () => {
    // 普通文本批注:每页一个 text 标注,拖动一页只改那一页
    const pages = ['p0', 'p1'].map((id, i) => ({
      id, sourceDocId: 'doc1', sourcePageIndex: i, rotation: 0 as const,
      width: 595, height: 842, thumbnail: null, deleted: false,
    }));
    useEditorStore.setState({
      sourceDocs: [{ id: 'doc1', fileName: 'a.pdf', pageCount: 2 }],
      pages,
      activeDocId: 'doc1',
      currentPageIndex: 0,
      annotations: {
        p0: [{ id: 't-p0', pageId: 'p0', type: 'text', x: 10, y: 10, width: 50, height: 12, text: 'a', color: '#000', fontSize: 12 }],
        p1: [{ id: 't-p1', pageId: 'p1', type: 'text', x: 10, y: 10, width: 50, height: 12, text: 'b', color: '#000', fontSize: 12 }],
      },
      selectedAnnoId: 't-p0',
      past: [], future: [],
    });
    // 普通文本走 updateAnnotation(单条),不应影响 p1
    useEditorStore.getState().updateAnnotation('t-p0', { x: 200, y: 200 }, { transient: true });
    const { annotations } = useEditorStore.getState();
    expect(annotations.p0[0].x).toBe(200);
    expect(annotations.p1[0].x).toBe(10); // 未变
  });
});
