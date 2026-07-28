import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useEditorStore } from '../../store/editorStore';
import { PageCard } from './PageCard';

export function PageGrid() {
  const pages = useEditorStore((s) => s.pages);
  const movePages = useEditorStore((s) => s.movePages);

  if (pages.length === 0) {
    return (
      <div className="page-grid empty">
        <p>点击"打开"加载 PDF 文件</p>
      </div>
    );
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const toIndex = pages.findIndex((p) => p.id === over.id);
    if (toIndex === -1) return;
    movePages([String(active.id)], toIndex);
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="page-grid">
          {pages.map((page, index) => (
            <PageCard key={page.id} page={page} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
