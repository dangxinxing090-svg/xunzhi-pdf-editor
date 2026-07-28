import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useEditorStore } from '../../store/editorStore';
import { PageCard } from './PageCard';

export function PageGrid() {
  const allPages = useEditorStore((s) => s.pages);
  const activeDocId = useEditorStore((s) => s.activeDocId);
  const selection = useEditorStore((s) => s.selection);
  const movePages = useEditorStore((s) => s.movePages);

  // 点击与拖拽分离:指针移动 < 8px 视为点击(不启动拖拽),click 事件正常触发。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // 只显示当前活跃文档的页面(多文档各自独立,点击左侧文档切换)
  const pages = allPages.filter((p) => p.sourceDocId === activeDocId);

  if (pages.length === 0) {
    return (
      <div className="page-grid empty">
        <p>{activeDocId ? '该文档没有页面' : '点击"打开"加载 PDF 文件'}</p>
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
