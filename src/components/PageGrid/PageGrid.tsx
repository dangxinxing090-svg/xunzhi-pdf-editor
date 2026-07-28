import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useEditorStore } from '../../store/editorStore';
import { PageCard } from './PageCard';

export function PageGrid() {
  const pages = useEditorStore((s) => s.pages);
  const selection = useEditorStore((s) => s.selection);
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
    // 拖动选中项时移动整组;否则只移动被拖的单页。
    const activeId = String(active.id);
    const movingIds = selection.has(activeId) && selection.size > 1
      ? [...selection]
      : [activeId];
    movePages(movingIds, toIndex);
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
