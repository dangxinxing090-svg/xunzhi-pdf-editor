import { useEffect, useRef } from 'react';
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
      .renderThumb(page.sourceDocId, page.sourcePageIndex, page.rotation)
      .then((bitmap) => {
        if (cancelled) return;
        setPageThumbnail(page.id, bitmap);
        drawToCanvas(canvasRef.current, bitmap, page.rotation);
      });
    return () => {
      cancelled = true;
    };
  }, [page.thumbnail, page.rotation, page.id, page.sourceDocId, page.sourcePageIndex, setPageThumbnail]);

  const handleClick = (e: React.MouseEvent) => {
    selectPage(page.id, e.ctrlKey || e.metaKey, e.shiftKey);
  };

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
      {...attributes}
      {...listeners}
    >
      <canvas ref={canvasRef} />
      <span className="page-number">{index + 1}</span>
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
