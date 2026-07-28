import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

// Mock workerClient.disposeDoc 以避免真正调用 Worker
vi.mock('../../src/worker/workerClient', () => ({
  workerClient: {
    disposeDoc: vi.fn().mockResolvedValue(null),
  },
}));

function seedTwoDocs(): void {
  useEditorStore.setState({
    sourceDocs: [
      { id: 'doc1', fileName: 'a.pdf', pageCount: 2 },
      { id: 'doc2', fileName: 'b.pdf', pageCount: 1 },
    ],
    pages: [
      { id: 'doc1-p0', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      { id: 'doc1-p1', sourceDocId: 'doc1', sourcePageIndex: 1, rotation: 90, width: 595, height: 842, thumbnail: null, deleted: false },
      { id: 'doc2-p0', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
    ],
    activeDocId: 'doc1',
    selection: new Set(['doc1-p0']),
    lastSelectedId: 'doc1-p0',
    past: [{ type: 'move', payload: {}, undo: () => {} }],
    future: [],
  });
}

describe('closeDocument', () => {
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

  it('removes the document and its pages', async () => {
    seedTwoDocs();
    await useEditorStore.getState().closeDocument('doc1');
    const state = useEditorStore.getState();
    expect(state.sourceDocs).toHaveLength(1);
    expect(state.sourceDocs[0].id).toBe('doc2');
    expect(state.pages).toHaveLength(1);
    expect(state.pages[0].id).toBe('doc2-p0');
  });

  it('switches activeDocId to remaining doc when closing the active one', async () => {
    seedTwoDocs();
    await useEditorStore.getState().closeDocument('doc1');
    expect(useEditorStore.getState().activeDocId).toBe('doc2');
  });

  it('keeps activeDocId when closing a non-active doc', async () => {
    seedTwoDocs();
    await useEditorStore.getState().closeDocument('doc2');
    expect(useEditorStore.getState().activeDocId).toBe('doc1');
  });

  it('clears selection entries belonging to the closed doc', async () => {
    seedTwoDocs();
    useEditorStore.getState().selectPage('doc2-p0', true, false);
    await useEditorStore.getState().closeDocument('doc1');
    const selection = useEditorStore.getState().selection;
    expect(selection.has('doc1-p0')).toBe(false);
    expect(selection.has('doc2-p0')).toBe(true);
  });

  it('clears history (past/future) to avoid undo to invalid state', async () => {
    seedTwoDocs();
    await useEditorStore.getState().closeDocument('doc1');
    const state = useEditorStore.getState();
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });

  it('calls workerClient.disposeDoc for the docId', async () => {
    seedTwoDocs();
    const { workerClient } = await import('../../src/worker/workerClient');
    await useEditorStore.getState().closeDocument('doc1');
    expect(workerClient.disposeDoc).toHaveBeenCalledWith('doc1');
  });
});
