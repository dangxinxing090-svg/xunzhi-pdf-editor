import { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';

/**
 * 设置面板。通过自定义事件 open-settings 控制显隐。
 * 复用 ContentForms 的 overlay 弹窗模式。
 */
export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const hideAd = useEditorStore((s) => s.hideAd);
  const setHideAd = useEditorStore((s) => s.setHideAd);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-settings', handler);
    return () => window.removeEventListener('open-settings', handler);
  }, []);

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={() => setOpen(false)}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="settings-title">设置</h3>

        <label className="settings-row">
          <span className="settings-label">隐藏底部广告条</span>
          <input
            type="checkbox"
            className="settings-checkbox"
            checked={hideAd}
            onChange={(e) => setHideAd(e.target.checked)}
          />
        </label>

        <button className="settings-close-btn" onClick={() => setOpen(false)}>
          关闭
        </button>
      </div>
    </div>
  );
}

/** 工具栏调用:打开设置面板。 */
export function openSettings() {
  window.dispatchEvent(new CustomEvent('open-settings'));
}
