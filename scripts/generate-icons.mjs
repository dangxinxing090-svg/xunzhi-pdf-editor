// 生成 Windows 应用图标 build/icon.ico
// 从内嵌 SVG 渲染 1024 源图,再生成多尺寸 PNG,最后打包为 .ico
// 运行: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(__dirname, '../build');

// 简洁 PDF 主题图标:深色圆角矩形背景 + 白色"PDF"字样 + 红色折角
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b3b4f"/>
      <stop offset="1" stop-color="#1e1e2a"/>
    </linearGradient>
  </defs>
  <rect x="96" y="96" width="832" height="832" rx="170" fill="url(#bg)"/>
  <!-- 折角 -->
  <path d="M620 96 L848 324 L620 324 Z" fill="#e05555"/>
  <!-- PDF 字样 -->
  <text x="512" y="640" font-family="Arial, sans-serif" font-size="320" font-weight="bold"
        fill="#ffffff" text-anchor="middle" dominant-baseline="middle">PDF</text>
</svg>`;

const sizes = [256, 128, 64, 48, 32, 16];

// .ico 格式:ICONDIR(6 字节) + ICONDIRENTRY(16 字节/个) + 各 PNG 数据
// 现代多尺寸 .ico 使用 PNG 编码(ICO 中 PNG 是标准支持)
async function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  // 6 字节头:reserved(2)=0, type(2)=1, count(2)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  const images = [];
  let offset = 6 + count * 16;
  for (let i = 0; i < count; i++) {
    const buf = pngBuffers[i];
    const size = sizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width, 0 = 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height, 0 = 256
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buf.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    images.push(buf);
    offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...images]);
}

await mkdir(buildDir, { recursive: true });

const pngBuffers = [];
for (const size of sizes) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  pngBuffers.push(png);
}

const ico = await buildIco(pngBuffers);
await writeFile(resolve(buildDir, 'icon.ico'), ico);

// 同时保存一张 1024 PNG 作为源图(将来做 mac 版可用)
await sharp(Buffer.from(svg)).resize(1024, 1024).png().toFile(resolve(buildDir, 'icon.png'));

console.log('图标已生成: build/icon.ico, build/icon.png');
