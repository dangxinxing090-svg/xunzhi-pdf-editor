import { useEditorStore } from '../../store/editorStore';

export function InspectorPanel() {
  const pages = useEditorStore((s) => s.pages);
  const selection = useEditorStore((s) => s.selection);
  const rotatePages = useEditorStore((s) => s.rotatePages);
  const deletePages = useEditorStore((s) => s.deletePages);

  const selectedPages = pages.filter((p) => selection.has(p.id) && !p.deleted);
  if (selectedPages.length === 0) {
    return (
      <div className="inspector-panel">
        <h3>属性</h3>
        <p className="empty">未选中页面</p>
      </div>
    );
  }

  const first = selectedPages[0];

  return (
    <div className="inspector-panel">
      <h3>属性</h3>
      <p>选中 {selectedPages.length} 页</p>
      {selectedPages.length === 1 && (
        <>
          <p>第 {pages.indexOf(first) + 1} 页</p>
          <p>{Math.round(first.width)} × {Math.round(first.height)}</p>
          <p>旋转:{first.rotation}°</p>
        </>
      )}
      <button onClick={() => rotatePages([...selection], 90)}>↻ 旋转 90°</button>
      <button onClick={() => deletePages([...selection])}>✕ 删除</button>
    </div>
  );
}
