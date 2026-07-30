import { describe, it, expect, beforeEach } from 'vitest';
import { resolvePageNumberText } from '../../src/lib/pageNumber';
import { useEditorStore } from '../../src/store/editorStore';

describe('resolvePageNumberText', () => {
  it('substitutes {n} with the 1-based page number', () => {
    expect(resolvePageNumberText('第 {n} 页', 1, 5)).toBe('第 1 页');
    expect(resolvePageNumberText('第 {n} 页', 5, 5)).toBe('第 5 页');
  });

  it('substitutes {total} with the total page count', () => {
    expect(resolvePageNumberText('共 {total} 页', 1, 12)).toBe('共 12 页');
  });

  it('combines {n} and {total}', () => {
    expect(resolvePageNumberText('{n} / {total}', 3, 10)).toBe('3 / 10');
    expect(resolvePageNumberText('第 {n} 页 / 共 {total} 页', 2, 7)).toBe('第 2 页 / 共 7 页');
  });

  it('returns the template verbatim when no placeholders present', () => {
    expect(resolvePageNumberText('机密', 1, 5)).toBe('机密');
  });

  it('handles multiple {n} occurrences', () => {
    expect(resolvePageNumberText('{n} - {n}', 4, 9)).toBe('4 - 4');
  });
});

function seedDoc(pageIds: string[]): void {
  useEditorStore.setState({
    sourceDocs: [{ id: 'doc1', fileName: 'a.pdf', pageCount: pageIds.length }],
    pages: pageIds.map((id, i) => ({
      id,
      sourceDocId: 'doc1',
      sourcePageIndex: i,
      rotation: 0 as const,
      width: 595,
      height: 842,
      thumbnail: null,
      deleted: false,
    })),
    activeDocId: 'doc1',
    currentPageIndex: 0,
    selection: new Set(),
    annotations: {},
    selectedAnnoId: null,
    past: [],
    future: [],
  });
}

describe('addPageNumber', () => {
  beforeEach(() => seedDoc(['p0', 'p1', 'p2']));

  it('scope=all creates one pageNumber anno per page, each storing the template', () => {
    useEditorStore.getState().addPageNumber({ template: '第 {n} 页', fontSize: 12, color: '#000', align: 'center', scope: 'all' });
    const { annotations } = useEditorStore.getState();
    for (const pid of ['p0', 'p1', 'p2']) {
      const annos = annotations[pid] ?? [];
      const pn = annos.find((a) => a.type === 'pageNumber');
      expect(pn).toBeDefined();
      expect(pn!.text).toBe('第 {n} 页'); // 存模板,渲染/烘焙时才解析
    }
  });

  it('scope=current creates a pageNumber anno only on the current page', () => {
    useEditorStore.setState({ currentPageIndex: 1 });
    useEditorStore.getState().addPageNumber({ template: '{n}/{total}', fontSize: 10, color: '#000', align: 'center', scope: 'current' });
    const { annotations } = useEditorStore.getState();
    expect((annotations.p0 ?? []).some((a) => a.type === 'pageNumber')).toBe(false);
    expect((annotations.p1 ?? []).some((a) => a.type === 'pageNumber')).toBe(true);
    expect((annotations.p2 ?? []).some((a) => a.type === 'pageNumber')).toBe(false);
  });

  it('align=left places x at the left margin', () => {
    useEditorStore.getState().addPageNumber({ template: '{n}', fontSize: 12, color: '#000', align: 'left', scope: 'all' });
    const anno = (useEditorStore.getState().annotations.p0 ?? []).find((a) => a.type === 'pageNumber')!;
    expect(anno.x).toBe(36); // margin
  });

  it('align=right places x so the right edge is near the right margin', () => {
    useEditorStore.getState().addPageNumber({ template: '{n}', fontSize: 12, color: '#000', align: 'right', scope: 'all' });
    const anno = (useEditorStore.getState().annotations.p0 ?? []).find((a) => a.type === 'pageNumber')!;
    // x = page.width - margin - w;w > 0,故 x < 595 - 36
    expect(anno.x).toBeLessThan(595 - 36);
    expect(anno.x + anno.width).toBeCloseTo(595 - 36, 0);
  });

  it('align=center places x roughly centered', () => {
    useEditorStore.getState().addPageNumber({ template: '{n}', fontSize: 12, color: '#000', align: 'center', scope: 'all' });
    const anno = (useEditorStore.getState().annotations.p0 ?? []).find((a) => a.type === 'pageNumber')!;
    expect(anno.x).toBeCloseTo((595 - anno.width) / 2, 0);
  });
});

describe('pageNumber deletion', () => {
  beforeEach(() => {
    seedDoc(['p0', 'p1', 'p2']);
    useEditorStore.getState().addPageNumber({ template: '第 {n} 页', fontSize: 12, color: '#000', align: 'center', scope: 'all' });
  });

  it('removeAnnotationsByType(pageNumber, all) removes every page\'s page number', () => {
    useEditorStore.getState().removeAnnotationsByType('pageNumber', 'all');
    const { annotations } = useEditorStore.getState();
    for (const pid of ['p0', 'p1', 'p2']) {
      expect((annotations[pid] ?? []).some((a) => a.type === 'pageNumber')).toBe(false);
    }
  });

  it('removeAnnotationsByType(pageNumber, current) removes only the given page', () => {
    useEditorStore.getState().removeAnnotationsByType('pageNumber', 'current', 'p1');
    const { annotations } = useEditorStore.getState();
    expect((annotations.p0 ?? []).some((a) => a.type === 'pageNumber')).toBe(true);
    expect((annotations.p1 ?? []).some((a) => a.type === 'pageNumber')).toBe(false);
    expect((annotations.p2 ?? []).some((a) => a.type === 'pageNumber')).toBe(true);
  });

  it('removeAnnotation(id) deletes a single page\'s page number without affecting others', () => {
    const target = (useEditorStore.getState().annotations.p1 ?? []).find((a) => a.type === 'pageNumber')!;
    useEditorStore.getState().removeAnnotation(target.id);
    const { annotations } = useEditorStore.getState();
    expect((annotations.p0 ?? []).some((a) => a.type === 'pageNumber')).toBe(true);
    expect((annotations.p1 ?? []).some((a) => a.type === 'pageNumber')).toBe(false);
    expect((annotations.p2 ?? []).some((a) => a.type === 'pageNumber')).toBe(true);
  });
});

