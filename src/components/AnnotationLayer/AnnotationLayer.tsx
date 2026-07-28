import { useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { makePageRenderMeta, pdfRectToScreen, screenRectToPdf, screenToPdf } from '../../lib/coord';
import type { Page, Annotation, ContentTool, ShapeAnno, HighlightAnno, TextAnno, ImageAnno } from '../../types/pdf';
import './AnnotationLayer.css';

let annoCounter = 0;
function nextAnnoId(): string {
  return `a-${++annoCounter}`;
}

interface AnnotationLayerProps {
  page: Page;
  index: number;
  docId: string;
  displayWidth: number;
  displayHeight: number;
}

/**
 * 叠加在每页 canvas 上的交互层。负责创建/选中/拖动/删除标注对象。
 * 所有坐标存储用 PDF 坐标(pt,左下原点),显示时转换为屏幕像素。
 */
export function AnnotationLayer({ page, displayWidth, displayHeight }: AnnotationLayerProps) {
  const activeTool = useEditorStore((s) => s.activeTool);
  const annotations = useEditorStore((s) => s.annotations[page.id] ?? []);
  const selectedAnnoId = useEditorStore((s) => s.selectedAnnoId);
  const addAnnotation = useEditorStore((s) => s.addAnnotation);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const setCropDraft = useEditorStore((s) => s.setCropDraft);
  const cropDraft = useEditorStore((s) => s.cropDraft);

  const layerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCur, setDragCur] = useState<{ x: number; y: number } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveOffset, setMoveOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<{ x: number; y: number } | null>(null);

  const meta = makePageRenderMeta(page, displayWidth);

  const getLayerPos = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const rect = layerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ---- 创建:拖拽类(rect/ellipse/highlight) ----
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'select') {
      selectAnnotation(null);
      return;
    }
    const pos = getLayerPos(e);

    if (activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'highlight' || activeTool === 'crop') {
      setDragStart(pos);
      setDragCur(pos);
    } else if (activeTool === 'text') {
      setEditingText(pos);
    } else if (activeTool === 'image') {
      if (!pendingImage) {
        // 触发文件选择
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setPendingImage(reader.result as string);
          reader.readAsDataURL(file);
        };
        input.click();
      } else {
        // 已有图片,点击放置
        const pdf = screenToPdf(pos.x, pos.y, meta);
        const w = 150;
        const h = 150;
        const anno: ImageAnno = {
          id: nextAnnoId(),
          pageId: page.id,
          type: 'image',
          x: pdf.x,
          y: pdf.y,
          width: w,
          height: h,
          dataUrl: pendingImage,
        };
        addAnnotation(anno);
        setPendingImage(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart) {
      setDragCur(getLayerPos(e));
    } else if (movingId) {
      const pos = getLayerPos(e);
      const anno = annotations.find((a) => a.id === movingId);
      if (!anno) return;
      // 计算新位置:屏幕坐标移动量 -> PDF 坐标
      const oldScreen = pdfRectToScreen(anno.x, anno.y, anno.width, anno.height, meta);
      const newLeft = pos.x - moveOffset.dx;
      const newTop = pos.y - moveOffset.dy;
      const pdfRect = screenRectToPdf(newLeft, newTop, oldScreen.width, oldScreen.height, meta);
      updateAnnotation(movingId, { x: pdfRect.x, y: pdfRect.y });
    }
  };

  const handleMouseUp = () => {
    if (dragStart && dragCur) {
      const left = Math.min(dragStart.x, dragCur.x);
      const top = Math.min(dragStart.y, dragCur.y);
      const w = Math.abs(dragCur.x - dragStart.x);
      const h = Math.abs(dragCur.y - dragStart.y);
      if (w > 4 && h > 4) {
        const pdfRect = screenRectToPdf(left, top, w, h, meta);
        if (activeTool === 'crop') {
          // 裁剪:设置 cropDraft(框外区域将被裁掉)
          setCropDraft({ pageId: page.id, rect: pdfRect });
        } else {
          const base = {
            id: nextAnnoId(),
            pageId: page.id,
            x: pdfRect.x,
            y: pdfRect.y,
            width: pdfRect.width,
            height: pdfRect.height,
          };
          let anno: Annotation | null = null;
          if (activeTool === 'rect') {
            anno = { ...base, type: 'rect', stroke: '#ff0000', strokeWidth: 2 } as ShapeAnno;
          } else if (activeTool === 'ellipse') {
            anno = { ...base, type: 'ellipse', stroke: '#ff0000', strokeWidth: 2 } as ShapeAnno;
          } else {
            anno = { ...base, type: 'highlight', color: '#ffff00', opacity: 0.4 } as HighlightAnno;
          }
          if (anno) addAnnotation(anno);
        }
      }
    }
    setDragStart(null);
    setDragCur(null);
    setMovingId(null);
  };

  // ---- 选中/拖动已有对象 ----
  const handleAnnoMouseDown = (e: React.MouseEvent, anno: Annotation) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    selectAnnotation(anno.id);
    setMovingId(anno.id);
    const pos = getLayerPos(e);
    const screen = pdfRectToScreen(anno.x, anno.y, anno.width, anno.height, meta);
    setMoveOffset({ dx: pos.x - screen.left, dy: pos.y - screen.top });
  };

  const handleDelete = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnoId) {
      e.preventDefault();
      removeAnnotation(selectedAnnoId);
    }
  };

  const isDragTool = activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'highlight' || activeTool === 'crop';
  const dragRect =
    dragStart && dragCur
      ? {
          left: Math.min(dragStart.x, dragCur.x),
          top: Math.min(dragStart.y, dragCur.y),
          width: Math.abs(dragCur.x - dragStart.x),
          height: Math.abs(dragCur.y - dragStart.y),
        }
      : null;

  return (
    <div
      ref={layerRef}
      className={`annotation-layer ${activeTool !== 'select' ? 'creating' : ''}`}
      style={{ width: displayWidth, height: displayHeight }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleDelete}
      tabIndex={0}
    >
      {annotations.map((anno) => {
        const screen = pdfRectToScreen(anno.x, anno.y, anno.width, anno.height, meta);
        const selected = anno.id === selectedAnnoId;
        const common = {
          left: screen.left,
          top: screen.top,
          width: screen.width,
          height: screen.height,
        };
        if (anno.type === 'rect') {
          return (
            <div
              key={anno.id}
              className={`anno-shape anno-rect ${selected ? 'selected' : ''}`}
              style={{ ...common, border: `${anno.strokeWidth}px solid ${anno.stroke}`, background: anno.fill ?? 'transparent' }}
              onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
            />
          );
        }
        if (anno.type === 'ellipse') {
          return (
            <div
              key={anno.id}
              className={`anno-shape anno-ellipse ${selected ? 'selected' : ''}`}
              style={{ ...common, border: `${anno.strokeWidth}px solid ${anno.stroke}`, borderRadius: '50%', background: anno.fill ?? 'transparent' }}
              onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
            />
          );
        }
        if (anno.type === 'highlight') {
          return (
            <div
              key={anno.id}
              className={`anno-highlight ${selected ? 'selected' : ''}`}
              style={{ ...common, background: anno.color, opacity: anno.opacity }}
              onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
            />
          );
        }
        if (anno.type === 'image') {
          return (
            <div
              key={anno.id}
              className={`anno-image ${selected ? 'selected' : ''}`}
              style={{ ...common, backgroundImage: `url(${anno.dataUrl})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }}
              onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
            />
          );
        }
        // text/watermark/header/footer
        const t = anno as TextAnno;
        return (
          <div
            key={anno.id}
            className={`anno-text ${selected ? 'selected' : ''}`}
            style={{
              ...common,
              color: t.color,
              fontSize: t.fontSize * meta.scale,
              opacity: t.opacity ?? 1,
              transform: t.rotation ? `rotate(${-t.rotation}deg)` : undefined,
            }}
            onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
          >
            {t.text}
          </div>
        );
      })}

      {dragRect && isDragTool && (
        <div className={`anno-draft ${activeTool === 'crop' ? 'crop-draft' : ''}`} style={dragRect} />
      )}

      {cropDraft && cropDraft.pageId === page.id && (
        <CropMask cropRect={pdfRectToScreen(cropDraft.rect.x, cropDraft.rect.y, cropDraft.rect.width, cropDraft.rect.height, meta)} layerWidth={displayWidth} layerHeight={displayHeight} />
      )}

      {editingText && (
        <TextInputBox
          pos={editingText}
          meta={meta}
          pageId={page.id}
          onSubmit={(text, pdfRect) => {
            if (text) {
              const anno: TextAnno = {
                id: nextAnnoId(),
                pageId: page.id,
                type: 'text',
                x: pdfRect.x,
                y: pdfRect.y,
                width: pdfRect.width,
                height: pdfRect.height,
                text,
                color: '#000000',
                fontSize: 14,
              };
              addAnnotation(anno);
            }
            setEditingText(null);
          }}
          onCancel={() => setEditingText(null)}
        />
      )}

      {pendingImage && activeTool === 'image' && (
        <div className="anno-hint">点击页面放置图片</div>
      )}
    </div>
  );
}

interface TextInputBoxProps {
  pos: { x: number; y: number };
  meta: ReturnType<typeof makePageRenderMeta>;
  pageId: string;
  onSubmit: (text: string, pdfRect: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

function TextInputBox({ pos, meta, onSubmit, onCancel }: TextInputBoxProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦
  if (inputRef.current) inputRef.current.focus();

  const submit = () => {
    const pdfRect = screenRectToPdf(pos.x, pos.y, 100, 20, meta);
    onSubmit(text, pdfRect);
  };

  return (
    <input
      ref={inputRef}
      className="anno-text-input"
      style={{ left: pos.x, top: pos.y }}
      value={text}
      autoFocus
      placeholder="输入文本..."
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit();
        else if (e.key === 'Escape') onCancel();
      }}
      onBlur={submit}
    />
  );
}

function CropMask({ cropRect, layerWidth, layerHeight }: {
  cropRect: { left: number; top: number; width: number; height: number };
  layerWidth: number;
  layerHeight: number;
}) {
  // 四块遮罩盖住裁剪框外的区域(上/下/左/右)
  return (
    <div className="crop-mask" aria-hidden>
      <div style={{ left: 0, top: 0, width: layerWidth, height: cropRect.top }} />
      <div style={{ left: 0, top: cropRect.top + cropRect.height, width: layerWidth, height: layerHeight - cropRect.top - cropRect.height }} />
      <div style={{ left: 0, top: cropRect.top, width: cropRect.left, height: cropRect.height }} />
      <div style={{ left: cropRect.left + cropRect.width, top: cropRect.top, width: layerWidth - cropRect.left - cropRect.width, height: cropRect.height }} />
      <div className="crop-keep" style={{ left: cropRect.left, top: cropRect.top, width: cropRect.width, height: cropRect.height }} />
    </div>
  );
}

export type { ContentTool };
