import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';
import { workerClient } from '../../src/worker/workerClient';

vi.mock('../../src/worker/workerClient', () => {
  return {
    workerClient: {
      loadDoc: vi.fn(),
      exportPdf: vi.fn(),
      disposeDoc: vi.fn().mockResolvedValue(null),
      createDocFromPages: vi.fn().mockImplementation(async (_id: string, pages: any[]) => {
        return {
          meta: {
            pageCount: pages.length,
            pages: pages.map((p: any) => ({ width: p.width ?? 595, height: p.height ?? 842 })),
          },
          renderBuffer: new ArrayBuffer(0),
        };
      }),
      insertPagesIntoDoc: vi.fn().mockImplementation(async (docId: string, insertAt: number, pages: any[]) => {
        const origCount = 2;
        const meta = {
          pageCount: origCount + pages.length,
          pages: Array.from({ length: origCount + pages.length }, (_, i) => {
            const inRange = i >= insertAt && i < insertAt + pages.length;
            const spec = inRange ? pages[i - insertAt] : null;
            return { width: spec && 'blank' in spec ? spec.width : 595, height: spec && 'blank' in spec ? spec.height : 842 };
          }),
        };
        return { meta, renderBuffer: new ArrayBuffer(0) };
      }),
    },
  };
});

function seedDoc(docId: string, pageIds: string[]): void {
  const pages = pageIds.map((id, i) => ({
    id,
    sourceDocId: docId,
    sourcePageIndex: i,
    rotation: 0 as const,
    width: 595,
    height: 842,
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

describe('duplicatePages', () => {
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

  it('inserts a copy before the selected page, in the same document', async () => {
    seedDoc('doc1', ['p0', 'p1']);
    useEditorStore.getState().selectPage('p0', false, false);
    await useEditorStore.getState().duplicatePages(['p0']);

    const docPages = useEditorStore.getState().pages.filter((p) => p.sourceDocId === 'doc1');
    expect(docPages.length).toBe(3);
    // 副本在 p0 之前(索引 0),p0 后移到索引 1,p1 后移到索引 2
    expect(docPages[0].id).not.toBe('p0');
    expect(docPages[0].sourceDocId).toBe('doc1');
    expect(docPages[1].id).toBe('p0');
    expect(docPages[2].id).toBe('p1');
  });

  it('undo removes all duplicates', async () => {
    seedDoc('doc1', ['p0', 'p1']);
    await useEditorStore.getState().duplicatePages(['p0', 'p1']);
    expect(useEditorStore.getState().pages.length).toBe(4);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages.length).toBe(2);
    expect(useEditorStore.getState().pages.map((p) => p.id)).toEqual(['p0', 'p1']);
  });
});

describe('splitToNewDocument', () => {
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

  it('moves selected pages to a new document and switches activeDocId', async () => {
    seedDoc('doc1', ['p0', 'p1', 'p2']);
    await useEditorStore.getState().splitToNewDocument(['p0', 'p2']);

    const state = useEditorStore.getState();
    // 新文档出现在 sourceDocs
    expect(state.sourceDocs.length).toBe(2);
    expect(state.activeDocId).not.toBe('doc1');
    // p0 和 p2 的 sourceDocId 改为新文档
    const newDocId = state.activeDocId;
    expect(state.pages.find((p) => p.id === 'p0')!.sourceDocId).toBe(newDocId);
    expect(state.pages.find((p) => p.id === 'p2')!.sourceDocId).toBe(newDocId);
    expect(state.pages.find((p) => p.id === 'p1')!.sourceDocId).toBe('doc1');
  });

  it('undo restores pages to original document', async () => {
    seedDoc('doc1', ['p0', 'p1']);
    await useEditorStore.getState().splitToNewDocument(['p0']);
    useEditorStore.getState().undo();
    const state = useEditorStore.getState();
    expect(state.pages.find((p) => p.id === 'p0')!.sourceDocId).toBe('doc1');
    expect(state.sourceDocs.length).toBe(1);
    expect(state.activeDocId).toBe('doc1');
  });
});

describe('mergeAllDocuments', () => {
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

  it('creates a merged document with all pages from all docs', async () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a.pdf', pageCount: 2 },
        { id: 'doc2', fileName: 'b.pdf', pageCount: 1 },
      ],
      pages: [
        { id: 'p0', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p1', sourceDocId: 'doc1', sourcePageIndex: 1, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p2', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 90, width: 595, height: 842, thumbnail: null, deleted: false },
      ],
      activeDocId: 'doc1',
    });
    await useEditorStore.getState().mergeAllDocuments();

    const state = useEditorStore.getState();
    expect(state.sourceDocs.length).toBe(3); // 原2 + 合并1
    expect(state.activeDocId).not.toBe('doc1');
    // 合并文档应有 3 页
    const mergedPages = state.pages.filter((p) => p.sourceDocId === state.activeDocId);
    expect(mergedPages.length).toBe(3);
    // 原文档页面保留
    expect(state.pages.filter((p) => p.sourceDocId === 'doc1').length).toBe(2);
  });

  it('does nothing with fewer than 2 documents', async () => {
    seedDoc('doc1', ['p0']);
    await useEditorStore.getState().mergeAllDocuments();
    expect(useEditorStore.getState().sourceDocs.length).toBe(1);
  });
});

