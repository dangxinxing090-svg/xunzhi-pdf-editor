import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { EditorMode } from '../../types/pdf';
import { ContentForms, openDialog } from '../AnnotationLayer/ContentForms';
import { SettingsPanel, openSettings } from '../SettingsPanel/SettingsPanel';

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

/** 文件操作:打开 + 导出当前文档。三种模式共享。 */
function FileOps() {
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const exportPdf = useEditorStore((s) => s.exportPdf);
  const isExporting = useEditorStore((s) => s.isExporting);

  const handleOpen = async () => {
    const files = await window.electronAPI.openPdfDialog();
    if (!files) return;
    for (const f of files) {
      await loadDocument(f.path, f.name);
    }
  };

  return (
    <>
      <button onClick={handleOpen}>打开</button>
      <button onClick={() => void exportPdf('current')} disabled={isExporting}>
        {isExporting ? '导出中...' : '导出'}
      </button>
    </>
  );
}

/** 撤销/重做:在「导出」右侧,仅页面/内容编辑模式显示。 */
function UndoRedoButtons() {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  return (
    <>
      <button onClick={undo} disabled={!canUndo} title="撤销 (Ctrl+Z)"><UndoIcon /></button>
      <button onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Shift+Z)"><RedoIcon /></button>
    </>
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
      <span className="spacer" />
      <div className="zoom-group">
        <button onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.25}>−</button>
        <span className="zoom-display">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= 4}>+</button>
      </div>
      <span className="spacer" />
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
  const applyAnnotations = useEditorStore((s) => s.applyAnnotations);
  const annotations = useEditorStore((s) => s.annotations);
  const [applying, setApplying] = useState(false);

  const tools: Array<{ tool: typeof activeTool; label: string }> = [
    { tool: 'select', label: '选择' },
    { tool: 'rect', label: '矩形框' },
    { tool: 'ellipse', label: '圆形框' },
    { tool: 'highlight', label: '高亮' },
    { tool: 'text', label: '文本批注' },
    { tool: 'image', label: '插入图片' },
    { tool: 'marquee', label: '圈取' },
  ];

  const annoCount = Object.values(annotations).reduce((n, list) => n + list.length, 0);

  const handleApply = async () => {
    if (annoCount === 0) return;
    if (!window.confirm(`将 ${annoCount} 个标注烘焙进 PDF,此操作不可撤销单个标注。继续?`)) return;
    setApplying(true);
    await applyAnnotations();
    setApplying(false);
  };

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
      <button onClick={() => openDialog('watermark')}>水印</button>
      <button onClick={() => openDialog('header')}>页眉</button>
      <button onClick={() => openDialog('footer')}>页脚</button>
      <span className="spacer" />
      <button className="apply-btn" onClick={handleApply} disabled={annoCount === 0 || applying}>
        {applying ? '应用中...' : `应用 (${annoCount})`}
      </button>
      <div className="toolbar-row2">
        <span className="spacer" />
        <div className="zoom-group">
          <button onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.25}>−</button>
          <span className="zoom-display">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= 4}>+</button>
        </div>
        <span className="spacer" />
      </div>
      <ContentForms />
    </>
  );
}

/** 撤销图标:逆时针弯曲箭头(SVG,不依赖字体)。 */
function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-4" />
    </svg>
  );
}

/** 重做图标:顺时针弯曲箭头(SVG,不依赖字体)。 */
function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h4" />
    </svg>
  );
}

function PagesToolbar() {
  const selection = useEditorStore((s) => s.selection);
  const selectedDocIds = useEditorStore((s) => s.selectedDocIds);
  const rotatePages = useEditorStore((s) => s.rotatePages);
  const deletePages = useEditorStore((s) => s.deletePages);
  const insertBlankPage = useEditorStore((s) => s.insertBlankPage);
  const duplicatePages = useEditorStore((s) => s.duplicatePages);
  const splitToNewDocument = useEditorStore((s) => s.splitToNewDocument);
  const saveSelectionAsDoc = useEditorStore((s) => s.saveSelectionAsDoc);
  const mergeDocuments = useEditorStore((s) => s.mergeDocuments);

  const hasSelection = selection.size > 0;
  const sel = [...selection];

  return (
    <>
      <button onClick={() => void insertBlankPage()} disabled={!useEditorStore.getState().activeDocId}>+ 空白页</button>
      <button onClick={() => void duplicatePages(sel)} disabled={!hasSelection}>复制</button>
      <button onClick={() => rotatePages(sel, 90)} disabled={!hasSelection}>↻ 旋转</button>
      <button onClick={() => deletePages(sel)} disabled={!hasSelection}>✕ 删除</button>
      <span className="divider" />
      <button onClick={() => void splitToNewDocument(sel)} disabled={!hasSelection}>拆出</button>
      <button onClick={() => void saveSelectionAsDoc(sel)} disabled={!hasSelection}>复制为新文档</button>
      <button
        onClick={() => void mergeDocuments([...selectedDocIds])}
        disabled={selectedDocIds.size < 2}
        title={selectedDocIds.size >= 2 ? undefined : '选中2个或者以上文档点击后可以合并为1个文档'}
      >
        合并文档{selectedDocIds.size >= 2 ? ` (${selectedDocIds.size})` : ''}
      </button>
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
      <FileOps />
      {activeDocId && mode !== 'read' && (
        <>
          <span className="divider" />
          <UndoRedoButtons />
        </>
      )}
      {activeDocId && (
        <>
          <span className="divider" />
          {mode === 'read' ? <ReadToolbar /> : mode === 'content' ? <ContentToolbar /> : <PagesToolbar />}
        </>
      )}
      <span className="spacer" />
      {mode !== 'content' && (
        <button className="settings-btn" onClick={openSettings} title="设置">设置</button>
      )}
      <SettingsPanel />
    </div>
  );
}
