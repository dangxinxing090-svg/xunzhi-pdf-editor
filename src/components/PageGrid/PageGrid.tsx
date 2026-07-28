import { useEditorStore } from '../../store/editorStore';
import { PageCard } from './PageCard';

export function PageGrid() {
  const pages = useEditorStore((s) => s.pages);

  if (pages.length === 0) {
    return (
      <div className="page-grid empty">
        <p>点击"打开"加载 PDF 文件</p>
      </div>
    );
  }

  return (
    <div className="page-grid">
      {pages.map((page, index) => (
        <PageCard key={page.id} page={page} index={index} />
      ))}
    </div>
  );
}
