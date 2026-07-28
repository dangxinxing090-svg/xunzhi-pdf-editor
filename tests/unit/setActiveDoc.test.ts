import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

function seedTwoDocs(): void {
  useEditorStore.setState({
    sourceDocs: [
      { id: 'doc1', fileName: 'a.pdf', pageCount: 2 },
      { id: 'doc2', fileName: 'b.pdf', pageCount: 2 },
    ],
    pages: [
      { id: 'doc1-p0', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      { id: 'doc1-p1', sourceDocId: 'doc1', sourcePageIndex: 1, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      { id: 'doc2-p0', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      { id: 'doc2-p1', sourceDocId: 'doc2', sourcePageIndex: 1, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
    ],
    activeDocId: 'doc1',
    selection: new Set(),
    lastSelectedId: null,
    past: [],
    future: [],
  });
}

describe('setActiveDoc', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sourceDocs: [],
      pages: [],
      activeDocId: null,
      selection: new Set(),
      lastSelectedId: null,
    });
  });

  it('switches activeDocId to the clicked document', () => {
    seedTwoDocs();
    useEditorStore.getState().setActiveDoc('doc2');
    expect(useEditorStore.getState().activeDocId).toBe('doc2');
  });

  it('clears selection when switching documents', () => {
    seedTwoDocs();
    useEditorStore.getState().selectPage('doc1-p0', false, false);
    expect(useEditorStore.getState().selection.size).toBe(1);
    useEditorStore.getState().setActiveDoc('doc2');
    expect(useEditorStore.getState().selection.size).toBe(0);
    expect(useEditorStore.getState().lastSelectedId).toBeNull();
  });

  it('movePages only reorders pages within the active document', () => {
    seedTwoDocs();
    // 在 doc2 中把 p0 移到 p1 之后(toIndex=1 表示目标页是 p1,插入其后)
    useEditorStore.getState().setActiveDoc('doc2');
    useEditorStore.getState().movePages(['doc2-p0'], 1);

    const allPages = useEditorStore.getState().pages;
    // doc1 的页面顺序应保持不变
    expect(allPages.filter((p) => p.sourceDocId === 'doc1').map((p) => p.id))
      .toEqual(['doc1-p0', 'doc1-p1']);
    // doc2 的页面应重排为 [p1, p0]
    expect(allPages.filter((p) => p.sourceDocId === 'doc2').map((p) => p.id))
      .toEqual(['doc2-p1', 'doc2-p0']);
  });
});
