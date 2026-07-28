import { useEditorStore } from '../../store/editorStore';

export function StatusBar() {
  const pages = useEditorStore((s) => s.pages);
  const deletedCount = pages.filter((p) => p.deleted).length;

  return (
    <div className="status-bar">
      共 {pages.length} 页 · 已删除 {deletedCount}
    </div>
  );
}
