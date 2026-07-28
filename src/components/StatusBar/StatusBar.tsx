import { useEditorStore } from '../../store/editorStore';

export function StatusBar() {
  const allPages = useEditorStore((s) => s.pages);
  const activeDocId = useEditorStore((s) => s.activeDocId);
  const selection = useEditorStore((s) => s.selection);
  const error = useEditorStore((s) => s.error);
  const isExporting = useEditorStore((s) => s.isExporting);

  // 只统计当前活跃文档的页面(与中间网格视图一致)
  const pages = allPages.filter((p) => p.sourceDocId === activeDocId);
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
