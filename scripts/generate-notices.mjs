/**
 * 生成 THIRD-PARTY-NOTICES.txt —— 第三方开源许可声明。
 *
 * 两条原则:
 *   1. 组件清单从 package.json 的生产依赖闭包自动推导,不手写(避免漏掉传递依赖)。
 *   2. 许可证正文全部从本地已安装的组件文件逐字提取,不手抄条款。
 *
 * 依赖变化后重新运行:npm run notices
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'THIRD-PARTY-NOTICES.txt';
const NM = 'node_modules';
const FONT = 'src/assets/fonts/NotoSansSC-Regular.ttf';

/** 直接依赖的用途说明(应用侧描述),其余归为间接依赖。 */
const ROLE = {
  'pdfjs-dist': 'PDF 页面渲染(pdf.js)',
  react: '界面框架',
  'react-dom': 'React DOM 渲染',
  'pdf-lib': 'PDF 写入/烘焙',
  '@pdf-lib/fontkit': '中文字体嵌入',
  zustand: '状态管理',
  '@dnd-kit/core': '拖拽内核',
  '@dnd-kit/sortable': '页面排序',
  'react-window': '长列表虚拟化',
};

const read = (...p) => readFileSync(join(...p), 'utf8');
const readJson = (...p) => JSON.parse(read(...p));
/** 归一化许可证标识:去掉声明里常见的包裹括号,如 pako 的 "(MIT AND Zlib)"。 */
const normalizeLicense = (l) => String(l).replace(/^\(|\)$/g, '').trim();
const findLicenseFile = (dir) => {
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'LICENCE']) {
    if (existsSync(join(dir, f))) return join(dir, f);
  }
  return null;
};

/**
 * 生产依赖闭包:从 package.json 的 dependencies 与 optionalDependencies 出发递归解析,
 * 与打包实际包含的集合一致(npm 会安装平台匹配的可选依赖,如 pdfjs-dist 的
 * @napi-rs/canvas 原生画布,该包确实随包分发)。
 *
 * 平台专属的原生二进制(形如 @napi-rs/canvas-darwin-arm64 / -win32-x64-msvc)按平台
 * 不同而不同,不单独列条目,归类到其父包名下。
 */
function dependencyClosure() {
  const seen = new Map();
  const variants = new Map(); // 父包 -> 平台变体名
  const walk = (deps) => {
    for (const name of Object.keys(deps ?? {})) {
      if (seen.has(name)) continue;
      let meta;
      try {
        meta = readJson(NM, name, 'package.json');
      } catch {
        continue; // 本机未安装(平台不匹配的可选依赖),跳过
      }
      seen.set(name, meta);
      // 平台变体:父包名 + '-' 开头,且父包在可选依赖里声明了它
      const parent = [...seen.keys()].find(
        (p) =>
          p !== name &&
          name.startsWith(`${p}-`) &&
          Object.keys(seen.get(p).optionalDependencies ?? {}).includes(name),
      );
      if (parent) {
        variants.set(parent, [...(variants.get(parent) ?? []), name]);
        seen.delete(name);
        continue;
      }
      walk(meta.dependencies);
      walk(meta.optionalDependencies);
    }
  };
  walk(readJson('package.json').dependencies);
  return { packages: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)), variants };
}

/**
 * 从 LICENSE 头部取版权行。只看开头几行,避免把条款正文里的句子
 * (如 Apache 全文里的 "Copyright notice that is included...")误当版权行。
 */
function copyrightLine(file) {
  const head = read(file)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5);
  return head.find((l) => /^copyright|^©|^\(c\)/i.test(l)) ?? null;
}

/** MIT 正文:从 "Permission is hereby granted" 起(含其后的免责声明)到文件末尾。 */
function mitBody() {
  const text = read(NM, 'react', 'LICENSE');
  const i = text.indexOf('Permission is hereby granted');
  if (i === -1) throw new Error('MIT 正文未找到');
  return text.slice(i).trimEnd();
}

/** 从 Electron 附带的 Chromium 许可清单里提取某段正文(按起始/结束标记)。 */
function fromChromium(startMark) {
  const html = read(NM, 'electron', 'dist', 'LICENSES.chromium.html');
  const start = html.indexOf(startMark);
  if (start === -1) throw new Error(`Chromium 许可清单未找到: ${startMark}`);
  // OFL 段之后紧接 "3. Unicode, Inc. License"
  const end = html.indexOf('3. Unicode, Inc. License', start);
  return html
    .slice(start, end === -1 ? undefined : end)
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** pako 源码头部的 Zlib 正文(该包为 MIT AND Zlib 双许可,LICENSE 文件只含 MIT)。 */
function zlibBody() {
  const src = read(NM, 'pako', 'dist', 'pako.js');
  const start = src.indexOf('(C) 1995-2013 Jean-loup Gailly and Mark Adler');
  if (start === -1) throw new Error('pako 源码中未找到 Zlib 声明');
  return src
    .slice(start, src.indexOf('*/', start))
    .split('\n')
    .map((l) => l.replace(/^\/\/ ?/, '').trimEnd())
    .join('\n')
    .trimEnd();
}

/**
 * pdfjs-dist 随包带出的内嵌资源(cmap/ICC 配置文件、标准字体、WASM 编解码器),
 * 各有独立授权,许可文件随资源一同分发。扫描其目录得到清单。
 */
function pdfjsBundledAssets() {
  const root = join(NM, 'pdfjs-dist');
  const found = [];
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(p, relPath);
      } else if (/^LICEN[CS]E/i.test(e.name)) {
        // 根 LICENSE 已作为 pdfjs-dist 组件本身列在清单中,此处只收内嵌资源的
        if (!rel) continue;
        const text = read(p);
        found.push({ rel: relPath, label: detectLicenseLabel(text) });
      }
    }
  };
  walk(root, '');
  return found.sort((a, b) => a.rel.localeCompare(b.rel));
}

