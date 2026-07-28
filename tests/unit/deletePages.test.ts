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

  it('marks pages as deleted (soft delete)', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.getState().deletePages(['b']);
    const b = useEditorStore.getState().pages.find((p) => p.id === 'b')!;
    expect(b.deleted).toBe(true);
    const a = useEditorStore.getState().pages.find((p) => p.id === 'a')!;
    expect(a.deleted).toBe(false);
  });

  it('clears deleted pages from selection', () => {
    seedPages(['a', 'b']);
    useEditorStore.getState().selectPage('a', false, false);
    useEditorStore.getState().selectPage('b', true, false);
    useEditorStore.getState().deletePages(['a']);
    expect(useEditorStore.getState().selection.has('a')).toBe(false);
    expect(useEditorStore.getState().selection.has('b')).toBe(true);
  });

  it('pushes undo command that restores deleted state', () => {
    seedPages(['a']);
    useEditorStore.getState().deletePages(['a']);
    expect(useEditorStore.getState().past.length).toBe(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages[0].deleted).toBe(false);
  });
});
