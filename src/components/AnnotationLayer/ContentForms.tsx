import { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';

/**
 * 内容编辑的表单弹窗:水印、页眉、页脚。
 * 通过自定义事件 open-content-dialog 控制打开哪个表单。
 */
export function ContentForms() {
  const [dialog, setDialog] = useState<null | 'watermark' | 'header' | 'footer'>(null);

  useEffect(() => {
    const handler = (e: Event) => setDialog((e as CustomEvent).detail);
    window.addEventListener('open-content-dialog', handler as EventListener);
    return () => window.removeEventListener('open-content-dialog', handler as EventListener);
  }, []);

  const addWatermark = useEditorStore((s) => s.addWatermark);
  const addHeaderFooter = useEditorStore((s) => s.addHeaderFooter);

  if (!dialog) return null;

  return (
    <div className="content-form-overlay" onClick={() => setDialog(null)}>
      <div className="content-form" onClick={(e) => e.stopPropagation()}>
        {dialog === 'watermark' && (
          <WatermarkForm
            onSubmit={(opts) => { addWatermark(opts); setDialog(null); }}
            onCancel={() => setDialog(null)}
          />
        )}
        {(dialog === 'header' || dialog === 'footer') && (
          <HeaderFooterForm
            type={dialog}
            onSubmit={(opts) => { addHeaderFooter({ type: dialog, ...opts }); setDialog(null); }}
            onCancel={() => setDialog(null)}
          />
        )}
      </div>
    </div>
  );
}

function openDialog(name: 'watermark' | 'header' | 'footer') {
  window.dispatchEvent(new CustomEvent('open-content-dialog', { detail: name }));
}
// 导出供工具栏调用
export { openDialog };

function WatermarkForm({ onSubmit, onCancel }: {
  onSubmit: (opts: { text: string; fontSize: number; opacity: number; rotation: number; color: string; scope: 'all' | 'current' }) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.2);
  const [rotation, setRotation] = useState(45);
  const [color, setColor] = useState('#ff0000');
  const [scope, setScope] = useState<'all' | 'current'>('all');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ text, fontSize, opacity, rotation, color, scope }); }}>
      <h3>添加水印</h3>
      <label>文本<input value={text} onChange={(e) => setText(e.target.value)} /></label>
      <label>字号<input type="number" value={fontSize} onChange={(e) => setFontSize(+e.target.value)} /></label>
      <label>透明度<input type="number" step="0.1" min="0" max="1" value={opacity} onChange={(e) => setOpacity(+e.target.value)} /></label>
      <label>角度<input type="number" value={rotation} onChange={(e) => setRotation(+e.target.value)} /></label>
      <label>颜色<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
      <label>范围
        <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'current')}>
          <option value="all">全部页</option>
          <option value="current">当前页</option>
        </select>
      </label>
      <div className="form-actions">
        <button type="submit">添加</button>
        <button type="button" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}

function HeaderFooterForm({ type, onSubmit, onCancel }: {
  type: 'header' | 'footer';
  onSubmit: (opts: { text: string; fontSize: number; color: string }) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(type === 'header' ? '页眉文本' : '页脚文本');
  const [fontSize, setFontSize] = useState(12);
  const [color, setColor] = useState('#000000');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ text, fontSize, color }); }}>
      <h3>{type === 'header' ? '添加页眉' : '添加页脚'}</h3>
      <label>文本<input value={text} onChange={(e) => setText(e.target.value)} /></label>
      <label>字号<input type="number" value={fontSize} onChange={(e) => setFontSize(+e.target.value)} /></label>
      <label>颜色<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
      <div className="form-actions">
        <button type="submit">添加(全部页)</button>
        <button type="button" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}
