import { useEffect, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { renderPageToCanvas } from '../../lib/pdfRenderer';

export function InspectorPanel() {
  const pages = useEditorStore((s) => s.pages);
  const selection = useEditorStore((s) => s.selection);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedPages = pages.filter((p) => selection.has(p.id) && !p.deleted);
  const first = selectedPages[0];

  // 选中单页时,高分辨率渲染真实页面到 canvas
  useEffect(() => {
    if (!first || !canvasRef.current) return;
    // 面板宽度约 480px,用 800px 渲染提高清晰度;旋转在渲染层处理,避免 CSS transform 留空白
    renderPageToCanvas(canvasRef.current, first.sourceDocId, first.sourcePageIndex, 800, first.rotation)
      .catch((err) => console.error('[InspectorPanel] render failed:', err));
  }, [first?.id, first?.sourceDocId, first?.sourcePageIndex, first?.rotation]);

  if (selectedPages.length === 0) {
    return (
      <div className="inspector-panel">
        <h3>页面预览</h3>
        <p className="empty">未选中页面</p>
      </div>
    );
  }

  return (
    <div className="inspector-panel">
      <h3>页面预览</h3>
      {selectedPages.length === 1 && first ? (
        <div className="page-preview-scroll">
          <canvas ref={canvasRef} />
        </div>
      ) : (
        <p className="empty">选中 {selectedPages.length} 页(单选可预览)</p>
      )}

      <div className="props-section">
        <h4>属性</h4>
        <p>选中 {selectedPages.length} 页</p>
        {selectedPages.length === 1 && first && (
          <>
            <p>第 {pages.indexOf(first) + 1} 页</p>
            <p>{Math.round(first.width)} × {Math.round(first.height)}</p>
            <p>旋转:{first.rotation}°</p>
          </>
        )}
      </div>
    </div>
  );
}
