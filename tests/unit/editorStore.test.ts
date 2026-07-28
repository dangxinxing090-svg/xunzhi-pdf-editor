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
    selection: new Set(),
  });
}

describe('selection', () => {
  beforeEach(() => {
    useEditorStore.setState({ pages: [], selection: new Set(), lastSelectedId: null });
  });

  it('selectPage replaces selection with single page', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.getState().selectPage('b', false, false);
    expect(useEditorStore.getState().selection).toEqual(new Set(['b']));
  });

  it('ctrl+click toggles page in selection', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.getState().selectPage('a', false, false);
    useEditorStore.getState().selectPage('b', true, false);
    expect(useEditorStore.getState().selection).toEqual(new Set(['a', 'b']));
    useEditorStore.getState().selectPage('a', true, false);
    expect(useEditorStore.getState().selection).toEqual(new Set(['b']));
  });

  it('shift+click selects range from last selected', () => {
    seedPages(['a', 'b', 'c', 'd', 'e']);
    useEditorStore.getState().selectPage('a', false, false);
    useEditorStore.getState().selectPage('d', false, true);
    expect(useEditorStore.getState().selection).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('clearSelection empties the set', () => {
    seedPages(['a']);
    useEditorStore.getState().selectPage('a', false, false);
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().selection.size).toBe(0);
  });
});
