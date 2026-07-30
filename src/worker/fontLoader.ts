import fontUrl from '../assets/fonts/NotoSansSC-Regular.ttf?url';

/**
 * 加载 CJK 字体字节,供 pdf-lib embedFont 使用。
 *
 * 浏览器(Worker)环境:Vite `?url` 在运行时解析为绝对 URL(http/blob/data/file),
 * 用 fetch 读取字节。
 * Node/测试环境:Vite `?url` 回退为仓库内路径字符串(如 "/src/assets/..."),
 * 用 fs 读取磁盘文件。
 * 通过 URL 形态区分两种环境,避免在浏览器中加载 Node 内建模块。
 */
let cached: ArrayBuffer | null = null;

export async function loadCjkFontBytes(): Promise<ArrayBuffer> {
  if (cached) return cached;

  // 浏览器环境:url 含协议前缀(http/blob/data/file),用 fetch
  if (/^(https?|blob|data|file):/.test(fontUrl)) {
    const res = await fetch(fontUrl);
    cached = await res.arrayBuffer();
    return cached;
  }

  // Node/测试环境:fontUrl 形如 "/src/assets/..."(无协议),用 fs 读取磁盘文件。
  // @vite-ignore 避免 Vite 把 fs/path 内建模块外部化告警(Node 分支不会在浏览器执行)。
  const fs = await import(/* @vite-ignore */ 'fs');
  const path = await import(/* @vite-ignore */ 'path');
  const abs = path.resolve(process.cwd(), fontUrl.replace(/^\/+/, ''));
  cached = fs.readFileSync(abs).buffer.slice(0) as ArrayBuffer;
  return cached;
}
