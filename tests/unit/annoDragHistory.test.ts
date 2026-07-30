import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';
import type { Annotation } from '../../types/pdf';

const ANNO: Annotation = {
  id: 'a1',
  pageId: 'p0',
  type: 'rect',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  stroke: '#ff0000',
  strokeWidth: 2,
};

function seed(): void {
  useEditorStore.setState({
    pages: [{ id: 'p0', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false }],
    annotations: { p0: [ANNO] },
    selectedAnnoId: 'a1',
    activeDocId: 'doc1',
    past: [],
    future: [],
    selection: new Set(),
  });
}

describe('annotation drag history coalescing', () => {
  beforeEach(seed);

  it('transient updates do not push history; commit once at drag end', () => {
    // 模拟拖拽:多次 transient 更新(每个像素),只在结束时提交一条历史
    const store = useEditorStore.getState();
    const prev = { annotations: store.annotations, selectedAnnoId: store.selectedAnnoId };
    store.updateAnnotation('a1', { x: 11 }, { transient: true });
    store.updateAnnotation('a1', { x: 12 }, { transient: true });
    store.updateAnnotation('a1', { x: 13 }, { transient: true });
    // transient 期间不应产生历史条目
    expect(useEditorStore.getState().past.length).toBe(0);
    // 标注位置已更新(视觉跟随)
    expect(useEditorStore.getState().annotations.p0[0].x).toBe(13);
    // 拖拽结束提交一条合并命令
    useEditorStore.getState().commitAnnotationDrag(prev);
    expect(useEditorStore.getState().past.length).toBe(1);
  });

  it('undo after a coalesced drag restores pre-drag position in one step', () => {
    const store = useEditorStore.getState();
    const prev = { annotations: store.annotations, selectedAnnoId: store.selectedAnnoId };
    store.updateAnnotation('a1', { x: 99, y: 88 }, { transient: true });
    store.updateAnnotation('a1', { x: 100, y: 90 }, { transient: true });
    useEditorStore.getState().commitAnnotationDrag(prev);
    // 拖拽后位置改变
    expect(useEditorStore.getState().annotations.p0[0]).toMatchObject({ x: 100, y: 90 });
    // 一次撤销即回到拖拽前
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().past.length).toBe(0);
    expect(useEditorStore.getState().annotations.p0[0]).toMatchObject({ x: 10, y: 20 });
  });

  it('redo re-applies the whole drag in one step', () => {
    const store = useEditorStore.getState();
    const prev = { annotations: store.annotations, selectedAnnoId: store.selectedAnnoId };
    store.updateAnnotation('a1', { x: 100 }, { transient: true });
    useEditorStore.getState().commitAnnotationDrag(prev);
    useEditorStore.getState().undo();
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().annotations.p0[0].x).toBe(100);
    expect(useEditorStore.getState().future.length).toBe(0);
    expect(useEditorStore.getState().past.length).toBe(1);
  });

  it('non-transient update still pushes history immediately (inspector edits)', () => {
    useEditorStore.getState().updateAnnotation('a1', { stroke: '#00ff00' });
    expect(useEditorStore.getState().past.length).toBe(1);
  });

  it('no-op drag (no movement) does not push history', () => {
    const store = useEditorStore.getState();
    const prev = { annotations: store.annotations, selectedAnnoId: store.selectedAnnoId };
    // 未发生任何 transient 更新即提交:不应产生历史条目
    useEditorStore.getState().commitAnnotationDrag(prev);
    expect(useEditorStore.getState().past.length).toBe(0);
  });
});
