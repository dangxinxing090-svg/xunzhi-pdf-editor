import { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
// 第三方许可声明:与随包附带的 THIRD-PARTY-NOTICES.txt 是同一份文件(Vite ?raw 原文导入)
import noticesText from '../../../THIRD-PARTY-NOTICES.txt?raw';

/**
 * 设置面板。通过自定义事件 open-settings 控制显隐。
 * 复用 ContentForms 的 overlay 弹窗模式。
 */
export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [showNotices, setShowNotices] = useState(false);
  const hideAd = useEditorStore((s) => s.hideAd);
  const setHideAd = useEditorStore((s) => s.setHideAd);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-settings', handler);
    return () => window.removeEventListener('open-settings', handler);
  }, []);

  // Esc 关闭:许可声明的正文较长,提供键盘退出
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showNotices) setShowNotices(false);
      else setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, showNotices]);

  if (!open) return null;

  if (showNotices) {
    return (
      <div className="settings-overlay" onClick={() => setShowNotices(false)}>
        <div className="license-panel" onClick={(e) => e.stopPropagation()}>
          <h3 className="license-title">第三方开源许可</h3>
          <pre className="license-text">{noticesText}</pre>
          <div className="license-actions">
            <span className="license-hint">该文件亦随安装包提供:THIRD-PARTY-NOTICES.txt</span>
            <button className="settings-close-btn" onClick={() => setShowNotices(false)}>
              返回设置
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        <button className="settings-row-btn" onClick={() => setShowNotices(true)}>
          <span>开源许可</span>
          <span className="settings-row-note">第三方组件声明</span>
        </button>

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
