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
  const addPageNumber = useEditorStore((s) => s.addPageNumber);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  if (!dialog) return null;

  return (
    <div className="content-form-overlay" onClick={() => setDialog(null)}>
      <div className="content-form" onClick={(e) => e.stopPropagation()}>
        {dialog === 'watermark' && (
          <WatermarkForm
            onSubmit={(opts) => { addWatermark(opts); setActiveTool('select'); setDialog(null); }}
            onCancel={() => setDialog(null)}
          />
        )}
        {(dialog === 'header' || dialog === 'footer') && (
          <HeaderFooterForm
            type={dialog}
            onSubmit={(opts) => {
              if ('pageNumber' in opts && opts.pageNumber) {
                addPageNumber({ template: opts.template, fontSize: opts.fontSize, color: opts.color, align: opts.align, scope: opts.scope });
              } else {
                addHeaderFooter({ type: dialog, text: opts.text, fontSize: opts.fontSize, color: opts.color, scope: opts.scope });
              }
              setActiveTool('select');
              setDialog(null);
            }}
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

/** 页脚提交参数:普通文字 或 页码(模板+对齐)。页眉仅普通文字。 */
type HeaderFooterSubmit =
  | { pageNumber: false; text: string; fontSize: number; color: string; scope: 'all' | 'current' }
  | { pageNumber: true; template: string; fontSize: number; color: string; align: 'left' | 'center' | 'right'; scope: 'all' | 'current' };

function HeaderFooterForm({ type, onSubmit, onCancel }: {
  type: 'header' | 'footer';
  onSubmit: (opts: HeaderFooterSubmit) => void;
  onCancel: () => void;
}) {
  // 页码模式仅页脚支持;页眉强制普通文字。
  const [pageNumber, setPageNumber] = useState(false);
  const [text, setText] = useState(type === 'header' ? '页眉文本' : '页脚文本');
  const [template, setTemplate] = useState('第 {n} 页');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  const [fontSize, setFontSize] = useState(12);
  const [color, setColor] = useState('#000000');
  const [scope, setScope] = useState<'all' | 'current'>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pageNumber) {
      onSubmit({ pageNumber: true, template, fontSize, color, align, scope });
    } else {
      onSubmit({ pageNumber: false, text, fontSize, color, scope });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>{type === 'header' ? '添加页眉' : '添加页脚'}</h3>
      {type === 'footer' && (
        <label>内容类型
          <select value={pageNumber ? 'pageNumber' : 'text'} onChange={(e) => setPageNumber(e.target.value === 'pageNumber')}>
            <option value="text">普通文字</option>
            <option value="pageNumber">页码</option>
          </select>
        </label>
      )}
      {pageNumber ? (
        <>
          <label>页码格式<input value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="第 {n} 页" /></label>
          <small className="form-hint">{'{n}'} = 当前页码,{'{total}'} = 总页数</small>
          <label>对齐
            <select value={align} onChange={(e) => setAlign(e.target.value as 'left' | 'center' | 'right')}>
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </label>
        </>
      ) : (
        <label>文本<input value={text} onChange={(e) => setText(e.target.value)} /></label>
      )}
      <label>字号<input type="number" value={fontSize} onChange={(e) => setFontSize(+e.target.value)} /></label>
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
