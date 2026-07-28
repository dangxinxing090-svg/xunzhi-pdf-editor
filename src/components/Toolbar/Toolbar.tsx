import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';

export function Toolbar() {
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const exportPdf = useEditorStore((s) => s.exportPdf);
  const isExporting = useEditorStore((s) => s.isExporting);
  const selection = useEditorStore((s) => s.selection);
  const sourceDocs = useEditorStore((s) => s.sourceDocs);
  const rotatePages = useEditorStore((s) => s.rotatePages);
  const deletePages = useEditorStore((s) => s.deletePages);
  const insertBlankPage = useEditorStore((s) => s.insertBlankPage);
  const duplicatePages = useEditorStore((s) => s.duplicatePages);
  const splitToNewDocument = useEditorStore((s) => s.splitToNewDocument);
  const saveSelectionAsDoc = useEditorStore((s) => s.saveSelectionAsDoc);
  const mergeAllDocuments = useEditorStore((s) => s.mergeAllDocuments);
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
    <div className="toolbar">
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
      <button onClick={() => void mergeAllDocuments()} disabled={sourceDocs.length < 2}>合并文档</button>
      <span className="spacer" />
      <button onClick={undo} disabled={!canUndo}>↶</button>
      <button onClick={redo} disabled={!canRedo}>↷</button>
    </div>
  );
}
