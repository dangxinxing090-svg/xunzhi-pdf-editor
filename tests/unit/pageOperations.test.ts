import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

vi.mock('../../src/worker/workerClient', () => {
  let callCount = 0;
  return {
    workerClient: {
      loadDoc: vi.fn(),
      renderThumb: vi.fn(),
      exportPdf: vi.fn(),
      disposeDoc: vi.fn().mockResolvedValue(null),
      createDocFromPages: vi.fn().mockImplementation(async (_id: string, pages: any[]) => {
        callCount++;
        return {
          pageCount: pages.length,
          pages: pages.map((p: any) => ({ width: p.width ?? 595, height: p.height ?? 842 })),
        };
      }),
      _getCallCount: () => callCount,
    },
  };
});

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

describe('duplicatePages', () => {
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

  it('inserts a copy after each selected page', async () => {
    seedDoc('doc1', ['p0', 'p1']);
    useEditorStore.getState().selectPage('p0', false, false);
    await useEditorStore.getState().duplicatePages(['p0']);

    const pages = useEditorStore.getState().pages;
    expect(pages.length).toBe(3);
    // p0, 副本, p1
    expect(pages[0].id).toBe('p0');
    expect(pages[1].sourceDocId).not.toBe('doc1');
    expect(pages[2].id).toBe('p1');
  });

  it('undo removes all duplicates', async () => {
    seedDoc('doc1', ['p0', 'p1']);
    await useEditorStore.getState().duplicatePages(['p0', 'p1']);
    expect(useEditorStore.getState().pages.length).toBe(4);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages.length).toBe(2);
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['p0', 'p1']);
  });
});

describe('splitToNewDocument', () => {
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

  it('moves selected pages to a new document and switches activeDocId', async () => {
    seedDoc('doc1', ['p0', 'p1', 'p2']);
    await useEditorStore.getState().splitToNewDocument(['p0', 'p2']);

    const state = useEditorStore.getState();
    // 新文档出现在 sourceDocs
    expect(state.sourceDocs.length).toBe(2);
    expect(state.activeDocId).not.toBe('doc1');
    // p0 和 p2 的 sourceDocId 改为新文档
    const newDocId = state.activeDocId;
    expect(state.pages.find((p) => p.id === 'p0')!.sourceDocId).toBe(newDocId);
    expect(state.pages.find((p) => p.id === 'p2')!.sourceDocId).toBe(newDocId);
    expect(state.pages.find((p) => p.id === 'p1')!.sourceDocId).toBe('doc1');
  });

  it('undo restores pages to original document', async () => {
    seedDoc('doc1', ['p0', 'p1']);
    await useEditorStore.getState().splitToNewDocument(['p0']);
    useEditorStore.getState().undo();
    const state = useEditorStore.getState();
    expect(state.pages.find((p) => p.id === 'p0')!.sourceDocId).toBe('doc1');
    expect(state.sourceDocs.length).toBe(1);
    expect(state.activeDocId).toBe('doc1');
  });
});

describe('mergeAllDocuments', () => {
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

  it('creates a merged document with all pages from all docs', async () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a.pdf', pageCount: 2 },
        { id: 'doc2', fileName: 'b.pdf', pageCount: 1 },
      ],
      pages: [
        { id: 'p0', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p1', sourceDocId: 'doc1', sourcePageIndex: 1, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p2', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 90, width: 595, height: 842, thumbnail: null, deleted: false },
      ],
      activeDocId: 'doc1',
    });
    await useEditorStore.getState().mergeAllDocuments();

    const state = useEditorStore.getState();
    expect(state.sourceDocs.length).toBe(3); // 原2 + 合并1
    expect(state.activeDocId).not.toBe('doc1');
    // 合并文档应有 3 页
    const mergedPages = state.pages.filter((p) => p.sourceDocId === state.activeDocId);
    expect(mergedPages.length).toBe(3);
    // 原文档页面保留
    expect(state.pages.filter((p) => p.sourceDocId === 'doc1').length).toBe(2);
  });

  it('does nothing with fewer than 2 documents', async () => {
    seedDoc('doc1', ['p0']);
    await useEditorStore.getState().mergeAllDocuments();
    expect(useEditorStore.getState().sourceDocs.length).toBe(1);
  });
});
