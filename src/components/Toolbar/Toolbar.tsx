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
  const [showExportMenu, setShowExportMenu] = useState(false);

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
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          disabled={isExporting}
        >
          {isExporting ? '导出中...' : '导出 ▾'}
        </button>
        {showExportMenu && (
          <div className="dropdown">
            <button onClick={() => handleExport('current')}>导出当前文档</button>
            <button onClick={() => handleExport('selected')}>导出选中页</button>
            <button onClick={() => handleExport('all')}>合并全部导出</button>
          </div>
        )}
      </div>
      <span className="spacer" />
      <button onClick={undo} disabled={!canUndo}>↶</button>
      <button onClick={redo} disabled={!canRedo}>↷</button>
    </div>
  );
}