describe('mergeDocuments', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sourceDocs: [],
      pages: [],
      activeDocId: null,
      selection: new Set(),
      lastSelectedId: null,
      selectedDocIds: new Set(),
      past: [],
      future: [],
    });
  });

  it('merges selected docs in sidebar order (not click order)', async () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a.pdf', pageCount: 1 },
        { id: 'doc2', fileName: 'b.pdf', pageCount: 1 },
        { id: 'doc3', fileName: 'c.pdf', pageCount: 1 },
      ],
      pages: [
        { id: 'p1', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p2', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p3', sourceDocId: 'doc3', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      ],
      activeDocId: 'doc1',
    });
    // 按 doc3 -> doc1 顺序传入(非 sourceDocs 数组顺序),但合并应按侧边栏顺序(doc1 在前)
    await useEditorStore.getState().mergeDocuments(['doc3', 'doc1']);

    const state = useEditorStore.getState();
    expect(state.sourceDocs.length).toBe(4); // 原3 + 合并1
    expect(state.activeDocId).not.toBe('doc1');
    const mergedPages = state.pages.filter((p) => p.sourceDocId === state.activeDocId);
    expect(mergedPages.length).toBe(2);
    // 合并后清空文档多选
    expect(state.selectedDocIds.size).toBe(0);
    // 新文档命名"合并文档",页数 2
    const mergedDoc = state.sourceDocs.find((d) => d.id === state.activeDocId);
    expect(mergedDoc?.fileName).toBe('合并文档');
    expect(mergedDoc?.pageCount).toBe(2);
    // 验证传给 worker 的 specs 顺序 = 侧边栏顺序(doc1 在前,doc3 在后),而非用户点击顺序
    const specsArg = vi.mocked(workerClient.createDocFromPages).mock.calls.at(-1)![1];
    expect(specsArg[0].sourceDocId).toBe('doc1');
    expect(specsArg[1].sourceDocId).toBe('doc3');
  });

  it('does nothing with fewer than 2 doc ids', async () => {
    useEditorStore.setState({
      sourceDocs: [{ id: 'doc1', fileName: 'a.pdf', pageCount: 1 }],
      pages: [{ id: 'p1', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false }],
      activeDocId: 'doc1',
    });
    await useEditorStore.getState().mergeDocuments(['doc1']);
    expect(useEditorStore.getState().sourceDocs.length).toBe(1);
  });
});

