# Xunzhi PDF Editor / 迅智 PDF 编辑器

> 自学任何新领域，就上 [www.xunzhi.cloud](http://www.xunzhi.cloud)
> Self-learn any new field at [www.xunzhi.cloud](http://www.xunzhi.cloud)

一款跨平台桌面 PDF 编辑工具，基于 Electron + React + TypeScript 构建。支持 PDF 阅读、页面管理、内容标注与烘焙导出，开箱即用。

A cross-platform desktop PDF editor built with Electron + React + TypeScript. Supports PDF reading, page management, content annotation and bake-in export — ready to use out of the box.

![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/license-Private-red)
![Release](https://img.shields.io/github/v/release/dangxinxing090-svg/xunzhi-pdf-editor?color=blue)

---

## 目录 / Table of Contents

- [功能特性 / Features](#功能特性--features)
- [下载安装 / Download & Install](#下载安装--download--install)
- [截图预览 / Screenshots](#截图预览--screenshots)
- [技术栈 / Tech Stack](#技术栈--tech-stack)
- [项目架构 / Architecture](#项目架构--architecture)
- [快速开始 / Quick Start](#快速开始--quick-start)
- [打包发布 / Packaging & Release](#打包发布--packaging--release)
- [测试 / Testing](#测试--testing)
- [版本历史 / Version History](#版本历史--version-history)
- [许可 / License](#许可--license)

---

## 功能特性 / Features

### 三种编辑模式 / Three Editing Modes

| 模式 / Mode | 说明 / Description |
|------|------|
| **阅读模式 / Read** | 连续垂直滚动浏览，支持缩放、懒渲染、离屏内存释放。Continuous vertical scrolling, zoom, lazy rendering, off-screen memory release. |
| **页面编辑模式 / Page Edit** | 缩略图网格管理页面：插入、复制、删除、旋转、移动、合并、拆分、另存为。Thumbnail grid page management: insert, duplicate, delete, rotate, move, merge, split, save as. |
| **内容编辑模式 / Content Edit** | 在 PDF 页面上直接添加标注，所见即所得。Add annotations directly on PDF pages, WYSIWYG. |

### 标注与烘焙 / Annotations & Baking

- **形状标注 / Shape annotations**：矩形框、椭圆框、高亮。Rectangle, ellipse, highlight.
- **文本标注 / Text annotations**：自由文本批注（支持中文字体嵌入）。Free text notes (CJK font embedding supported).
- **图片标注 / Image annotations**：插入 PNG/JPG 图片。Insert PNG/JPG images.
- **圈取操作 / Marquee**：圈取范围复制为图片、圈取遮挡内容。Copy a selected region as an image, redact content.
- **批量标注 / Batch annotations**：水印（居中旋转）、页眉、页脚、页码（`{n}` / `{total}` 占位符）。Watermark (centered, rotated), header, footer, page number (`{n}` / `{total}` placeholders).
- **烘焙 / Bake-in**：一键将标注固化进 PDF 文档，另存为后永久保留。Bake annotations into the PDF with one click — persisted permanently after save-as.
- **作用范围 / Scope**：可应用到全部页或当前页。Apply to all pages or the current page.

### 其他功能 / Other Features

- **多文档管理 / Multi-document**：侧边栏文档列表，支持重命名、合并、拆分。Sidebar document list with rename, merge, split.
- **底部广告条 / Ad bar**：状态栏右侧推广信息，可在设置中关闭显示。Promotional bar in the status area, can be hidden in Settings.
- **Windows 便携版 / Windows portable**：解压即用，无需安装。Extract and run, no installation required.

---

## 下载安装 / Download & Install

前往 [Releases 页面](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases) 下载最新版本。Download the latest release from the [Releases page](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases):

1. 下载 `XunzhiPDFEditor-portable-win-x64.zip`。Download `XunzhiPDFEditor-portable-win-x64.zip`.
2. 解压到任意目录。Extract to any directory.
3. 双击 `Xunzhi PDF Editor.exe` 运行。Double-click `Xunzhi PDF Editor.exe` to run.

> **首次运行提示 / First-run note**：应用未签名，Windows SmartScreen 会提示"未知发布者"。点击 **"更多信息"** → **"仍要运行"** 即可。
> The app is unsigned; Windows SmartScreen may warn about an "unknown publisher". Click **"More info"** → **"Run anyway"**.

---

## 截图预览 / Screenshots

> TODO：添加应用截图 / Add app screenshots

---

## 技术栈 / Tech Stack

| 层 / Layer | 技术 / Tech | 说明 / Description |
|----|------|------|
| 框架 / Framework | Electron 43 | 跨平台桌面应用壳。Cross-platform desktop shell. |
| 前端 / Frontend | React 19 + Vite 8 | 渲染进程 UI。Renderer process UI. |
| 语言 / Language | TypeScript 7 | 全栈类型安全。Type safety across the stack. |
| 状态管理 / State | Zustand 5 | 轻量全局状态。Lightweight global state. |
| PDF 渲染 / Rendering | pdfjs-dist 6 | 页面显示（Web Worker）。Page display (Web Worker). |
| PDF 编辑 / Editing | pdf-lib + @pdf-lib/fontkit | 烘焙/另存为/合成（Web Worker）。Bake-in / save-as / merge (Web Worker). |
| 中文字体 / CJK Font | Noto Sans SC | CJK 字体 subset 嵌入。CJK font subset embedding. |
| 打包 / Packaging | electron-builder | Windows 便携版（asar: false）。Windows portable (asar: false). |
| CI/CD | GitHub Actions | windows-latest 原生构建。Native build on windows-latest. |
| 测试 / Testing | Vitest | 单元测试。Unit tests. |

---

## 项目架构 / Architecture

```
electron/                        Electron 主进程 / Main process
├── main.ts                      入口：创建窗口、注册 IPC / Entry: window creation, IPC registration
├── preload.ts                   contextBridge：暴露安全 API / Expose safe APIs
└── ipc/                         IPC 处理器 / IPC handlers
    ├── dialog.ts                文件打开/另存为对话框 / Open/save dialogs
    ├── fs.ts                    文件读写 / File read/write
    └── shell.ts                 打开外部链接 / Open external links

src/                             渲染进程 / Renderer process
├── App.tsx                      根布局 / Root layout
├── components/
│   ├── Toolbar/                 顶部工具栏 / Top toolbar
│   ├── Sidebar/                 文档列表 / Document list
│   ├── PageGrid/                页面缩略图网格 / Page thumbnail grid
│   ├── ReaderView/              阅读/内容编辑滚动视图 / Read & content-edit scroll view
│   ├── AnnotationLayer/         标注交互层 / Annotation interaction layer
│   ├── InspectorPanel/          属性面板 / Inspector panel
│   ├── ContentForms/            水印/页眉/页脚表单 / Watermark/header/footer forms
│   ├── SettingsPanel/           设置面板 / Settings panel
│   └── StatusBar/               底部状态栏 + 广告条 / Status bar + ad bar
├── store/editorStore.ts         Zustand 全局状态 / Zustand global state
├── worker/                      Web Worker（pdf-lib 操作 / pdf-lib operations）
│   ├── pdf.worker.ts            Worker 入口 / Worker entry
│   ├── pdfEngine.ts             烘焙/另存为/合成/裁剪 / Bake/save-as/merge/crop
│   ├── fontLoader.ts            CJK 字体加载 / CJK font loading
│   └── workerClient.ts          Worker 通信封装 / Worker communication wrapper
└── lib/
    ├── pdfRenderer.ts           pdf.js 渲染 / pdf.js rendering
    ├── coord.ts                 PDF ↔ 屏幕坐标转换 / PDF ↔ screen coordinate conversion
    └── pageNumber.ts            页码模板解析 / Page-number template parsing
```

### 数据流 / Data Flow

```
用户操作 / User action → React 组件 / Components → Zustand store → workerClient
                                              ↓
                                     Web Worker (pdf-lib)
                                              ↓
                                     烘焙/另存为 PDF 字节 / Bake/save-as PDF bytes
                                              ↓
                                     pdf.js 重新加载渲染 / pdf.js reload & render
```

---

## 快速开始 / Quick Start

### 环境要求 / Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm

### 安装与开发 / Install & Develop

```bash
# 克隆仓库 / Clone the repository
git clone https://github.com/dangxinxing090-svg/xunzhi-pdf-editor.git
cd xunzhi-pdf-editor

# 安装依赖 / Install dependencies
npm install

# 开发模式运行（编译 + Vite dev server + Electron）/ Run in dev mode
npm run dev:electron
```

### 常用脚本 / Common Scripts

| 命令 / Command | 说明 / Description |
|------|------|
| `npm run dev:electron` | 开发模式（热更新 + Electron）/ Dev mode (HMR + Electron) |
| `npm run build` | 完整构建（tsc + vite + electron tsc）/ Full build |
| `npm run package:win` | 打包 Windows 便携版 / Package Windows portable |
| `npm run icons` | 重新生成应用图标 / Regenerate app icons |
| `npm test` | 运行单元测试 / Run unit tests |
| `npm run test:e2e` | Playwright E2E 测试 / Playwright E2E tests |

---

## 打包发布 / Packaging & Release

### 本地打包 / Local Packaging

```bash
npm run package:win
# 产出 / Output: release/win-unpacked/（便携版目录 / portable directory）
```

### GitHub Actions CI

推送 `v*` 开头的 tag 自动触发 Windows 原生构建并发布 Release。Pushing a `v*` tag automatically triggers a native Windows build and publishes a Release:

```bash
git tag v0.4.2
git push origin v0.4.2
```

CI 在 `windows-latest` 上构建，产出 `XunzhiPDFEditor-portable-win-x64.zip` 自动附加到 GitHub Release。
The CI builds on `windows-latest` and attaches `XunzhiPDFEditor-portable-win-x64.zip` to the GitHub Release automatically.

详见 / See also: [docs/打包说明.md](docs/打包说明.md) 和 / and [docs/github发布.md](docs/github发布.md)。

---

## 测试 / Testing

```bash
npm test    # 109 个单元测试 / 109 unit tests
```

测试覆盖 / Test coverage:

- 页面操作（插入/删除/移动/旋转/复制/拆分/合并）/ Page operations (insert/delete/move/rotate/duplicate/split/merge)
- 标注烘焙（矩形/椭圆/高亮/文本/水印/CJK 字体/页码/二次烘焙）/ Annotation baking (rect/ellipse/highlight/text/watermark/CJK font/page number/double bake)
- 标注拖拽历史 / Annotation drag history
- 批量标注拖拽 / Batch annotation dragging
- 圈选操作 / Marquee operations
- 页码模板解析 / Page-number template parsing
- 文档选择/关闭/激活 / Document select/close/activate
- CJK 字体子集有效性 / CJK font subset validity

---

## 版本历史 / Version History

| 版本 / Version | 日期 / Date | 主要内容 / Highlights |
|------|------|----------|
| [v0.4.2](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.4.2) | 2026-08-01 | 内容编辑烘焙三大修复（CJK 字体损坏/二次烘焙失效/位置偏离）+ canvas 并发渲染修复 + 导出改名为另存为。Three bake-in fixes (CJK font corruption / double-bake loss / position drift) + canvas render race fix + "Export" renamed to "Save As". |
| [v0.4.1](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.4.1) | 2026-07-31 | 回滚体积优化，保留 HiDPI/Retina 清晰度改进。Reverted size optimization, kept HiDPI/Retina clarity improvements. |
| [v0.4.0](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.4.0) | 2026-07-31 | 分发包体积优化（排除 node_modules + 精简语言包）。Package size optimization (excluded node_modules + slimmed locale files). |
| [v0.3.0](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.3.0) | 2026-07-30 | 旋转渲染/内嵌旋转/中文烘焙修复/当前页定位/apply 重渲染 + README。Rotation rendering / embedded rotation / CJK bake fix / current-page detection / apply re-render + README. |
| [v0.2.0](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.2.0) | 2026-07-30 | 底部广告条 + 设置面板。Bottom ad bar + settings panel. |
| [v0.1.0](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.1.0) | 2026-07-30 | 首个 Windows 便携版发布。First Windows portable release. |

---

## 许可 / License

私有项目，未开源授权。Private project; no open-source license granted.
