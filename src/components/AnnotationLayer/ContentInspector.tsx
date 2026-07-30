import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { Annotation, ShapeAnno, HighlightAnno, TextAnno, ImageAnno, MarqueeAnno } from '../../types/pdf';
import './AnnotationLayer.css';

/**
 * 内容编辑模式的右侧属性面板:选中标注时显示其可编辑属性。
 */
export function ContentInspector() {
  const annotations = useEditorStore((s) => s.annotations);
  const selectedAnnoId = useEditorStore((s) => s.selectedAnnoId);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const updateAnnotationsByType = useEditorStore((s) => s.updateAnnotationsByType);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const removeAnnotationsByType = useEditorStore((s) => s.removeAnnotationsByType);
  const copyAnnoAsImage = useEditorStore((s) => s.copyAnnoAsImage);

  // 找到选中的标注
  let selected: Annotation | null = null;
  for (const list of Object.values(annotations)) {
    const found = list.find((a) => a.id === selectedAnnoId);
    if (found) { selected = found; break; }
  }

  if (!selected) {
    return (
      <div className="inspector-panel content-inspector">
        <h3>属性</h3>
        <p className="empty">选中一个标注对象查看属性</p>
      </div>
    );
  }

  const a = selected;
  const isTextType = a.type === 'text' || a.type === 'watermark' || a.type === 'header' || a.type === 'footer' || a.type === 'pageNumber';
  // 水印/页眉/页脚/页码支持按类型批量删除(当前页/全部页)
  const isBatchDeletable = a.type === 'watermark' || a.type === 'header' || a.type === 'footer' || a.type === 'pageNumber';

  return (
    <div className="inspector-panel content-inspector">
      <h3>{typeLabel(a.type)} 属性</h3>
      <div className="props-section">
        {(a.type === 'rect' || a.type === 'ellipse') && (
          <ShapeProps anno={a as ShapeAnno} update={updateAnnotation} />
        )}
        {a.type === 'highlight' && (
          <HighlightProps anno={a as HighlightAnno} update={updateAnnotation} />
        )}
        {a.type === 'image' && (
          <ImageProps anno={a as ImageAnno} update={updateAnnotation} />
        )}
        {a.type === 'marquee' && (
          <>
            <ShapeProps anno={a as MarqueeAnno as unknown as ShapeAnno} update={updateAnnotation} />
            <button onClick={() => void copyAnnoAsImage(a.id)}>复制为图片</button>
            <button onClick={() => updateAnnotation(a.id, { fill: (a as MarqueeAnno).fill ? undefined : '#ffffff' })}>
              {(a as MarqueeAnno).fill ? '取消遮挡' : '删除内容(遮挡)'}
            </button>
          </>
        )}
        {isTextType && (
          <TextProps
            anno={a as TextAnno}
            update={updateAnnotation}
            // 水印/页眉/页脚/页码:属性修改默认应用到全部页,可切换为仅当前页
            batchUpdate={isBatchDeletable
              ? (patch, scope) => updateAnnotationsByType(a.type as 'watermark' | 'header' | 'footer' | 'pageNumber', patch, scope, a.pageId)
              : undefined}
          />
        )}
        {!isBatchDeletable && (
          <button className="danger-btn" onClick={() => removeAnnotation(a.id)}>删除</button>
        )}
        {isBatchDeletable && (
          <>
            <button className="danger-btn" onClick={() => removeAnnotationsByType(a.type as 'watermark' | 'header' | 'footer' | 'pageNumber', 'current', a.pageId)}>
              删除该{typeLabel(a.type)}(当前页)
            </button>
            <button className="danger-btn" onClick={() => removeAnnotationsByType(a.type as 'watermark' | 'header' | 'footer' | 'pageNumber', 'all')}>
              删除该{typeLabel(a.type)}(全部页)
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function typeLabel(type: Annotation['type']): string {
  const map: Record<string, string> = {
    rect: '矩形框', ellipse: '圆形框', highlight: '高亮',
    text: '文本批注', image: '图片', watermark: '水印', header: '页眉', footer: '页脚', pageNumber: '页码', marquee: '圈取',
  };
  return map[type] ?? type;
}

function ShapeProps({ anno, update }: { anno: ShapeAnno; update: (id: string, patch: Partial<Annotation>) => void }) {
  return (
    <>
      <label>边框颜色<input type="color" value={anno.stroke} onChange={(e) => update(anno.id, { stroke: e.target.value })} /></label>
      <label>线宽<input type="number" value={anno.strokeWidth} min={1} max={20} onChange={(e) => update(anno.id, { strokeWidth: +e.target.value })} /></label>
      <label>填充色<input type="color" value={anno.fill ?? '#ffffff'} onChange={(e) => update(anno.id, { fill: e.target.value })} /></label>
    </>
  );
}

function HighlightProps({ anno, update }: { anno: HighlightAnno; update: (id: string, patch: Partial<Annotation>) => void }) {
  return (
    <>
      <label>颜色<input type="color" value={anno.color} onChange={(e) => update(anno.id, { color: e.target.value })} /></label>
      <label>透明度<input type="number" step="0.1" min="0.1" max="1" value={anno.opacity} onChange={(e) => update(anno.id, { opacity: +e.target.value })} /></label>
    </>
  );
}

function ImageProps({ anno, update }: { anno: ImageAnno; update: (id: string, patch: Partial<Annotation>) => void }) {
  // 重新选择图片:读取文件为 dataUrl,更新标注
  const pickImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => update(anno.id, { dataUrl: reader.result as string });
      reader.readAsDataURL(file);
    };
    input.click();
  };
  return (
    <>
      <label>图片
        <button type="button" onClick={pickImage}>重新选择…</button>
      </label>
      <label>宽度<input type="number" value={Math.round(anno.width)} min={1} onChange={(e) => update(anno.id, { width: +e.target.value })} /></label>
      <label>高度<input type="number" value={Math.round(anno.height)} min={1} onChange={(e) => update(anno.id, { height: +e.target.value })} /></label>
    </>
  );
}

function TextProps({
  anno, update, batchUpdate,
}: {
  anno: TextAnno;
  update: (id: string, patch: Partial<Annotation>) => void;
  /** 水印/页眉/页脚的批量更新:scope='all' 全部页,'current' 仅当前页。缺省时用单条 update。 */
  batchUpdate?: (patch: Partial<Annotation>, scope: 'all' | 'current') => void;
}) {
  const hasBorder = !!anno.stroke;
  // 水印/页眉/页脚:默认应用到全部页,可切换为仅当前页
  const [applyAll, setApplyAll] = useState(true);
  // 应用属性修改:有 batchUpdate 时按 scope 批量,否则单条
  const apply = (patch: Partial<Annotation>) => {
    if (batchUpdate) batchUpdate(patch, applyAll ? 'all' : 'current');
    else update(anno.id, patch);
  };
  return (
    <>
      <label>文本<input value={anno.text} onChange={(e) => apply({ text: e.target.value })} /></label>
      <label>颜色<input type="color" value={anno.color} onChange={(e) => apply({ color: e.target.value })} /></label>
      <label>字号<input type="number" value={anno.fontSize} min={6} max={144} onChange={(e) => apply({ fontSize: +e.target.value })} /></label>
      {anno.rotation !== undefined && (
        <label>角度<input type="number" value={anno.rotation} onChange={(e) => apply({ rotation: +e.target.value })} /></label>
      )}
      {anno.opacity !== undefined && (
        <label>透明度<input type="number" step="0.1" min="0.1" max="1" value={anno.opacity} onChange={(e) => apply({ opacity: +e.target.value })} /></label>
      )}
      <label>边框
        <input
          type="checkbox"
          checked={hasBorder}
          onChange={(e) => apply(e.target.checked
            ? { stroke: '#000000', strokeWidth: anno.strokeWidth ?? 1 }
            : { stroke: undefined })}
        />
      </label>
      {hasBorder && (
        <>
          <label>边框色<input type="color" value={anno.stroke} onChange={(e) => apply({ stroke: e.target.value })} /></label>
          <label>边框宽<input type="number" value={anno.strokeWidth ?? 1} min={0.5} max={20} step="0.5" onChange={(e) => apply({ strokeWidth: +e.target.value })} /></label>
        </>
      )}
      {batchUpdate && (
        <label>应用到全部页
          <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
        </label>
      )}
    </>
  );
}
