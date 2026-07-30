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

  it('redo re-applies rotation after undo', () => {
    seedPages(['a']);
    useEditorStore.getState().rotatePages(['a'], 90);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages[0].rotation).toBe(0);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().pages[0].rotation).toBe(90);
    expect(useEditorStore.getState().future.length).toBe(0);
    expect(useEditorStore.getState().past.length).toBe(1);
  });

  // 缩略图按原朝向渲染;旋转后必须清空,触发 PageCard 用新 rotation 重渲染烘焙位图,
  // 否则旧位图上叠 CSS 旋转会导致内容缩放/变形。
  it('clears thumbnail of rotated pages so they re-render at new orientation', () => {
    seedPages(['a', 'b']);
    // 给 a 一张已渲染的缩略图
    useEditorStore.setState({
      pages: useEditorStore.getState().pages.map((p) =>
        p.id === 'a' ? { ...p, thumbnail: 'data:old' } : p,
      ),
    });
    useEditorStore.getState().rotatePages(['a'], 90);
    const a = useEditorStore.getState().pages.find((p) => p.id === 'a')!;
    const b = useEditorStore.getState().pages.find((p) => p.id === 'b')!;
    expect(a.thumbnail).toBeNull();
    expect(b.thumbnail).toBeNull();
  });

  it('undo also clears thumbnail (re-render back to original orientation)', () => {
    seedPages(['a']);
    useEditorStore.getState().rotatePages(['a'], 90);
    // 模拟重渲染后产生了旋转缩略图
    useEditorStore.setState({
      pages: useEditorStore.getState().pages.map((p) =>
        p.id === 'a' ? { ...p, thumbnail: 'data:rotated' } : p,
      ),
    });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages[0].rotation).toBe(0);
    expect(useEditorStore.getState().pages[0].thumbnail).toBeNull();
  });
});
