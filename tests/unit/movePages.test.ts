import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

function seedPages(ids: string[]): void {
  useEditorStore.setState({
    pages: ids.map((id, i) => ({
      id,
      sourceDocId: 'doc1',
      sourcePageIndex: i,
      rotation: 0 as const,
      width: 595,
      height: 842,
      thumbnail: null,
      deleted: false,
    })),
  });
}

describe('movePages', () => {
  beforeEach(() => {
    useEditorStore.setState({ pages: [], past: [], future: [], activeDocId: 'doc1' });
  });

  it('moves a single page to a new index', () => {
    seedPages(['a', 'b', 'c', 'd']);
    useEditorStore.getState().movePages(['a'], 3);
    const ids = useEditorStore.getState().pages.map((p) => p.id);
    expect(ids).toEqual(['b', 'c', 'd', 'a']);
  });

  it('moves multiple pages preserving their relative order', () => {
    seedPages(['a', 'b', 'c', 'd', 'e']);
    useEditorStore.getState().movePages(['b', 'd'], 4);
    const ids = useEditorStore.getState().pages.map((p) => p.id);
    expect(ids).toEqual(['a', 'c', 'e', 'b', 'd']);
  });

  it('pushes command to past and clears future', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.setState({ future: [{ type: 'move', payload: {}, undo: () => {} }] });
    useEditorStore.getState().movePages(['a'], 2);
    expect(useEditorStore.getState().past.length).toBe(1);
    expect(useEditorStore.getState().future.length).toBe(0);
  });

  it('redo re-applies move after undo', () => {
    seedPages(['a', 'b', 'c', 'd']);
    useEditorStore.getState().movePages(['a'], 3);
    // after move: [b, c, d, a]
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['b', 'c', 'd', 'a']);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(useEditorStore.getState().future.length).toBe(0);
    expect(useEditorStore.getState().past.length).toBe(1);
  });

  // WYSIWYG: 拖拽释放后,被拖项应落在"拖拽时预览占据的位置"(即 over 目标页原位置)。
  // 向后拖(from < to):插入目标页之后 —— 与 dnd-kit 预览一致。
  it('drag backward: a over index 2 lands at index 2', () => {
    seedPages(['a', 'b', 'c', 'd']);
    useEditorStore.getState().movePages(['a'], 2);
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  // 向前拖(from > to):插入目标页之前 —— 与 dnd-kit 预览一致。
  it('drag forward: d over index 1 lands at index 1', () => {
    seedPages(['a', 'b', 'c', 'd']);
    useEditorStore.getState().movePages(['d'], 1);
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('drag forward: c over index 0 lands at index 0', () => {
    seedPages(['a', 'b', 'c', 'd']);
    useEditorStore.getState().movePages(['c'], 0);
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});
