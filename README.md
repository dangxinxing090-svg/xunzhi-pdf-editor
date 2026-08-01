# Xunzhi PDF Editor

> 自学任何新领域，就上 [www.xunzhi.cloud](http://www.xunzhi.cloud)

一款跨平台桌面 PDF 编辑工具，基于 Electron + React + TypeScript 构建。支持 PDF 阅读、页面管理、内容标注与烘焙导出，开箱即用。

![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/license-Private-red)
![Release](https://img.shields.io/github/v/release/dangxinxing090-svg/xunzhi-pdf-editor?color=blue)

---

## 目录

- [功能特性](#功能特性)
- [下载安装](#下载安装)
- [截图预览](#截图预览)
- [技术栈](#技术栈)
- [项目架构](#项目架构)
- [快速开始](#快速开始)
- [打包发布](#打包发布)
- [测试](#测试)
- [版本历史](#版本历史)
- [许可](#许可)

---

## 功能特性

### 三种编辑模式

| 模式 | 说明 |
|------|------|
| **阅读模式** | 连续垂直滚动浏览，支持缩放、懒渲染、离屏内存释放 |
| **页面编辑模式** | 缩略图网格管理页面：插入、复制、删除、旋转、移动、合并、拆分、另存 |
| **内容编辑模式** | 在 PDF 页面上直接添加标注，所见即所得 |

### 标注与烘焙

- **形状标注**：矩形框、椭圆框、高亮
- **文本标注**：自由文本批注（支持中文字体嵌入）
- **图片标注**：插入 PNG/JPG 图片
- **圈取操作**：圈取范围复制为图片、圈取遮挡内容
- **批量标注**：水印（居中旋转）、页眉、页脚、页码（`{n}` / `{total}` 占位符）
- **烘焙**：一键将标注固化进 PDF 文档，导出后永久保留
- **作用范围**：可应用到全部页或当前页

### 其他功能

- **多文档管理**：侧边栏文档列表，支持重命名、合并、拆分
- **底部广告条**：状态栏右侧推广信息，可在设置中关闭显示
- **Windows 便携版 + macOS 安装包**：即下即用

---

## 下载安装

前往 [Releases 页面](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases) 下载最新版本：

**macOS（Apple 芯片）**

1. 下载 `Xunzhi PDF Editor-0.5.0-arm64.dmg`
2. 双击打开 dmg，把「Xunzhi PDF Editor」拖入「应用程序」文件夹
3. 首次打开：**右键**（或按住 Control 点击）应用图标 → **打开**（应用未签名，macOS Gatekeeper 会拦截直接双击）

**Windows**

1. 下载 `XunzhiPDFEditor-portable-win-x64.zip`
2. 解压到任意目录
3. 双击 `Xunzhi PDF Editor.exe` 运行

> **首次运行提示**：应用未签名，Windows SmartScreen 会提示"未知发布者"。点击 **"更多信息"** → **"仍要运行"** 即可。

---

## 截图预览

> TODO：添加应用截图

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 框架 | Electron 43 | 跨平台桌面应用壳 |
| 前端 | React 19 + Vite 8 | 渲染进程 UI |
| 语言 | TypeScript 7 | 全栈类型安全 |
| 状态管理 | Zustand 5 | 轻量全局状态 |
| PDF 渲染 | pdfjs-dist 6 | 页面显示（Web Worker） |
| PDF 编辑 | pdf-lib + @pdf-lib/fontkit | 烘焙/导出/合成（Web Worker） |
| 中文字体 | Noto Sans SC | CJK 字体 subset 嵌入 |
| 打包 | electron-builder | Windows 便携版 + macOS dmg（asar: false） |
| CI/CD | GitHub Actions | windows-latest / macos-latest 原生构建 |
| 测试 | Vitest | 单元测试 |

---

## 项目架构

```
electron/                        Electron 主进程
├── main.ts                      入口：创建窗口、注册 IPC
├── preload.ts                   contextBridge：暴露安全 API
└── ipc/                         IPC 处理器
    ├── dialog.ts                文件打开/保存对话框
    ├── fs.ts                    文件读写
    └── shell.ts                 打开外部链接

src/                             渲染进程
├── App.tsx                      根布局
├── components/
│   ├── Toolbar/                 顶部工具栏
│   ├── Sidebar/                 文档列表
│   ├── PageGrid/                页面缩略图网格
│   ├── ReaderView/              阅读/内容编辑滚动视图
│   ├── AnnotationLayer/         标注交互层
│   ├── InspectorPanel/          属性面板
│   ├── ContentForms/            水印/页眉/页脚表单
│   ├── SettingsPanel/           设置面板
│   └── StatusBar/               底部状态栏 + 广告条
├── store/editorStore.ts         Zustand 全局状态
├── worker/                      Web Worker（pdf-lib 操作）
│   ├── pdf.worker.ts            Worker 入口
│   ├── pdfEngine.ts             烘焙/导出/合成/裁剪
│   ├── fontLoader.ts            CJK 字体加载
│   └── workerClient.ts          Worker 通信封装
└── lib/
    ├── pdfRenderer.ts           pdf.js 渲染
    ├── coord.ts                 PDF ↔ 屏幕坐标转换
    └── pageNumber.ts            页码模板解析
```

### 数据流

```
用户操作 → React 组件 → Zustand store → workerClient
                                              ↓
                                     Web Worker (pdf-lib)
                                              ↓
                                     烘焙/导出 PDF 字节
                                              ↓
                                     pdf.js 重新加载渲染
```

---

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 20+
- npm

### 安装与开发

```bash
# 克隆仓库
git clone https://github.com/dangxinxing090-svg/xunzhi-pdf-editor.git
cd xunzhi-pdf-editor

# 安装依赖
npm install

# 开发模式运行（编译 + Vite dev server + Electron）
npm run dev:electron
```

### 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev:electron` | 开发模式（热更新 + Electron） |
| `npm run build` | 完整构建（tsc + vite + electron tsc） |
| `npm run package:win` | 打包 Windows 便携版 |
| `npm run package:mac` | 打包 macOS 安装包（dmg，需在 macOS 上执行） |
| `npm run icons` | 重新生成应用图标 |
| `npm test` | 运行单元测试 |
| `npm run test:e2e` | Playwright E2E 测试 |

---

## 打包发布

### 本地打包

```bash
npm run package:win   # 产出：release/win-unpacked/（Windows 便携版目录）
npm run package:mac   # 产出：release/*.dmg（macOS 安装包，需在 macOS 上执行）
```

### GitHub Actions CI

推送 `v*` 开头的 tag 自动触发双平台原生构建并发布 Release：

```bash
git tag v0.5.0
git push origin v0.5.0
```

- Windows job 在 `windows-latest` 上构建，产出 `XunzhiPDFEditor-portable-win-x64.zip`
- macOS job 在 `macos-latest` 上构建，产出 `Xunzhi PDF Editor-0.5.0-arm64.dmg`

两者自动附加到同一个 GitHub Release。

详见 [docs/打包说明.md](docs/打包说明.md) 和 [docs/github发布.md](docs/github发布.md)。

---

## 测试

```bash
npm test    # 106 个单元测试
```

测试覆盖：

- 页面操作（插入/删除/移动/旋转/复制/拆分/合并）
- 标注烘焙（矩形/椭圆/高亮/文本/水印/CJK 字体/页码）
- 标注拖拽历史
- 批量标注拖拽
- 圈选操作
- 页码模板解析
- 文档选择/关闭/激活

---

## 版本历史

| 版本 | 日期 | 主要内容 |
|------|------|----------|
| [v0.5.0](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.5.0) | 2026-08-01 | **新增 macOS（arm64）版**：dmg 安装包 + GitHub Actions 自动构建发布 |
| [v0.4.2](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.4.2) | 2026-08-01 | 内容编辑烘焙三大 bug 修复 + 统一导出文案为另存为 |
| [v0.3.0](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.3.0) | 2026-07-30 | 旋转渲染/内嵌旋转/中文烘焙修复/当前页定位/apply 重渲染 + README |
| [v0.2.0](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.2.0) | 2026-07-30 | 底部广告条 + 设置面板 |
| [v0.1.0](https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.1.0) | 2026-07-30 | 首个 Windows 便携版发布 |

---

## 许可

私有项目，未开源授权。
