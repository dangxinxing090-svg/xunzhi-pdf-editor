import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PageGrid } from './components/PageGrid/PageGrid';
import { InspectorPanel } from './components/InspectorPanel/InspectorPanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import { ReaderView } from './components/ReaderView/ReaderView';
import { ContentInspector } from './components/AnnotationLayer/ContentInspector';
import { useEditorStore } from './store/editorStore';
import './App.css';

export default function App() {
  const mode = useEditorStore((s) => s.mode);
  const deletePages = useEditorStore((s) => s.deletePages);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const selection = useEditorStore((s) => s.selection);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      // 页面级快捷键(删除/全选)只在页面编辑模式生效,避免与内容编辑的标注删除冲突
      const pageShortcuts = useEditorStore.getState().mode === 'pages';
      if (e.key === 'Escape') {
        if (selection.size > 0) {
          e.preventDefault();
          clearSelection();
        }
      } else if (pageShortcuts && (e.key === 'Delete' || e.key === 'Backspace') && !isMod) {
        if (selection.size > 0) {
          e.preventDefault();
          deletePages([...selection]);
        }
      } else if (pageShortcuts && isMod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const { pages, selectPage } = useEditorStore.getState();
        pages.forEach((p) => {
          if (!p.deleted) selectPage(p.id, true, false);
        });
      } else if (isMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isMod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection, deletePages, undo, redo, clearSelection]);

  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        {mode === 'pages' ? (
          <>
            <Sidebar />
            <PageGrid />
            <InspectorPanel />
          </>
        ) : (
          <>
            <ReaderView />
            {mode === 'content' && <ContentInspector />}
          </>
        )}
      </div>
      <StatusBar />
    </div>
  );
}
