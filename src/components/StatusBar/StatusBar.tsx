import { useEditorStore } from '../../store/editorStore';

export function StatusBar() {
  const pages = useEditorStore((s) => s.pages);
  const selection = useEditorStore((s) => s.selection);
  const error = useEditorStore((s) => s.error);
  const isExporting = useEditorStore((s) => s.isExporting);

  const deletedCount = pages.filter((p) => p.deleted).length;

  return (
    <div className="status-bar">
      <span>共 {pages.length} 页</span>
      <span>· 选中 {selection.size}</span>
      <span>· 已删除 {deletedCount}</span>
      {isExporting && <span className="status-exporting">· 导出中...</span>}
      {error && <span className="status-error">· 错误:{error}</span>}
    </div>
  );
}
