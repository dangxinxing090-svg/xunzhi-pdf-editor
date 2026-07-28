import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Page } from '../../types/pdf';
import { useEditorStore } from '../../store/editorStore';
import { workerClient } from '../../worker/workerClient';

interface Props {
  page: Page;
  index: number;
}

export function PageCard({ page, index }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setPageThumbnail = useEditorStore((s) => s.setPageThumbnail);
  const selected = useEditorStore((s) => s.selection.has(page.id));
  const selectPage = useEditorStore((s) => s.selectPage);
  const rotatePages = useEditorStore((s) => s.rotatePages);
  const deletePages = useEditorStore((s) => s.deletePages);
  const insertBlankPage = useEditorStore((s) => s.insertBlankPage);
  const duplicatePages = useEditorStore((s) => s.duplicatePages);
  const splitToNewDocument = useEditorStore((s) => s.splitToNewDocument);
  const saveSelectionAsDoc = useEditorStore((s) => s.saveSelectionAsDoc);
  const exportPdf = useEditorStore((s) => s.exportPdf);
  const [menuOpen, setMenuOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  useEffect(() => {
    if (page.thumbnail) {
      drawToCanvas(canvasRef.current, page.thumbnail, page.rotation);
      return;
    }
    let cancelled = false;
    workerClient
      .renderThumb(page.sourceDocId, page.sourcePageIndex)
      .then((bitmap) => {
        if (cancelled) return;
        setPageThumbnail(page.id, bitmap);
        drawToCanvas(canvasRef.current, bitmap, page.rotation);
      });
    return () => {
      cancelled = true;
    };
  }, [page.thumbnail, page.rotation, page.id, page.sourceDocId, page.sourcePageIndex, setPageThumbnail]);

  // 右键菜单打开时,点击外部关闭
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [menuOpen]);

  const handleClick = (e: React.MouseEvent) => {
    selectPage(page.id, e.ctrlKey || e.metaKey, e.shiftKey);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 右键未选中的页面时,先选中该页(常见 UX)
    if (!selected) selectPage(page.id, false, false);
    setMenuOpen(true);
  };

  const sel = [...useEditorStore.getState().selection];
  const effectiveSel = sel.length > 0 ? sel : [page.id];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`page-card ${page.deleted ? 'deleted' : ''} ${selected ? 'selected' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      {...attributes}
      {...listeners}
    >
      <canvas ref={canvasRef} />
      <span className="page-number">{index + 1}</span>
      {menuOpen && (
        <div className="context-menu">
          <button onClick={() => { setMenuOpen(false); void insertBlankPage(); }}>+ 插入空白页</button>
          <button onClick={() => { setMenuOpen(false); void duplicatePages(effectiveSel); }}>复制页面</button>
          <button onClick={() => { setMenuOpen(false); rotatePages(effectiveSel, 90); }}>↻ 旋转 90°</button>
          <button onClick={() => { setMenuOpen(false); deletePages(effectiveSel); }}>✕ 删除</button>
          <div className="menu-sep" />
          <button onClick={() => { setMenuOpen(false); void splitToNewDocument(effectiveSel); }}>拆分到新文档</button>
          <button onClick={() => { setMenuOpen(false); void saveSelectionAsDoc(effectiveSel); }}>另存为新文档</button>
          <button onClick={() => { setMenuOpen(false); void exportPdf('selected'); }}>导出选中页</button>
        </div>
      )}
    </div>
  );
}

function drawToCanvas(
  canvas: HTMLCanvasElement | null,
  bitmap: ImageBitmap,
  rotation: number,
): void {
  if (!canvas) return;
  const isLandscape = rotation === 90 || rotation === 270;
  canvas.width = isLandscape ? bitmap.height : bitmap.width;
  canvas.height = isLandscape ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
}
