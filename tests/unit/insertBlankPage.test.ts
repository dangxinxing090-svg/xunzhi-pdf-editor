import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

vi.mock('../../src/worker/workerClient', () => ({
  workerClient: {
    loadDoc: vi.fn(),
    exportPdf: vi.fn(),
    disposeDoc: vi.fn().mockResolvedValue(null),
    createDocFromPages: vi.fn(),
    insertPagesIntoDoc: vi.fn().mockImplementation(async (docId: string, insertAt: number, pages: any[]) => {
      // 模拟插入后:文档页数增加 pages.length,新页在 insertAt..insertAt+pages.length
      const origCount = 2;
      const meta = {
        pageCount: origCount + pages.length,
        pages: Array.from({ length: origCount + pages.length }, (_, i) => {
          const inInsertRange = i >= insertAt && i < insertAt + pages.length;
          const spec = inInsertRange ? pages[i - insertAt] : null;
          return { width: spec && 'blank' in spec ? spec.width : 595, height: spec && 'blank' in spec ? spec.height : 842 };
        }),
      };
      return { meta, renderBuffer: new ArrayBuffer(0) };
    }),
  },
}));

function seedDoc(docId: string, pageIds: string[]): void {
  const pages = pageIds.map((id, i) => ({
    id,
    sourceDocId: docId,
    sourcePageIndex: i,
    rotation: 0 as const,
    width: 595,
    height: 842,
    thumbnail: null,
    deleted: false,
  }));
  useEditorStore.setState({
    sourceDocs: [{ id: docId, fileName: `${docId}.pdf`, pageCount: pageIds.length }],
    pages,
    activeDocId: docId,
    selection: new Set(),
    lastSelectedId: null,
    past: [],
    future: [],
  });
}

describe('insertBlankPage', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sourceDocs: [],
      pages: [],
      activeDocId: null,
      selection: new Set(),
      lastSelectedId: null,
      past: [],
      future: [],
    });
  });

  it('inserts a blank page before the selected page, in the same document', async () => {
    seedDoc('doc1', ['p0', 'p1']);
    useEditorStore.getState().selectPage('p1', false, false);
    await useEditorStore.getState().insertBlankPage();

    const state = useEditorStore.getState();
    const docPages = state.pages.filter((p) => p.sourceDocId === 'doc1');
    expect(docPages.length).toBe(3);
    expect(docPages[0].id).toBe('p0');
    expect(docPages[0].sourcePageIndex).toBe(0);
    // 新页在 p1 之前(索引 1)
    expect(docPages[1].id).not.toBe('p0');
    expect(docPages[1].id).not.toBe('p1');
    expect(docPages[1].sourceDocId).toBe('doc1');
    expect(docPages[1].sourcePageIndex).toBe(1);
    // p1 后移到索引 2
    expect(docPages[2].id).toBe('p1');
    expect(docPages[2].sourcePageIndex).toBe(2);
  });

  it('inserts at front (index 0) when nothing selected', async () => {
    seedDoc('doc1', ['p0', 'p1']);
    await useEditorStore.getState().insertBlankPage();

    const docPages = useEditorStore.getState().pages.filter((p) => p.sourceDocId === 'doc1');
    expect(docPages[0].id).not.toBe('p0');
    expect(docPages[0].sourcePageIndex).toBe(0);
    expect(docPages[1].id).toBe('p0');
    expect(docPages[1].sourcePageIndex).toBe(1);
  });

  it('does not create a new sourceDoc', async () => {
    seedDoc('doc1', ['p0']);
    useEditorStore.getState().selectPage('p0', false, false);
    await useEditorStore.getState().insertBlankPage();
    expect(useEditorStore.getState().sourceDocs.length).toBe(1);
    expect(useEditorStore.getState().sourceDocs[0].id).toBe('doc1');
  });

  it('calls workerClient.insertPagesIntoDoc with blank spec', async () => {
    seedDoc('doc1', ['p0']);
    useEditorStore.getState().selectPage('p0', false, false);
    const { workerClient } = await import('../../src/worker/workerClient');
    await useEditorStore.getState().insertBlankPage();
    expect(workerClient.insertPagesIntoDoc).toHaveBeenCalledWith(
      'doc1', 0, [{ blank: true, width: 595, height: 842 }],
    );
  });
});