function detectLicenseLabel(text) {
  if (/CC0 1\.0/.test(text)) return 'CC0 1.0 Universal';
  if (/SIL Open Font|Reserved Font/.test(text)) return 'SIL Open Font License';
  if (/Adobe Systems Incorporated/.test(text)) return 'Adobe cmap 授权条款';
  if (/Mozilla Foundation|Mozilla Corporation/.test(text)) return 'BSD(Mozilla)';
  if (/Redistribution and use in source and binary forms/.test(text)) return 'BSD(3-clause/2-clause)';
  return '见该文件正文';
}

/**
 * Electron 自带的许可文件:打包时随包分发。
 *
 * 这些文件在仓库里保留一份副本(third-party/electron/),而不是直接引用
 * node_modules/electron/dist/ —— CI runner 上该目录不存在(electron-builder 打包时
 * 自行下载 Electron),直接引用会导致打包时静默跳过这两个文件。
 * 本机有安装时顺带校验/刷新副本,避免 Electron 升级后副本过期。
 */
const ELECTRON_LICENSE_FILES = [
  { from: 'node_modules/electron/dist/LICENSE', to: 'third-party/electron/LICENSE.electron.txt' },
  { from: 'node_modules/electron/dist/LICENSES.chromium.html', to: 'third-party/electron/LICENSES.chromium.html' },
];

function syncElectronLicenses() {
  let electronVersion = '';
  try {
    electronVersion = readJson(NM, 'electron', 'package.json').version;
  } catch {
    /* 未安装 electron,保留既有副本 */
  }

  for (const { from, to } of ELECTRON_LICENSE_FILES) {
    if (!existsSync(from)) {
      console.log(`  · ${to} —— 本机无 ${from},保留仓库既有副本`);
      continue;
    }
    const src = readFileSync(from);
    const same = existsSync(to) && readFileSync(to).equals(src);
    if (!same) {
      writeFileSync(to, src);
      console.log(`  · ${to} —— 已同步更新`);
    }
  }

  // 记录副本对应的 Electron 版本,便于升级时核对
  writeFileSync(
    'third-party/electron/VERSION.txt',
    `本目录的许可文件取自 Electron ${electronVersion || '(未知版本)'} 的发布包。\n` +
      `Electron 升级后请重新运行 npm run notices 同步。\n` +
      `LICENSE.electron.txt     <- node_modules/electron/dist/LICENSE\n` +
      `LICENSES.chromium.html   <- node_modules/electron/dist/LICENSES.chromium.html\n`,
    'utf8',
  );
}

/** 从字体 name 表读取版权行与授权声明(nameID 0/13)。 */
function fontInfo() {
  const buf = readFileSync(FONT);
  const numTables = buf.readUInt16BE(4);
  let nameOff = 0;
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    if (buf.toString('ascii', o, o + 4) === 'name') nameOff = buf.readUInt32BE(o + 8);
  }
  const count = buf.readUInt16BE(nameOff + 2);
  const strOff = nameOff + buf.readUInt16BE(nameOff + 4);
  const out = {};
  for (let i = 0; i < count; i++) {
    const r = nameOff + 6 + i * 12;
    const pid = buf.readUInt16BE(r);
    const nid = buf.readUInt16BE(r + 6);
    const len = buf.readUInt16BE(r + 8);
    const off = buf.readUInt16BE(r + 10);
    if (nid !== 0 && nid !== 13) continue;
    const s = buf.subarray(strOff + off, strOff + off + len);
    out[nid] = pid === 3 || pid === 0
      ? Buffer.from(s).swap16().toString('utf16le')
      : s.toString('latin1');
  }
  return { copyright: out[0], statement: out[13] };
}

// —— 收集组件 ——
const { packages: rawPackages, variants } = dependencyClosure();
const packages = rawPackages.map((meta) => {
  const dir = join(NM, meta.name);
  const licenseFile = findLicenseFile(dir);
  return {
    name: meta.name,
    version: meta.version,
    license: normalizeLicense(meta.license || '(未声明)'),
    role: ROLE[meta.name] ?? '间接依赖',
    licenseFile,
    copyright: licenseFile ? copyrightLine(licenseFile) : null,
    variantNote: variants.has(meta.name)
      ? `该包运行时按平台附带一个原生二进制(如 ${variants.get(meta.name).join(' / ')}),许可证与版权同上`
      : null,
  };
});

