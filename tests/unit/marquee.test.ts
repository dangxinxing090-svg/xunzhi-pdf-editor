import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';
import type { MarqueeAnno } from '../../src/types/pdf';

// mock renderPageRegionToDataURL:圈取"复制"依赖 pdf.js + DOM,这里返回固定 dataUrl。
vi.mock('../../src/lib/pdfRenderer', () => ({
  loadPdfForRender: vi.fn(),
  disposeRenderDoc: vi.fn(),
  renderPageToDataURL: vi.fn(),
  renderPageToCanvas: vi.fn(),
  renderPageRegionToDataURL: vi.fn().mockResolvedValue('data:image/png;base64,MOCK'),
}));

function seedMarquee(): MarqueeAnno {
  const anno: MarqueeAnno = {
    id: 'm1',
    pageId: 'p0',
    type: 'marquee',
    x: 100, y: 200, width: 80, height: 60,
    stroke: '#1976d2', strokeWidth: 2,
  };
  useEditorStore.setState({
    sourceDocs: [{ id: 'doc1', fileName: 'a.pdf', pageCount: 1 }],
    pages: [{ id: 'p0', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false }],
    activeDocId: 'doc1',
    currentPageIndex: 0,
    selection: new Set(),
    annotations: { p0: [anno] },
    selectedAnnoId: 'm1',
    past: [],
    future: [],
  });
  return anno;
}

describe('marquee annotation', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sourceDocs: [], pages: [], activeDocId: null,
      selection: new Set(), lastSelectedId: null,
      annotations: {}, selectedAnnoId: null,
      past: [], future: [],
    });
  });

  it('addAnnotation creates a marquee anno and pushes history', () => {
    seedMarquee(); // 已含一个 marquee
    const before = useEditorStore.getState().past.length;
    useEditorStore.getState().addAnnotation({
      id: 'm2', pageId: 'p0', type: 'marquee',
      x: 10, y: 10, width: 50, height: 50, stroke: '#000', strokeWidth: 1,
    });
    expect(useEditorStore.getState().past.length).toBe(before + 1);
    expect((useEditorStore.getState().annotations.p0).length).toBe(2);
  });

  it('redact (delete content): updateAnnotation sets fill white, toggles back', () => {
    seedMarquee();
    useEditorStore.getState().updateAnnotation('m1', { fill: '#ffffff' });
    let a = useEditorStore.getState().annotations.p0[0] as MarqueeAnno;
    expect(a.fill).toBe('#ffffff'); // 遮挡
    // 再取消遮挡
    useEditorStore.getState().updateAnnotation('m1', { fill: undefined });
    a = useEditorStore.getState().annotations.p0[0] as MarqueeAnno;
    expect(a.fill).toBeUndefined();
  });

  it('removeAnnotation deletes the marquee (un-redact by removing the box)', () => {
    seedMarquee();
    useEditorStore.getState().removeAnnotation('m1');
    expect(useEditorStore.getState().annotations.p0 ?? []).toHaveLength(0);
  });
});

describe('copyAnnoAsImage', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sourceDocs: [], pages: [], activeDocId: null,
      selection: new Set(), lastSelectedId: null,
      annotations: {}, selectedAnnoId: null,
      past: [], future: [],
    });
  });

  it('renders the marquee region and adds an image anno to the right, in history', async () => {
    const src = seedMarquee();
    const before = useEditorStore.getState().past.length;
    await useEditorStore.getState().copyAnnoAsImage('m1');
    const { annotations, past } = useEditorStore.getState();
    const list = annotations.p0;
    // 原 marquee + 新 image = 2
    expect(list.length).toBe(2);
    const img = list.find((a) => a.type === 'image')!;
    expect(img).toBeDefined();
    // 图片在原框右侧偏移,尺寸与圈取范围一致
    expect(img.x).toBe(src.x + src.width + 10);
    expect(img.y).toBe(src.y);
    expect(img.width).toBe(src.width);
    expect(img.height).toBe(src.height);
    // 入历史一条(复用 addAnnotation)
    expect(past.length).toBe(before + 1);
  });

  it('is a no-op for a non-marquee anno id', async () => {
    seedMarquee();
    // 不存在的 id
    await useEditorStore.getState().copyAnnoAsImage('does-not-exist');
    expect(useEditorStore.getState().annotations.p0.length).toBe(1); // 无新增
  });
});
