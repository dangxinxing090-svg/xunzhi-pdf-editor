// 输出每张审查截图的统计:尺寸、唯一色数、调色板命中(无需视觉)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';

const DIR = '.impeccable/review';

function decodePng(buf) {
  // PNG: 签名8 + IHDR + IDAT... 解析宽高与像素
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  // 只处理 8bit RGBA/RGB
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (channels === 0) return { width, height, pixels: null };
  const stride = width * channels;
  // 还原 filter
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    const cur = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= channels && prev ? prev[x - channels] : 0;
      let val = row[x];
      switch (filter) {
        case 1: val = (val + a) & 0xff; break;
        case 2: val = (val + b) & 0xff; break;
        case 3: val = (val + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
      }
      cur[x] = val;
    }
  }
  return { width, height, pixels, channels, stride };
}

function stats(file) {
  const buf = readFileSync(file);
  const { width, height, pixels, channels, stride } = decodePng(buf);
  if (!pixels) return { file: file.split('/').pop(), width, height, note: 'non-RGB, skipped pixel stats' };
  const colors = new Set();
  // 采样(步进 3 像素)
  let blueish = 0, total = 0;
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const o = y * stride + x * channels;
      const r = pixels[o], g = pixels[o + 1], b = pixels[o + 2];
      colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
      total++;
      if (b > r + 24 && b > 90 && g < b) blueish++;
    }
  }
  return {
    file: file.split('/').pop(),
    width, height,
    uniqueColors: colors.size,
    blueAccentShare: (blueish / total * 100).toFixed(2) + '%',
  };
}

for (const f of readdirSync(DIR).filter((n) => n.endsWith('.png'))) {
  console.log(JSON.stringify(stats(join(DIR, f))));
}
