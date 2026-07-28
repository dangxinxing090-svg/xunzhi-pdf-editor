import { useEditorStore } from '../../store/editorStore';

export function Toolbar() {
  const loadDocument = useEditorStore((s) => s.loadDocument);

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
      <button disabled>↶</button>
      <button disabled>↷</button>
    </div>
  );
}
