import { useEditorStore } from '../../store/editorStore';

export function Sidebar() {
  const sourceDocs = useEditorStore((s) => s.sourceDocs);
  const activeDocId = useEditorStore((s) => s.activeDocId);

  return (
    <div className="sidebar">
      <h3>文档</h3>
      {sourceDocs.length === 0 && <p className="empty">未加载文档</p>}
      {sourceDocs.map((doc) => (
        <div
          key={doc.id}
          className={`doc-item ${doc.id === activeDocId ? 'active' : ''}`}
        >
          <span className="doc-name">{doc.fileName}</span>
          <span className="doc-count">{doc.pageCount} 页</span>
        </div>
      ))}
    </div>
  );
}
