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

describe('rotatePages', () => {
  beforeEach(() => {
    useEditorStore.setState({ pages: [], past: [], future: [] });
  });

  it('increments rotation by 90 degrees', () => {
    seedPages(['a', 'b']);
    useEditorStore.getState().rotatePages(['a'], 90);
    const page = useEditorStore.getState().pages.find((p) => p.id === 'a')!;
    expect(page.rotation).toBe(90);
  });

  it('wraps around at 360', () => {
    useEditorStore.setState({
      pages: [
        {
          id: 'a',
          sourceDocId: 'doc1',
          sourcePageIndex: 0,
          rotation: 270,
          width: 595,
          height: 842,
          thumbnail: null,
          deleted: false,
        },
      ],
    });
    useEditorStore.getState().rotatePages(['a'], 90);
    expect(useEditorStore.getState().pages[0].rotation).toBe(0);
  });

  it('pushes undo command to past', () => {
    seedPages(['a']);
    useEditorStore.getState().rotatePages(['a'], 90);
    expect(useEditorStore.getState().past.length).toBe(1);
  });
});