const font = fontInfo();

// —— 许可证分组(按闭包中实际出现的类型) ——
const groups = new Map();
for (const p of packages) {
  if (!groups.has(p.license)) groups.set(p.license, []);
  groups.get(p.license).push(p);
}

/** 每种许可证取一段逐字正文:优先用该组内自带 LICENSE 的包,并校验特征语句。 */
function bodyFor(license) {
  const MARKER = {
    MIT: 'Permission is hereby granted, free of charge',
    'Apache-2.0': 'TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION',
    '0BSD': 'Permission to use, copy, modify, and/or distribute this software',
  };
  const marker = MARKER[license];
  if (marker) {
    const hit = (groups.get(license) ?? []).find(
      (p) => p.licenseFile && read(p.licenseFile).includes(marker),
    );
    if (!hit) throw new Error(`未找到 ${license} 的正文来源`);
    const text = read(hit.licenseFile);
    if (license === 'MIT') {
      return text.slice(text.indexOf('Permission is hereby granted')).trimEnd();
    }
    return text.trim();
  }
  if (license === 'MIT AND Zlib') return `${mitBody()}\n\n----- Zlib -----\n\n${zlibBody()}`;
  throw new Error(`未知许可证类型,请为其指定正文来源: ${license}`);
}

const componentList = packages
  .map((p, i) => {
    const holder = p.copyright ? p.copyright.replace(/^copyright/i, 'Copyright') : '';
    let note;
    if (holder) note = holder;
    else if (p.licenseFile) note = `(其 LICENSE 为 ${p.license} 标准全文,未另附版权行)`;
    else note = `(未附 LICENSE 文件;许可证以该组件 package.json 声明为准:${p.license})`;
    return [
      `${String(i + 1).padStart(2, ' ')}. ${p.name} ${p.version} — ${p.license}`,
      `    用途:${p.role}`,
      `    ${note}`,
      p.variantNote ? `    ${p.variantNote}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  })
  .join('\n');

const licenseSections = [...groups.keys()]
  .map((license) => {
    const members = groups.get(license);
    const lines = members
      .map((p) => `  · ${p.name} ${p.version}`)
      .join('\n');
    return [
      '',
      `${'='.repeat(24)} ${license} ${'='.repeat(24)}`,
      '',
      '下列组件以此许可证授权:',
      lines,
      '',
      bodyFor(license),
    ].join('\n');
  })
  .join('\n');

// 字体不属于 npm 依赖闭包,单独成段(正文取自 Electron 附带的 Chromium 许可清单,逐字)
const fontSection = [
  '',
  `${'='.repeat(24)} SIL Open Font License 1.1 ${'='.repeat(24)}`,
  '',
  '下列字体以此许可证授权:',
  '  · Noto Sans SC Regular',
  '',
  font.copyright,
  '',
  fromChromium('SIL OPEN FONT LICENSE Version 1.1'),
].join('\n');

const notices = `Xunzhi PDF Editor — 第三方软件许可声明
Third-Party Software Notices
================================================================

本软件包含下列第三方开源组件。各组件版权归其各自权利人所有,并按各自许可证
条款授权使用。本声明随软件一并分发,亦可在应用内「设置 → 开源许可」中查看。

----------------------------------------------------------------
一、组件清单(共 ${packages.length + 1} 项)
----------------------------------------------------------------

${componentList}

${String(packages.length + 1).padStart(2, ' ')}. Noto Sans SC Regular — SIL Open Font License 1.1
    用途:中文字体(在导出的 PDF 中嵌入中文时使用)
    ${font.copyright}
    ${font.statement}

----------------------------------------------------------------
二、pdfjs-dist 随包分发的内嵌资源
----------------------------------------------------------------

pdfjs-dist 目录中还随包分发以下资源(渲染用的字符映射表、ICC 色彩配置、标准
字体与 WASM 编解码器)。它们各有独立授权,完整条款随文件一同分发,见安装目录
node_modules/pdfjs-dist/ 下对应路径。

${pdfjsBundledAssets().map((a) => `  · ${a.rel}  —  ${a.label}`).join('\n')}

----------------------------------------------------------------
三、本软件基于 Electron 构建
----------------------------------------------------------------

本软件运行时一并分发 Electron、Chromium 与 Node.js,其版权声明与许可证文本
随安装包提供。安装目录下的文件:

  LICENSE.electron.txt
  LICENSES.chromium.html

----------------------------------------------------------------
四、许可证全文
----------------------------------------------------------------
${licenseSections}
${fontSection}

${'='.repeat(64)}
本文件由 scripts/generate-notices.mjs 自动生成,请勿手工修改。
${'='.repeat(64)}
`;

writeFileSync(OUT, notices, 'utf8');
console.log(`已生成 ${OUT}:${packages.length} 个依赖 + 1 个字体,` +
  `许可证类型 ${[...groups.keys()].join(' / ')},${(notices.length / 1024).toFixed(1)} KB`);
console.log('Electron 许可文件:');
syncElectronLicenses();
