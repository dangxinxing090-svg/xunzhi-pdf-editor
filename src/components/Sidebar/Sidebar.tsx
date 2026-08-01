import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';

export function Sidebar() {
  const sourceDocs = useEditorStore((s) => s.sourceDocs);
  const pages = useEditorStore((s) => s.pages);
  const activeDocId = useEditorStore((s) => s.activeDocId);
  const selectedDocIds = useEditorStore((s) => s.selectedDocIds);
  const closeDocument = useEditorStore((s) => s.closeDocument);
  const selectDoc = useEditorStore((s) => s.selectDoc);
  const moveDocUp = useEditorStore((s) => s.moveDocUp);
  const moveDocDown = useEditorStore((s) => s.moveDocDown);
  const saveDocAs = useEditorStore((s) => s.saveDocAs);
  const renameDocument = useEditorStore((s) => s.renameDocument);
  const mergeDocuments = useEditorStore((s) => s.mergeDocuments);
  const [menuDocId, setMenuDocId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  // 进入重命名模式时聚焦并选中文字
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleContextMenu = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuDocId(docId);
  };

  const handleClose = (docId: string) => {
    setMenuDocId(null);
    void closeDocument(docId);
  };

  const startRename = (docId: string, currentName: string) => {
    setMenuDocId(null);
    setRenameValue(currentName);
    setRenamingId(docId);
  };

  const commitRename = () => {
    const id = renamingId;
    const value = renameValue;
    setRenamingId(null);
    if (id && value.trim()) {
      void renameDocument(id, value);
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
  };

  const docIndex = menuDocId ? sourceDocs.findIndex((d) => d.id === menuDocId) : -1;
  const menuDoc = menuDocId ? sourceDocs.find((d) => d.id === menuDocId) : undefined;

  return (
    <div className="sidebar">
      <h3>文档</h3>
      {sourceDocs.length === 0 && <p className="empty">未加载文档</p>}
      {sourceDocs.map((doc) => (
        <div
          key={doc.id}
          className={`doc-item ${doc.id === activeDocId ? 'active' : ''} ${selectedDocIds.has(doc.id) ? 'selected' : ''}`}
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) selectDoc(doc.id, true);
            else selectDoc(doc.id, false);
          }}
          onContextMenu={(e) => handleContextMenu(e, doc.id)}
        >
          <span className="doc-name">
            {renamingId === doc.id ? (
              <input
                ref={renameInputRef}
                className="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  else if (e.key === 'Escape') cancelRename();
                }}
                onBlur={commitRename}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              doc.fileName
            )}
          </span>
          <span className="doc-count">{pages.filter((p) => p.sourceDocId === doc.id && !p.deleted).length} 页</span>
          {menuDocId === doc.id && (
            selectedDocIds.size >= 2 ? (
              // 多选文档右键:仅提供合并(与工具栏合并按钮一致),隐藏其余项。
              <div className="context-menu" ref={menuRef}>
                <button onClick={() => { setMenuDocId(null); void mergeDocuments([...selectedDocIds]); }}>
                  合并文档
                </button>
              </div>
            ) : (
              <div className="context-menu" ref={menuRef}>
                <button
                  onClick={() => { setMenuDocId(null); moveDocUp(doc.id); }}
                  disabled={docIndex <= 0}
                >
                  上移
                </button>
                <button
                  onClick={() => { setMenuDocId(null); moveDocDown(doc.id); }}
                  disabled={docIndex === -1 || docIndex >= sourceDocs.length - 1}
                >
                  下移
                </button>
                <div className="menu-sep" />
                <button onClick={() => { setMenuDocId(null); void saveDocAs(doc.id); }}>
                  另存为…
                </button>
                {menuDoc?.filePath && (
                  <button onClick={() => startRename(doc.id, doc.fileName)}>
                    重命名…
                  </button>
                )}
                <div className="menu-sep" />
                <button onClick={() => handleClose(doc.id)}>关闭文档</button>
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}
