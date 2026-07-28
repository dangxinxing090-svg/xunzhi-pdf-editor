import { useEditorStore } from '../../store/editorStore';

export function Toolbar() {
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);

  const handleOpen = async () => {
    const files = await window.electronAPI.openPdfDialog();
    if (!files) return;
    for (const f of files) {
      await loadDocument(f.path, f.name);
    }
  };

  return (
    <div className="toolbar">
      <button onClick={handleOpen}>打开</button>
      <button disabled>导出 ▾</button>
      <span className="spacer" />
      <button onClick={undo} disabled={!canUndo}>↶</button>
      <button onClick={redo} disabled={!canRedo}>↷</button>
    </div>
  );
}
