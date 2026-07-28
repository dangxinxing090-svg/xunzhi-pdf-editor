import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';

export function Sidebar() {
  const sourceDocs = useEditorStore((s) => s.sourceDocs);
  const activeDocId = useEditorStore((s) => s.activeDocId);
  const closeDocument = useEditorStore((s) => s.closeDocument);
  const setActiveDoc = useEditorStore((s) => s.setActiveDoc);
  const [menuDocId, setMenuDocId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!menuDocId) return;
    const handler = () => setMenuDocId(null);
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [menuDocId]);

  const handleContextMenu = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuDocId(docId);
  };

  const handleClose = (docId: string) => {
    setMenuDocId(null);
    void closeDocument(docId);
  };

  return (
    <div className="sidebar">
      <h3>文档</h3>
      {sourceDocs.length === 0 && <p className="empty">未加载文档</p>}
      {sourceDocs.map((doc) => (
        <div
          key={doc.id}
          className={`doc-item ${doc.id === activeDocId ? 'active' : ''}`}
          onClick={() => setActiveDoc(doc.id)}
          onContextMenu={(e) => handleContextMenu(e, doc.id)}
        >
          <span className="doc-name">{doc.fileName}</span>
          <span className="doc-count">{doc.pageCount} 页</span>
          {menuDocId === doc.id && (
            <div className="context-menu" ref={menuRef}>
              <button onClick={() => handleClose(doc.id)}>关闭文档</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
