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

describe('deletePages', () => {
  beforeEach(() => {
    useEditorStore.setState({ pages: [], past: [], future: [], selection: new Set() });
  });

  it('removes pages from the list (hard delete)', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.getState().deletePages(['b']);
    const ids = useEditorStore.getState().pages.map((p) => p.id);
    expect(ids).toEqual(['a', 'c']);
  });

  it('clears deleted pages from selection', () => {
    seedPages(['a', 'b']);
    useEditorStore.getState().selectPage('a', false, false);
    useEditorStore.getState().selectPage('b', true, false);
    useEditorStore.getState().deletePages(['a']);
    expect(useEditorStore.getState().selection.has('a')).toBe(false);
    expect(useEditorStore.getState().selection.has('b')).toBe(true);
  });

  it('undo restores deleted pages at original positions', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.getState().deletePages(['b']);
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['a', 'c']);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('redo re-applies delete after undo', () => {
    seedPages(['a', 'b']);
    useEditorStore.getState().deletePages(['a']);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['a', 'b']);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['b']);
    expect(useEditorStore.getState().future.length).toBe(0);
    expect(useEditorStore.getState().past.length).toBe(1);
  });
});
