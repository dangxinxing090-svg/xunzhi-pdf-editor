import { useEditorStore } from '../../store/editorStore';
import type { Annotation, ShapeAnno, HighlightAnno, TextAnno } from '../../types/pdf';
import './AnnotationLayer.css';

/**
 * 内容编辑模式的右侧属性面板:选中标注时显示其可编辑属性。
 */
export function ContentInspector() {
  const annotations = useEditorStore((s) => s.annotations);
  const selectedAnnoId = useEditorStore((s) => s.selectedAnnoId);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);

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
        {(a.type === 'text' || a.type === 'watermark' || a.type === 'header' || a.type === 'footer') && (
          <TextProps anno={a as TextAnno} update={updateAnnotation} />
        )}
        <button className="danger-btn" onClick={() => removeAnnotation(a.id)}>删除</button>
      </div>
    </div>
  );
}

function typeLabel(type: Annotation['type']): string {
  const map: Record<string, string> = {
    rect: '矩形框', ellipse: '圆形框', highlight: '高亮',
    text: '文本批注', image: '图片', watermark: '水印', header: '页眉', footer: '页脚',
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

function TextProps({ anno, update }: { anno: TextAnno; update: (id: string, patch: Partial<Annotation>) => void }) {
  return (
    <>
      <label>文本<input value={anno.text} onChange={(e) => update(anno.id, { text: e.target.value })} /></label>
      <label>颜色<input type="color" value={anno.color} onChange={(e) => update(anno.id, { color: e.target.value })} /></label>
      <label>字号<input type="number" value={anno.fontSize} min={6} max={144} onChange={(e) => update(anno.id, { fontSize: +e.target.value })} /></label>
      {anno.rotation !== undefined && (
        <label>角度<input type="number" value={anno.rotation} onChange={(e) => update(anno.id, { rotation: +e.target.value })} /></label>
      )}
      {anno.opacity !== undefined && (
        <label>透明度<input type="number" step="0.1" min="0.1" max="1" value={anno.opacity} onChange={(e) => update(anno.id, { opacity: +e.target.value })} /></label>
      )}
    </>
  );
}