describe('moveDocUp / moveDocDown', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sourceDocs: [],
      pages: [],
      activeDocId: null,
      selection: new Set(),
      lastSelectedId: null,
      selectedDocIds: new Set(),
      past: [],
      future: [],
    });
  });

  it('moveDocUp swaps with previous doc and reorders pages', () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a.pdf', pageCount: 1 },
        { id: 'doc2', fileName: 'b.pdf', pageCount: 2 },
      ],
      pages: [
        { id: 'p1', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p2', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p3', sourceDocId: 'doc2', sourcePageIndex: 1, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      ],
      activeDocId: 'doc1',
    });
    useEditorStore.getState().moveDocUp('doc2');

    const state = useEditorStore.getState();
    // doc2 移到前面
    expect(state.sourceDocs.map((d) => d.id)).toEqual(['doc2', 'doc1']);
    // pages 顺序随之重排:doc2 的两页在前
    expect(state.pages.map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('moveDocUp on first doc is a no-op', () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a.pdf', pageCount: 1 },
        { id: 'doc2', fileName: 'b.pdf', pageCount: 1 },
      ],
      pages: [
        { id: 'p1', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p2', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      ],
      activeDocId: 'doc1',
    });
    useEditorStore.getState().moveDocUp('doc1');
    const state = useEditorStore.getState();
    expect(state.sourceDocs.map((d) => d.id)).toEqual(['doc1', 'doc2']);
    expect(state.pages.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('moveDocDown swaps with next doc and reorders pages', () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a.pdf', pageCount: 1 },
        { id: 'doc2', fileName: 'b.pdf', pageCount: 1 },
      ],
      pages: [
        { id: 'p1', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p2', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      ],
      activeDocId: 'doc1',
    });
    useEditorStore.getState().moveDocDown('doc1');

    const state = useEditorStore.getState();
    expect(state.sourceDocs.map((d) => d.id)).toEqual(['doc2', 'doc1']);
    expect(state.pages.map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('moveDocDown on last doc is a no-op', () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a.pdf', pageCount: 1 },
        { id: 'doc2', fileName: 'b.pdf', pageCount: 1 },
      ],
      pages: [
        { id: 'p1', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
        { id: 'p2', sourceDocId: 'doc2', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      ],
      activeDocId: 'doc1',
    });
    useEditorStore.getState().moveDocDown('doc2');
    const state = useEditorStore.getState();
    expect(state.sourceDocs.map((d) => d.id)).toEqual(['doc1', 'doc2']);
    expect(state.pages.map((p) => p.id)).toEqual(['p1', 'p2']);
  });
});

describe('renameDocument', () => {
  let renameCalls: Array<[string, string]> = [];

  beforeEach(() => {
    renameCalls = [];
    // 测试环境无 window.electronAPI,直接挂一个最小 stub
    (globalThis as any).window = {
      ...(globalThis as any).window,
      electronAPI: {
        renameFile: async (oldPath: string, newPath: string) => {
          renameCalls.push([oldPath, newPath]);
          return true;
        },
      },
    };
    useEditorStore.setState({
      sourceDocs: [],
      pages: [],
      activeDocId: null,
      selection: new Set(),
      lastSelectedId: null,
      selectedDocIds: new Set(),
      past: [],
      future: [],
    });
  });

  it('renames disk file and updates fileName + filePath', async () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a', pageCount: 1, filePath: '/docs/a.pdf' },
      ],
      pages: [
        { id: 'p1', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 0, width: 595, height: 842, thumbnail: null, deleted: false },
      ],
      activeDocId: 'doc1',
    });
    await useEditorStore.getState().renameDocument('doc1', '新名字');

    // 调用了磁盘 rename
    expect(renameCalls).toHaveLength(1);
    expect(renameCalls[0][0]).toBe('/docs/a.pdf');
    expect(renameCalls[0][1]).toBe('/docs/新名字.pdf');

    // 应用内显示名 + 路径更新
    const doc = useEditorStore.getState().sourceDocs[0];
    expect(doc.fileName).toBe('新名字');
    expect(doc.filePath).toBe('/docs/新名字.pdf');
  });

  it('normalizes extension: user input with .pdf suffix', async () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a', pageCount: 1, filePath: '/docs/a.pdf' },
      ],
      pages: [],
      activeDocId: 'doc1',
    });
    await useEditorStore.getState().renameDocument('doc1', 'b.pdf');
    expect(renameCalls[0][1]).toBe('/docs/b.pdf');
    expect(useEditorStore.getState().sourceDocs[0].fileName).toBe('b');
  });

  it('is a no-op for in-memory doc (filePath null)', async () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: '合并文档', pageCount: 2, filePath: null },
      ],
      pages: [],
      activeDocId: 'doc1',
    });
    await useEditorStore.getState().renameDocument('doc1', 'x');
    expect(renameCalls).toHaveLength(0);
    expect(useEditorStore.getState().sourceDocs[0].fileName).toBe('合并文档');
  });

  it('rejects invalid name with path separator', async () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a', pageCount: 1, filePath: '/docs/a.pdf' },
      ],
      pages: [],
      activeDocId: 'doc1',
    });
    await useEditorStore.getState().renameDocument('doc1', 'evil/path');
    expect(renameCalls).toHaveLength(0);
    expect(useEditorStore.getState().error).toBeTruthy();
  });

  it('is a no-op when name unchanged', async () => {
    useEditorStore.setState({
      sourceDocs: [
        { id: 'doc1', fileName: 'a', pageCount: 1, filePath: '/docs/a.pdf' },
      ],
      pages: [],
      activeDocId: 'doc1',
    });
    await useEditorStore.getState().renameDocument('doc1', 'a');
    expect(renameCalls).toHaveLength(0);
  });
});
