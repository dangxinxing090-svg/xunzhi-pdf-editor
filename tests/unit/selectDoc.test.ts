import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

function seedTwoDocs(mode: 'read' | 'pages' | 'content' = 'read'): void {
  useEditorStore.setState({
    sourceDocs: [
      { id: 'doc1', fileName: 'a.pdf', pageCount: 1 },
      { id: 'doc2', fileName: 'b.pdf', pageCount: 1 },
    ],
    pages: [
      { id: 'doc1-p0', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      { id: 'doc2-p0', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
    ],
    activeDocId: 'doc1',
    selectedDocIds: new Set(['doc1']),
    selection: new Set(),
    lastSelectedId: null,
    past: [],
    future: [],
    mode,
  });
}

describe('selectDoc multi-select mode gating', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sourceDocs: [],
      pages: [],
      activeDocId: null,
      selectedDocIds: new Set(),
      selection: new Set(),
      lastSelectedId: null,
      past: [],
      future: [],
      mode: 'read',
    });
  });

  it('pages mode: Ctrl+click accumulates into selectedDocIds', () => {
    seedTwoDocs('pages');
    // doc1 已在选中,Ctrl 点击 doc2 -> 选中两篇
    useEditorStore.getState().selectDoc('doc2', true);
    const { selectedDocIds } = useEditorStore.getState();
    expect(selectedDocIds.size).toBe(2);
    expect([...selectedDocIds]).toEqual(['doc1', 'doc2']);
  });

  it('read mode: Ctrl+click degrades to single-select', () => {
    seedTwoDocs('read');
    useEditorStore.getState().selectDoc('doc2', true);
    const state = useEditorStore.getState();
    expect(state.selectedDocIds.size).toBe(1);
    expect([...state.selectedDocIds]).toEqual(['doc2']);
    // 同时切到该文档为 active
    expect(state.activeDocId).toBe('doc2');
  });

  it('content mode: Ctrl+click degrades to single-select', () => {
    seedTwoDocs('content');
    useEditorStore.getState().selectDoc('doc2', true);
    const state = useEditorStore.getState();
    expect(state.selectedDocIds.size).toBe(1);
    expect([...state.selectedDocIds]).toEqual(['doc2']);
    expect(state.activeDocId).toBe('doc2');
  });

  it('read mode: plain click still single-selects', () => {
    seedTwoDocs('read');
    useEditorStore.getState().selectDoc('doc2', false);
    const state = useEditorStore.getState();
    expect(state.selectedDocIds.size).toBe(1);
    expect(state.activeDocId).toBe('doc2');
  });
});
