import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { renderPageToCanvas } from '../../lib/pdfRenderer';
import { AnnotationLayer } from '../AnnotationLayer/AnnotationLayer';
import type { Page } from '../../types/pdf';
import './ReaderView.css';

const BASE_WIDTH = 800; // 基准渲染宽度(px),缩放以此为基准

/**
 * 阅读视图:连续垂直滚动显示当前文档所有页,IntersectionObserver 懒渲染,
 * 离屏页释放 canvas 内容以控制内存。支持缩放与页码跳转。
 */
export function ReaderView() {
  const activeDocId = useEditorStore((s) => s.activeDocId);
  const pages = useEditorStore((s) => s.pages).filter(
    (p) => p.sourceDocId === activeDocId,
  );
  const zoom = useEditorStore((s) => s.zoom);
  const mode = useEditorStore((s) => s.mode);
  const setCurrentPageIndex = useEditorStore((s) => s.setCurrentPageIndex);

  return (
    <div className="reader-view">
      {activeDocId ? (
        <div className="reader-scroll">
          {pages.map((page, idx) => (
            <ReaderPage
              key={page.id}
              page={page}
              index={idx}
              docId={activeDocId}
              zoom={zoom}
              mode={mode}
              onVisible={setCurrentPageIndex}
            />
          ))}
        </div>
      ) : (
        <div className="reader-empty">打开 PDF 文档开始阅读</div>
      )}
    </div>
  );
}

interface ReaderPageProps {
  page: Page;
  index: number;
  docId: string;
  zoom: number;
  mode: string;
  onVisible: (index: number) => void;
}

function ReaderPage({ page, index, docId, zoom, mode, onVisible }: ReaderPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  const targetWidth = BASE_WIDTH * zoom;

  // 页面 CSS 显示宽度:按宽高比缩放,旋转 90/270 时交换宽高
  const isLandscape = page.rotation === 90 || page.rotation === 270;
  const aspect = isLandscape ? page.width / page.height : page.height / page.width;
  const displayWidth = isLandscape ? targetWidth * (page.height / page.width) : targetWidth;
  const displayHeight = displayWidth * aspect;

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await renderPageToCanvas(canvas, docId, page.sourcePageIndex, targetWidth, page.rotation);
      setRendered(true);
    } catch (err) {
      console.error('ReaderPage render failed:', err);
    }
  }, [docId, page.sourcePageIndex, page.rotation, targetWidth]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void render();
            onVisible(index);
          } else if (rendered) {
            // 离屏释放:清空 canvas 内容以控内存
            const canvas = canvasRef.current;
            if (canvas) {
              canvas.width = 0;
              canvas.height = 0;
            }
            setRendered(false);
          }
        }
      },
      { rootMargin: '200px 0px' }, // 提前 200px 预渲染
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [render, rendered, index, onVisible]);

  // 缩放变化时重新渲染可见页
  useEffect(() => {
    if (rendered) void render();
  }, [zoom, render, rendered]);

  return (
    <div
      className="reader-page-wrap"
      ref={wrapRef}
      data-page-idx={index}
      style={{ width: displayWidth, height: displayHeight }}
    >
      <canvas ref={canvasRef} style={{ width: displayWidth, height: displayHeight }} />
      {!rendered && <div className="reader-page-placeholder">第 {index + 1} 页</div>}
      <div className="reader-page-label">{index + 1}</div>
      {mode === 'content' && (
        <AnnotationLayer
          page={page}
          index={index}
          docId={docId}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
        />
      )}
    </div>
  );
}
