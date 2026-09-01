import { useEditorStore } from '../../store/editorStore';
import type { EditorMode } from '../../types/pdf';

const AD_URL = 'http://www.xunzhi.cloud';

const MODE_LABEL: Record<EditorMode, string> = {
  read: '阅读',
  pages: '页面编辑',
  content: '内容编辑',
};

export function StatusBar() {
  const allPages = useEditorStore((s) => s.pages);
  const activeDocId = useEditorStore((s) => s.activeDocId);
  const selection = useEditorStore((s) => s.selection);
  const error = useEditorStore((s) => s.error);
  const isExporting = useEditorStore((s) => s.isExporting);
  const mode = useEditorStore((s) => s.mode);
  const currentPageIndex = useEditorStore((s) => s.currentPageIndex);
  const hideAd = useEditorStore((s) => s.hideAd);
  const zoom = useEditorStore((s) => s.zoom);
  const activeDocName = useEditorStore((s) =>
    s.sourceDocs.find((d) => d.id === s.activeDocId)?.fileName,
  );

  // 只统计当前活跃文档的页面(与中间网格视图一致)
  const pages = allPages.filter((p) => p.sourceDocId === activeDocId);
  const deletedCount = pages.filter((p) => p.deleted).length;

  const openInBrowser = () => {
    if (!window.electronAPI?.openExternal) {
      console.error('electronAPI.openExternal 不可用,请确认在 Electron 环境运行且 preload 已重新编译');
      return;
    }
    window.electronAPI.openExternal(AD_URL).catch((err: unknown) => {
      console.error('打开浏览器失败:', err);
    });
  };

  return (
    <div className="status-bar">
      <span className="status-cell status-doc">
        <span className="status-label">文档</span>
        <span className="status-doc-name" title={activeDocName ?? undefined}>
          {activeDocName ?? '未载入文档'}
        </span>
      </span>
      <span className="status-cell">
        <span className="status-label">模式</span>
        {MODE_LABEL[mode]}
      </span>
      <span className="status-cell">
        <span className="status-label">{mode === 'pages' ? '页面' : '页码'}</span>
        {mode === 'pages' ? (
          <>
            <span>共 {pages.length} 页</span>
            <span>· 选中 {selection.size}</span>
            <span>· 已删除 {deletedCount}</span>
          </>
        ) : (
          <span>{pages.length > 0 ? `第 ${currentPageIndex + 1} 页 / 共 ${pages.length} 页` : '无文档'}</span>
        )}
        {isExporting && <span className="status-exporting">另存为中...</span>}
        {error && <span className="status-error">错误:{error}</span>}
      </span>
      <span className="status-cell">
        <span className="status-label">缩放</span>
        {Math.round(zoom * 100)}%
      </span>
      <span className="status-cell status-grow" />
      {!hideAd && (
        <span className="status-ad">
          <span className="ad-text">系统自学任何新领域，就上</span>
          <span className="ad-url" onClick={openInBrowser}>
            {AD_URL}
          </span>
        </span>
      )}
      {hideAd && <span className="status-ad" />}
    </div>
  );
}
