import fontUrl from '../assets/fonts/NotoSansSC-Regular.ttf?url';

/**
 * 加载 CJK 字体字节,供 pdf-lib embedFont 使用。
 *
 * Worker/浏览器环境:Vite `?url` 可能解析为绝对 URL(http://...)或无协议相对路径(/src/assets/...)。
 * 无协议路径在 Worker 中需补全 origin 后用 fetch 读取。
 * Node/测试环境:Vite `?url` 回退为仓库内路径字符串,用 fs 读取磁盘文件。
 * 通过 typeof window/self 检测区分浏览器与 Node 环境。
 */
let cached: ArrayBuffer | null = null;

export async function loadCjkFontBytes(): Promise<ArrayBuffer> {
  if (cached) return cached;

  // 浏览器/Worker 环境:有 self.location,用 fetch
  if (typeof self !== 'undefined' && self.location) {
    // 无协议路径(/src/...)补全为绝对 URL;已有协议的(http/blob/data/file)直接用
    const url = /^(https?|blob|data|file):/.test(fontUrl)
      ? fontUrl
      : new URL(fontUrl, self.location.origin).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`加载字体失败: HTTP ${res.status}`);
    cached = await res.arrayBuffer();
    return cached;
  }

  // Node/测试环境:fontUrl 形如 "/src/assets/...",用 fs 读取磁盘文件。
  // @vite-ignore 避免 Vite 把 fs/path 内建模块外部化告警(Node 分支不会在浏览器执行)。
  const fs = await import(/* @vite-ignore */ 'fs');
  const path = await import(/* @vite-ignore */ 'path');
  const abs = path.resolve(process.cwd(), fontUrl.replace(/^\/+/, ''));
  cached = fs.readFileSync(abs).buffer.slice(0) as ArrayBuffer;
  return cached;
}
