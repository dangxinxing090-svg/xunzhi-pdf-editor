import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PageGrid } from './components/PageGrid/PageGrid';
import { InspectorPanel } from './components/InspectorPanel/InspectorPanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import { ReaderView } from './components/ReaderView/ReaderView';
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
      if (e.key === 'Escape') {
        if (selection.size > 0) {
          e.preventDefault();
          clearSelection();
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isMod) {
        if (selection.size > 0) {
          e.preventDefault();
          deletePages([...selection]);
        }
      } else if (isMod && e.key.toLowerCase() === 'a') {
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
          <ReaderView />
        )}
      </div>
      <StatusBar />
    </div>
  );
}
