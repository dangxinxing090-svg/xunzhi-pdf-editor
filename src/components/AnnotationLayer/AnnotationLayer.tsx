import { useRef, useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { makePageRenderMeta, pdfRectToScreen, screenRectToPdf, screenToPdf } from '../../lib/coord';
import { resolvePageNumberText } from '../../lib/pageNumber';
import type { Page, Annotation, ContentTool, ShapeAnno, HighlightAnno, TextAnno, ImageAnno, MarqueeAnno } from '../../types/pdf';
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
const EMPTY_ANNOS: Annotation[] = [];

/**
 * 用 canvas measureText 估算文本在屏幕上的尺寸(像素),返回宽高。
 * fontSize 为 PDF pt,需乘 scale 转屏幕像素。多行按 \n 计行数。
 */
function measureTextSize(text: string, fontSizePt: number, scale: number): { width: number; height: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const px = fontSizePt * scale;
  ctx.font = `${px}px sans-serif`;
  const lines = text.split('\n');
  let maxW = 0;
  for (const line of lines) {
    const m = ctx.measureText(line || ' ');
    if (m.width > maxW) maxW = m.width;
  }
  const lineH = px * 1.2;
  return { width: Math.max(maxW + 4, 20), height: lineH * lines.length + 4 };
}

/** 八方位缩放手柄:nw/n/ne/e/se/s/sw/w(顺时针,从左上角起)。 */
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * 按手柄方位与当前鼠标位置,计算缩放后的屏幕矩形 {left,top,width,height}。
 * 拖动某边/角时,对边/对角固定,被拖边/角跟随鼠标。
 */
function resizeRect(
  handle: ResizeHandle,
  start: { left: number; top: number; width: number; height: number },
  mx: number,
  my: number,
): { left: number; top: number; width: number; height: number } {
  let { left, top, width, height } = start;
  const right = left + width;
  const bottom = top + height;
  if (handle.includes('w')) { left = mx; width = right - mx; }
  if (handle.includes('e')) { width = mx - left; }
  if (handle.includes('n')) { top = my; height = bottom - my; }
  if (handle.includes('s')) { height = my - top; }
  // 防止负宽高(拖过头时,固定对边)
  if (width < 4) width = 4;
  if (height < 4) height = 4;
  return { left, top, width, height };
}

export function AnnotationLayer({ page, index, docId, displayWidth, displayHeight }: AnnotationLayerProps) {
  const activeTool = useEditorStore((s) => s.activeTool);
  // 用稳定空数组引用,避免选择器每次返回新 [] 触发无限重渲染
  const annotations = useEditorStore((s) => s.annotations[page.id] ?? EMPTY_ANNOS);
  // 文档总页数:页码标注 {total} 占位符用。按 sourceDocId 过滤 = 当前文档显示页数。
  const docPageCount = useEditorStore((s) => s.pages.filter((p) => p.sourceDocId === docId).length);
  const selectedAnnoId = useEditorStore((s) => s.selectedAnnoId);
  const addAnnotation = useEditorStore((s) => s.addAnnotation);
  const copyAnnoAsImage = useEditorStore((s) => s.copyAnnoAsImage);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const updateAnnotationsByType = useEditorStore((s) => s.updateAnnotationsByType);
  const commitAnnotationDrag = useEditorStore((s) => s.commitAnnotationDrag);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const removeAnnotationsByType = useEditorStore((s) => s.removeAnnotationsByType);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  const layerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCur, setDragCur] = useState<{ x: number; y: number } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveOffset, setMoveOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  // 缩放:选中后拖拽边角调整大小。handle 为八方位(n/s/e/w + 四角)。
  const [resizing, setResizing] = useState<{ id: string; handle: ResizeHandle } | null>(null);
  // 拖拽(移动/缩放)开始前的标注快照,用于结束时合并提交一条历史(而非逐像素)。
  const dragPrevRef = useRef<{ annotations: Record<string, Annotation[]>; selectedAnnoId: string | null } | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  // 文本创建:点击或拖拽结束后,在该位置打开输入框。size 为拖拽画框尺寸(可选)。
  const [editingText, setEditingText] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null);
  // 双击已有文本批注进入就地编辑:存 anno id + 初始文本 + 屏幕位置
  const [editingExisting, setEditingExisting] = useState<{ anno: TextAnno; left: number; top: number } | null>(null);
  // 右键菜单:在标注上右键弹出删除选项。坐标相对图层左上角。
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; anno: Annotation } | null>(null);

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

    if (activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'highlight' || activeTool === 'text' || activeTool === 'marquee') {
      setDragStart(pos);
      setDragCur(pos);
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
        // 放置后切回选择工具,便于立即拖动/缩放/右键删除
        setActiveTool('select');
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart) {
      setDragCur(getLayerPos(e));
    } else if (resizing) {
      // 缩放:按手柄方位重算屏幕矩形 -> PDF 坐标,更新 x/y/width/height
      const pos = getLayerPos(e);
      const anno = annotations.find((a) => a.id === resizing.id);
      if (!anno) return;
      const startScreen = pdfRectToScreen(anno.x, anno.y, anno.width, anno.height, meta);
      const next = resizeRect(resizing.handle, startScreen, pos.x, pos.y);
      const pdfRect = screenRectToPdf(next.left, next.top, next.width, next.height, meta);
      updateAnnotation(resizing.id, {
        x: pdfRect.x, y: pdfRect.y, width: pdfRect.width, height: pdfRect.height,
      }, { transient: true });
    } else if (movingId) {
      const pos = getLayerPos(e);
      const anno = annotations.find((a) => a.id === movingId);
      if (!anno) return;
      // 计算新位置:屏幕坐标移动量 -> PDF 坐标
      const oldScreen = pdfRectToScreen(anno.x, anno.y, anno.width, anno.height, meta);
      const newLeft = pos.x - moveOffset.dx;
      const newTop = pos.y - moveOffset.dy;
      const pdfRect = screenRectToPdf(newLeft, newTop, oldScreen.width, oldScreen.height, meta);
      // 批量类型(水印/页眉/页脚/页码):拖动一页时同步移动所有页的同类型实例。
      // 各页 PDF 坐标系相同,设置相同 x/y 即同步移动。transient 不入历史,由 mouseUp 合并提交。
      const isBatchType = anno.type === 'watermark' || anno.type === 'header' || anno.type === 'footer' || anno.type === 'pageNumber';
      if (isBatchType) {
        updateAnnotationsByType(anno.type as 'watermark' | 'header' | 'footer' | 'pageNumber', { x: pdfRect.x, y: pdfRect.y }, 'all', undefined, { transient: true });
      } else {
        updateAnnotation(movingId, { x: pdfRect.x, y: pdfRect.y }, { transient: true });
      }
    }
  };

  const handleMouseUp = () => {
    if (dragStart && dragCur) {
      const left = Math.min(dragStart.x, dragCur.x);
      const top = Math.min(dragStart.y, dragCur.y);
      const w = Math.abs(dragCur.x - dragStart.x);
      const h = Math.abs(dragCur.y - dragStart.y);
      const isClick = w <= 4 && h <= 4; // 小位移视为点击
      if (activeTool === 'text') {
        // 文本批注:点击用默认尺寸,拖拽用画框尺寸,均在该位置打开输入框
        setEditingText({ x: left, y: top, width: isClick ? 120 : w, height: isClick ? 24 : h });
      } else if (!isClick) {
        const pdfRect = screenRectToPdf(left, top, w, h, meta);
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
        } else if (activeTool === 'marquee') {
          // 圈取框:白色边框矩形(无填充,仅圈选可见)。复制/删除由右键/属性面板操作。
          anno = { ...base, type: 'marquee', stroke: '#ffffff', strokeWidth: 2 } as MarqueeAnno;
        } else {
          anno = { ...base, type: 'highlight', color: '#ffff00', opacity: 0.4 } as HighlightAnno;
        }
        if (anno) {
          addAnnotation(anno);
          // 创建成功后切回选择工具,便于立即选中/拖动/缩放
          setActiveTool('select');
        }
      }
    }
    setDragStart(null);
    setDragCur(null);
    // 拖拽移动/缩放结束:合并本次鼠标动作为一条历史(逐像素 transient 更新不入栈)。
    // 仅在确实发生了移动/缩放时提交;commitAnnotationDrag 内部会跳过无变化的提交。
    if ((movingId || resizing) && dragPrevRef.current) {
      commitAnnotationDrag(dragPrevRef.current);
    }
    dragPrevRef.current = null;
    setMovingId(null);
    setResizing(null);
  };

  // ---- 缩放手柄:开始拖拽某边角 ----
  const startResize = (handle: ResizeHandle) => {
    // 记录缩放前快照,供 mouseUp 合并提交历史
    dragPrevRef.current = {
      annotations: useEditorStore.getState().annotations,
      selectedAnnoId: selectedAnnoId,
    };
    setResizing({ id: selectedAnnoId!, handle });
    setMovingId(null);
  };

  // ---- 选中/拖动已有对象 ----
  const handleAnnoMouseDown = (e: React.MouseEvent, anno: Annotation) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    selectAnnotation(anno.id);
    // 记录拖拽前快照,供 mouseUp 合并提交历史
    dragPrevRef.current = {
      annotations: useEditorStore.getState().annotations,
      selectedAnnoId: anno.id,
    };
    setMovingId(anno.id);
    const pos = getLayerPos(e);
    const screen = pdfRectToScreen(anno.x, anno.y, anno.width, anno.height, meta);
    setMoveOffset({ dx: pos.x - screen.left, dy: pos.y - screen.top });
  };

  // ---- 右键菜单:在标注上右键弹出删除选项 ----
  const handleAnnoContextMenu = (e: React.MouseEvent, anno: Annotation) => {
    if (activeTool !== 'select') return;
    e.preventDefault();
    e.stopPropagation();
    selectAnnotation(anno.id);
    setContextMenu({ x: getLayerPos(e).x, y: getLayerPos(e).y, anno });
  };

  const handleDelete = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnoId) {
      e.preventDefault();
      removeAnnotation(selectedAnnoId);
    }
  };

  const isDragTool = activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'highlight' || activeTool === 'text' || activeTool === 'marquee';
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
      onMouseDown={(e) => { setContextMenu(null); handleMouseDown(e); }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
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
              onContextMenu={(e) => handleAnnoContextMenu(e, anno)}
            >
              {selected && <ResizeHandles width={screen.width} height={screen.height} onStart={startResize} />}
            </div>
          );
        }
        if (anno.type === 'marquee') {
          const m = anno as MarqueeAnno;
          // 未遮挡:虚线边框(圈选可见);遮挡后(fill 白):实线白块盖住内容。
          return (
            <div
              key={anno.id}
              className={`anno-shape anno-marquee ${selected ? 'selected' : ''}`}
              style={{ ...common, border: `${m.strokeWidth}px ${m.fill ? 'solid' : 'dashed'} ${m.stroke}`, background: m.fill ?? 'transparent' }}
              onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
              onContextMenu={(e) => handleAnnoContextMenu(e, anno)}
            >
              {selected && <ResizeHandles width={screen.width} height={screen.height} onStart={startResize} />}
            </div>
          );
        }
        if (anno.type === 'ellipse') {
          return (
            <div
              key={anno.id}
              className={`anno-shape anno-ellipse ${selected ? 'selected' : ''}`}
              style={{ ...common, border: `${anno.strokeWidth}px solid ${anno.stroke}`, borderRadius: '50%', background: anno.fill ?? 'transparent' }}
              onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
              onContextMenu={(e) => handleAnnoContextMenu(e, anno)}
            >
              {selected && <ResizeHandles width={screen.width} height={screen.height} onStart={startResize} />}
            </div>
          );
        }
        if (anno.type === 'highlight') {
          return (
            <div
              key={anno.id}
              className={`anno-highlight ${selected ? 'selected' : ''}`}
              style={{ ...common, background: anno.color, opacity: anno.opacity }}
              onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
              onContextMenu={(e) => handleAnnoContextMenu(e, anno)}
            >
              {selected && <ResizeHandles width={screen.width} height={screen.height} onStart={startResize} />}
            </div>
          );
        }
        if (anno.type === 'image') {
          return (
            <div
              key={anno.id}
              className={`anno-image ${selected ? 'selected' : ''}`}
              style={{ ...common, backgroundImage: `url(${anno.dataUrl})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }}
              onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
              onContextMenu={(e) => handleAnnoContextMenu(e, anno)}
            >
              {selected && <ResizeHandles width={screen.width} height={screen.height} onStart={startResize} />}
            </div>
          );
        }
        // text/watermark/header/footer/pageNumber
        const t = anno as TextAnno;
        // 页码标注:按当前页显示顺序解析 {n}/{total} 占位符(每页不同,同一格式)。
        const displayText = t.type === 'pageNumber'
          ? resolvePageNumberText(t.text, index + 1, docPageCount)
          : t.text;
        return (
          <div
            key={anno.id}
            className={`anno-text ${selected ? 'selected' : ''}`}
            style={{
              left: screen.left,
              top: screen.top,
              width: 'max-content',
              height: 'auto',
              color: t.color,
              fontSize: t.fontSize * meta.scale,
              opacity: t.opacity ?? 1,
              transform: t.rotation ? `rotate(${-t.rotation}deg)` : undefined,
              border: t.stroke ? `${(t.strokeWidth ?? 1) * meta.scale}px solid ${t.stroke}` : undefined,
              padding: t.stroke ? '2px 4px' : undefined,
            }}
            onMouseDown={(e) => handleAnnoMouseDown(e, anno)}
            onContextMenu={(e) => handleAnnoContextMenu(e, anno)}
            onDoubleClick={(e) => {
              // 双击进入就地编辑(仅自由文本批注;水印/页眉页脚用属性面板改)
              if (activeTool === 'select' && t.type === 'text') {
                e.stopPropagation();
                setEditingExisting({ anno: t, left: screen.left, top: screen.top });
              }
            }}
          >
            {displayText}
          </div>
        );
      })}

      {dragRect && isDragTool && (
        <div className="anno-draft" style={dragRect} />
      )}

      {editingText && (
        <TextInputBox
          pos={editingText}
          meta={meta}
          fontSizePt={14}
          size={editingText.width != null && editingText.height != null
            ? { width: editingText.width, height: editingText.height }
            : undefined}
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
              // 创建成功后切回选择工具
              setActiveTool('select');
            }
            setEditingText(null);
          }}
          onCancel={() => setEditingText(null)}
        />
      )}

      {editingExisting && (
        <TextInputBox
          pos={{ x: editingExisting.left, y: editingExisting.top }}
          meta={meta}
          fontSizePt={editingExisting.anno.fontSize}
          initialText={editingExisting.anno.text}
          onSubmit={(text, pdfRect) => {
            if (text) {
              // 就地编辑:更新文本与尺寸,保持原 x/y(左下锚点)不变
              updateAnnotation(editingExisting.anno.id, {
                text,
                width: pdfRect.width,
                height: pdfRect.height,
              } as Partial<TextAnno>);
            }
            setEditingExisting(null);
          }}
          onCancel={() => setEditingExisting(null)}
        />
      )}

      {pendingImage && activeTool === 'image' && (
        <div className="anno-hint">点击页面放置图片</div>
      )}

      {contextMenu && (
        <AnnoContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          anno={contextMenu.anno}
          onClose={() => setContextMenu(null)}
          onDelete={() => { removeAnnotation(contextMenu.anno.id); setContextMenu(null); }}
          onDeleteByType={(scope) => {
            // 右键删除"当前页":按标注所在页删除,而非滚动位置页
            removeAnnotationsByType(contextMenu.anno.type as 'watermark' | 'header' | 'footer' | 'pageNumber', scope, contextMenu.anno.pageId);
            setContextMenu(null);
          }}
          onCopy={() => { void copyAnnoAsImage(contextMenu.anno.id); setContextMenu(null); }}
          onRedact={() => {
            const a = contextMenu.anno as MarqueeAnno;
            // 切换遮挡:已遮挡则取消(清 fill),否则填白遮挡内容。
            updateAnnotation(a.id, { fill: a.fill ? undefined : '#ffffff' });
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
}

interface TextInputBoxProps {
  pos: { x: number; y: number };
  meta: ReturnType<typeof makePageRenderMeta>;
  fontSizePt: number;
  initialText?: string;
  /** 显式屏幕尺寸(拖拽画框创建时使用);缺省时按 measureText 估算。 */
  size?: { width: number; height: number };
  onSubmit: (text: string, pdfRect: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

function TextInputBox({ pos, meta, fontSizePt, initialText, size, onSubmit, onCancel }: TextInputBoxProps) {
  const [text, setText] = useState(initialText ?? '');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 挂载后聚焦并将光标置于末尾
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const submit = () => {
    const trimmed = text;
    if (!trimmed) {
      onCancel();
      return;
    }
    // 有显式尺寸(画框创建)用它;否则按 measureText 估算
    const px = size ?? measureTextSize(trimmed, fontSizePt, meta.scale);
    const pdfRect = screenRectToPdf(pos.x, pos.y, px.width, px.height, meta);
    onSubmit(trimmed, pdfRect);
  };

  return (
    <textarea
      ref={inputRef}
      className="anno-text-input"
      style={{
        left: pos.x, top: pos.y,
        fontSize: fontSizePt * meta.scale,
        width: size?.width,
        height: size?.height,
      }}
      value={text}
      placeholder="输入文本…(Enter 提交,Shift+Enter 换行)"
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => {
        // 失焦时若有内容则提交,无内容则取消(避免误提交空文本)
        if (text.trim()) submit();
        else onCancel();
      }}
    />
  );
}

/** 选中标注时显示的八方位缩放手柄,absolute 定位于标注边框。 */
const RESIZE_HANDLES: Array<{ handle: ResizeHandle; cursor: string; pos: (w: number, h: number) => React.CSSProperties }> = [
  { handle: 'nw', cursor: 'nwse-resize', pos: () => ({ left: -5, top: -5 }) },
  { handle: 'n', cursor: 'ns-resize', pos: (w) => ({ left: w / 2 - 4, top: -5 }) },
  { handle: 'ne', cursor: 'nesw-resize', pos: (w) => ({ left: w - 4, top: -5 }) },
  { handle: 'e', cursor: 'ew-resize', pos: (w, h) => ({ left: w - 4, top: h / 2 - 4 }) },
  { handle: 'se', cursor: 'nwse-resize', pos: (w, h) => ({ left: w - 4, top: h - 4 }) },
  { handle: 's', cursor: 'ns-resize', pos: (w, h) => ({ left: w / 2 - 4, top: h - 4 }) },
  { handle: 'sw', cursor: 'nesw-resize', pos: (_w, h) => ({ left: -5, top: h - 4 }) },
  { handle: 'w', cursor: 'ew-resize', pos: (_w, h) => ({ left: -5, top: h / 2 - 4 }) },
];

function ResizeHandles({
  width, height, onStart,
}: {
  width: number;
  height: number;
  onStart: (handle: ResizeHandle) => void;
}) {
  return (
    <>
      {RESIZE_HANDLES.map(({ handle, cursor, pos }) => (
        <div
          key={handle}
          className="anno-resize-handle"
          style={{ ...pos(width, height), cursor }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onStart(handle);
          }}
        />
      ))}
    </>
  );
}

/** 标注右键菜单:删除单个;水印/页眉/页脚额外提供按类型删除(当前页/全部页);圈取提供复制/遮挡。 */
function AnnoContextMenu({
  x, y, anno, onClose, onDelete, onDeleteByType, onCopy, onRedact,
}: {
  x: number;
  y: number;
  anno: Annotation;
  onClose: () => void;
  onDelete: () => void;
  onDeleteByType: (scope: 'current' | 'all') => void;
  onCopy?: () => void;
  onRedact?: () => void;
}) {
  const isBatch = anno.type === 'watermark' || anno.type === 'header' || anno.type === 'footer' || anno.type === 'pageNumber';
  const isMarquee = anno.type === 'marquee';
  const isRedacted = isMarquee && !!(anno as MarqueeAnno).fill;
  return (
    <>
      {/* 透明遮罩:点击/右键外部关闭菜单。stopPropagation 防止冒泡到图层 mousedown 提前关闭。 */}
      <div
        className="anno-menu-overlay"
        onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      />
      {/* 菜单本体:stopPropagation 防止图层 mousedown 在按钮 click 前卸载菜单 */}
      <div className="anno-context-menu" style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
        {isBatch ? (
          <>
            <button onClick={onDeleteByType.bind(null, 'current')}>删除该{typeLabel(anno.type)}(当前页)</button>
            <button onClick={onDeleteByType.bind(null, 'all')}>删除该{typeLabel(anno.type)}(全部页)</button>
          </>
        ) : isMarquee ? (
          <>
            {onCopy && <button onClick={onCopy}>复制</button>}
            {onRedact && <button onClick={onRedact}>{isRedacted ? '取消遮挡' : '删除内容'}</button>}
            <button onClick={onDelete}>删除</button>
          </>
        ) : (
          <button onClick={onDelete}>删除</button>
        )}
      </div>
    </>
  );
}

function typeLabel(type: Annotation['type']): string {
  const map: Record<string, string> = {
    rect: '矩形框', ellipse: '圆形框', highlight: '高亮',
    text: '文本批注', image: '图片', watermark: '水印', header: '页眉', footer: '页脚', pageNumber: '页码', marquee: '圈取',
  };
  return map[type] ?? type;
}

export type { ContentTool };
