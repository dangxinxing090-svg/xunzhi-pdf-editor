import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

// Mock workerClient: createDocFromPages 返回合成文档元数据
vi.mock('../../src/worker/workerClient', () => ({
  workerClient: {
    loadDoc: vi.fn(),
    renderThumb: vi.fn(),
    exportPdf: vi.fn(),
    disposeDoc: vi.fn().mockResolvedValue(null),
    createDocFromPages: vi.fn().mockResolvedValue({
      pageCount: 1,
      pages: [{ width: 595, height: 842 }],
    }),
  },
}));

function seedDoc(docId: string, pageIds: string[], widths: number[] = []): void {
  const pages = pageIds.map((id, i) => ({
    id,
    sourceDocId: docId,
    sourcePageIndex: i,
    rotation: 0 as const,
    width: widths[i] ?? 595,
    height: widths[i] ? 842 : 842,
    thumbnail: null,
    deleted: false,
  }));
  useEditorStore.setState({
    sourceDocs: [{ id: docId, fileName: `${docId}.pdf`, pageCount: pageIds.length }],
    pages,
    activeDocId: docId,
    selection: new Set(),
    lastSelectedId: null,
    past: [],
    future: [],
  });
}

describe('insertBlankPage', () => {
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

  it('inserts a blank page after the selected page with same size', async () => {
    seedDoc('doc1', ['p0', 'p1'], [595, 595]);
    useEditorStore.getState().selectPage('p0', false, false);
    await useEditorStore.getState().insertBlankPage();

    const pages = useEditorStore.getState().pages;
    // 新空白页应在 p0 之后
    expect(pages[0].id).toBe('p0');
    expect(pages[1].sourceDocId).not.toBe('doc1'); // 引用合成文档
    expect(pages[1].width).toBe(595);
    expect(pages[1].height).toBe(842);
    expect(pages[2].id).toBe('p1');
  });

  it('appends to end when nothing selected', async () => {
    seedDoc('doc1', ['p0'], [595]);
    await useEditorStore.getState().insertBlankPage();

    const pages = useEditorStore.getState().pages;
    expect(pages[1].sourceDocId).not.toBe('doc1');
    expect(pages[1].width).toBe(595); // 默认 A4
  });

  it('adds a synthetic sourceDoc for the blank page', async () => {
    seedDoc('doc1', ['p0'], [595]);
    useEditorStore.getState().selectPage('p0', false, false);
    await useEditorStore.getState().insertBlankPage();

    const docs = useEditorStore.getState().sourceDocs;
    expect(docs.length).toBe(2);
    expect(docs.some((d) => d.id !== 'doc1')).toBe(true);
  });

  it('pushes undo command that removes the blank page', async () => {
    seedDoc('doc1', ['p0'], [595]);
    useEditorStore.getState().selectPage('p0', false, false);
    await useEditorStore.getState().insertBlankPage();
    expect(useEditorStore.getState().past.length).toBe(1);
    expect(useEditorStore.getState().pages.length).toBe(2);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages.length).toBe(1);
    expect(useEditorStore.getState().pages[0].id).toBe('p0');
  });

  it('calls workerClient.createDocFromPages with blank spec', async () => {
    seedDoc('doc1', ['p0'], [595]);
    useEditorStore.getState().selectPage('p0', false, false);
    const { workerClient } = await import('../../src/worker/workerClient');
    await useEditorStore.getState().insertBlankPage();
    expect(workerClient.createDocFromPages).toHaveBeenCalledWith(
      expect.any(String),
      [{ blank: true, width: 595, height: 842 }],
    );
  });
});
