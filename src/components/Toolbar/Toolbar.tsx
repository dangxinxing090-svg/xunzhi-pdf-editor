import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { EditorMode } from '../../types/pdf';

const MODE_BUTTONS: Array<{ mode: EditorMode; label: string }> = [
  { mode: 'read', label: '阅读' },
  { mode: 'pages', label: '页面编辑' },
  { mode: 'content', label: '内容编辑' },
];

function ModeSwitcher() {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  return (
    <div className="mode-switcher">
      {MODE_BUTTONS.map((b) => (
        <button
          key={b.mode}
          className={mode === b.mode ? 'active' : ''}
          onClick={() => setMode(b.mode)}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

function ReadToolbar() {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const currentPageIndex = useEditorStore((s) => s.currentPageIndex);
  const setCurrentPageIndex = useEditorStore((s) => s.setCurrentPageIndex);
  const activeDocId = useEditorStore((s) => s.activeDocId);
  const pageCount = useEditorStore((s) => s.pages).filter(
    (p) => p.sourceDocId === activeDocId,
  ).length;
  const [pageInput, setPageInput] = useState(String(currentPageIndex + 1));

  const handleJump = (val: string) => {
    const n = parseInt(val, 10);
    if (!Number.isNaN(n)) {
      const idx = Math.max(1, Math.min(pageCount, n)) - 1;
      setCurrentPageIndex(idx);
      setPageInput(String(idx + 1));
      const el = document.querySelector(`[data-page-idx="${idx}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setPageInput(String(currentPageIndex + 1));
    }
  };

  return (
    <>
      <button onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.25}>−</button>
      <span className="zoom-display">{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= 4}>+</button>
      <button onClick={() => setZoom(1.0)}>适合宽度</button>
      <span className="divider" />
      <input
        className="page-jump"
        value={pageInput}
        onChange={(e) => setPageInput(e.target.value)}
        onBlur={(e) => handleJump(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleJump((e.target as HTMLInputElement).value)}
      />
      <span className="page-count">/ {pageCount}</span>
    </>
  );
}

function ContentToolbar() {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  const tools: Array<{ tool: typeof activeTool; label: string }> = [
    { tool: 'select', label: '选择' },
    { tool: 'rect', label: '矩形框' },
    { tool: 'ellipse', label: '圆形框' },
    { tool: 'highlight', label: '高亮' },
    { tool: 'text', label: '文本批注' },
    { tool: 'image', label: '插入图片' },
  ];

  return (
    <>
      <div className="tool-group">
        {tools.map((t) => (
          <button
            key={t.tool}
            className={activeTool === t.tool ? 'active' : ''}
            onClick={() => setActiveTool(t.tool)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <span className="divider" />
      <span className="tool-placeholder">水印/页眉/页脚/裁剪/应用(阶段3-4)</span>
      <span className="spacer" />
      <button onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.25}>−</button>
      <span className="zoom-display">{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= 4}>+</button>
    </>
  );
}

function PagesToolbar() {
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const exportPdf = useEditorStore((s) => s.exportPdf);
  const isExporting = useEditorStore((s) => s.isExporting);
  const selection = useEditorStore((s) => s.selection);
  const selectedDocIds = useEditorStore((s) => s.selectedDocIds);
  const rotatePages = useEditorStore((s) => s.rotatePages);
  const deletePages = useEditorStore((s) => s.deletePages);
  const insertBlankPage = useEditorStore((s) => s.insertBlankPage);
  const duplicatePages = useEditorStore((s) => s.duplicatePages);
  const splitToNewDocument = useEditorStore((s) => s.splitToNewDocument);
  const saveSelectionAsDoc = useEditorStore((s) => s.saveSelectionAsDoc);
  const mergeDocuments = useEditorStore((s) => s.mergeDocuments);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const hasSelection = selection.size > 0;
  const sel = [...selection];

  const handleOpen = async () => {
    const files = await window.electronAPI.openPdfDialog();
    if (!files) return;
    for (const f of files) {
      await loadDocument(f.path, f.name);
    }
  };

  const handleExport = (mode: 'current' | 'selected' | 'all') => {
    setShowExportMenu(false);
    void exportPdf(mode);
  };

  return (
    <>
      <button onClick={handleOpen}>打开</button>
      <div className="export-menu">
        <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={isExporting}>
          {isExporting ? '导出中...' : '导出 ▾'}
        </button>
        {showExportMenu && (
          <div className="dropdown">
            <button onClick={() => handleExport('current')}>导出当前文档</button>
            <button onClick={() => handleExport('selected')} disabled={!hasSelection}>导出选中页</button>
            <button onClick={() => handleExport('all')}>合并全部导出</button>
          </div>
        )}
      </div>
      <span className="divider" />
      <button onClick={() => void insertBlankPage()} disabled={!useEditorStore.getState().activeDocId}>+ 空白页</button>
      <button onClick={() => void duplicatePages(sel)} disabled={!hasSelection}>复制</button>
      <button onClick={() => rotatePages(sel, 90)} disabled={!hasSelection}>↻ 旋转</button>
      <button onClick={() => deletePages(sel)} disabled={!hasSelection}>✕ 删除</button>
      <span className="divider" />
      <button onClick={() => void splitToNewDocument(sel)} disabled={!hasSelection}>拆分</button>
      <button onClick={() => void saveSelectionAsDoc(sel)} disabled={!hasSelection}>另存文档</button>
      <button onClick={() => void mergeDocuments([...selectedDocIds])} disabled={selectedDocIds.size < 2}>合并文档{selectedDocIds.size >= 2 ? ` (${selectedDocIds.size})` : ''}</button>
      <span className="spacer" />
      <button onClick={undo} disabled={!canUndo}>↶</button>
      <button onClick={redo} disabled={!canRedo}>↷</button>
    </>
  );
}

export function Toolbar() {
  const mode = useEditorStore((s) => s.mode);
  const activeDocId = useEditorStore((s) => s.activeDocId);
  return (
    <div className="toolbar">
      <ModeSwitcher />
      <span className="divider" />
      {activeDocId ? (
        mode === 'read' ? <ReadToolbar /> : mode === 'content' ? <ContentToolbar /> : <PagesToolbar />
      ) : (
        <span className="empty-hint">打开 PDF 文档开始</span>
      )}
    </div>
  );
}
