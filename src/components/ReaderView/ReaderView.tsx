import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { renderPageToCanvas, cancelCanvasRender } from '../../lib/pdfRenderer';
import { AnnotationLayer } from '../AnnotationLayer/AnnotationLayer';
import type { Page } from '../../types/pdf';
import './ReaderView.css';

const BASE_WIDTH = 800; // 基准渲染宽度(px),缩放以此为基准

/**
 * 阅读视图:连续垂直滚动显示当前文档所有页,IntersectionObserver 懒渲染,
 * 离屏页释放 canvas 内容以控制内存。支持缩放与页码跳转。
 *
 * 当前页判定:由 ReaderView 层级的共享 observer 监听所有页面 wrapper,
 * 取可见面积最大的页面作为当前页(而非旧的中线规则)。
 */
export function ReaderView() {
  const activeDocId = useEditorStore((s) => s.activeDocId);
  const pages = useEditorStore((s) => s.pages).filter(
    (p) => p.sourceDocId === activeDocId,
  );
  const zoom = useEditorStore((s) => s.zoom);
  const mode = useEditorStore((s) => s.mode);
  const setCurrentPageIndex = useEditorStore((s) => s.setCurrentPageIndex);
  const renderVersion = useEditorStore((s) => s.renderVersion);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 共享 observer:监听所有页面 wrapper,取可见面积最大者为当前页。
  // 旧方案每个 ReaderPage 各自判定(中线规则),页面较短时顶部以下页面永远无法成为当前页,
  // 导致 currentPageIndex 卡在第 1/2 页,水印/页眉/页脚"添加到当前页"落到错误页。
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || pages.length === 0) return;
    // idx->wrapper 映射,供回调查阅
    const wraps = Array.from(root.querySelectorAll<HTMLElement>('[data-page-idx]'));
    const idxByEl = new Map<Element, number>();
    wraps.forEach((el) => {
      const idx = Number(el.dataset.pageIdx);
      if (!Number.isNaN(idx)) idxByEl.set(el, idx);
    });

    let raf = 0;
    const pickCurrent = () => {
      raf = 0;
      let bestIdx = -1;
      let bestArea = 0;
      idxByEl.forEach((idx, el) => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const visibleH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        const area = visibleH * r.width;
        if (area > bestArea) {
          bestArea = area;
          bestIdx = idx;
        }
      });
      if (bestIdx >= 0) setCurrentPageIndex(bestIdx);
    };

    const observer = new IntersectionObserver(
      () => {
        if (raf) return;
        raf = requestAnimationFrame(pickCurrent);
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    idxByEl.forEach((_, el) => observer.observe(el));
    // 初始判定一次(刚加载时 observer 不一定立即触发)
    pickCurrent();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [pages, setCurrentPageIndex]);

  return (
    <div className="reader-view">
      {activeDocId ? (
        <div className="reader-scroll" ref={scrollRef}>
          {pages.map((page, idx) => (
            <ReaderPage
              key={page.id}
              page={page}
              index={idx}
              docId={activeDocId}
              zoom={zoom}
              mode={mode}
              renderVersion={renderVersion}
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
  renderVersion: number;
}

function ReaderPage({ page, index, docId, zoom, mode, renderVersion }: ReaderPageProps) {
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
      // 传未旋转方向宽度(BASE_WIDTH*zoom),renderPageToCanvas 内部用 rotation 参数渲染旋转后尺寸
      // (renderPageToCanvas 内部会自动取消该 canvas 上仍在进行的旧渲染,避免并发 render 报错)
      await renderPageToCanvas(canvas, docId, page.sourcePageIndex, targetWidth, page.rotation);
      setRendered(true);
    } catch (err) {
      // 被更新的渲染取消的旧任务会抛 RenderingCancelledException,忽略
      if ((err as { name?: string }).name !== 'RenderingCancelledException') {
        console.error('ReaderPage render failed:', err);
      }
    }
  }, [docId, page.sourcePageIndex, page.rotation, targetWidth, renderVersion]);

  // 仅负责懒渲染与离屏释放,不再负责当前页判定(已提升到 ReaderView 共享 observer)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void render();
          } else if (rendered) {
            // 离屏释放:取消进行中的渲染并清空 canvas 内容以控内存
            const canvas = canvasRef.current;
            if (canvas) {
              cancelCanvasRender(canvas);
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
  }, [render, rendered]);

  // 缩放变化或 applyAnnotations 后(renderVersion 变化)重新渲染可见页
  useEffect(() => {
    if (rendered) void render();
  }, [zoom, render, rendered, renderVersion]);

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
