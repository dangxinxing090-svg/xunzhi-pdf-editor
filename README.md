# Xunzhi PDF Editor

一款基于 Electron + Vite + React + TypeScript 的桌面 PDF 编辑工具。支持阅读、页面编辑、内容编辑（标注/水印/页眉页脚/遮挡），可导出为 PDF。

> 自学任何新领域，就上 [www.xunzhi.cloud](http://www.xunzhi.cloud)

---

## 功能特性

### 三种编辑模式

- **阅读模式**：连续垂直滚动浏览 PDF，支持缩放、懒渲染、离屏释放控内存。
- **页面编辑模式**：缩略图网格管理页面，支持插入空白页、复制、删除、旋转、移动、合并、拆分、另存。
- **内容编辑模式**：在 PDF 页面上添加标注，支持矩形、椭圆、高亮、文本批注、图片、圈取复制/遮挡；水印、页眉、页脚、页码；烘焙（应用）到 PDF。

### 标注与烘焙

- **标注类型**：矩形框、椭圆框、高亮、文本批注、图片标注、圈取框（marquee）。
- **批量标注**：水印（居中旋转）、页眉、页脚、页码（`{n}`/`{total}` 占位符），可应用到全部页或当前页。
- **烘焙**：点击"应用"将标注固化进 PDF 文档（pdf-lib 绘制），支持中文字体嵌入（CJK subset）。
- **遮挡**：圈取内容后应用，导出的 PDF 中该区域被填充遮挡。

### 其他

- **多文档管理**：侧边栏文档列表，支持重命名、合并、拆分、另存为。
- **底部广告条**：状态栏右侧显示推广信息，可在设置中关闭显示（不可删除）。
- **Windows 便携版**：解压即用，无需安装。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Electron 43 + React 19 + Vite 8 + TypeScript 7 |
| 状态管理 | Zustand 5 |
| PDF 渲染（显示） | pdfjs-dist 6（pdf.js，Web Worker） |
| PDF 编辑（烘焙/导出） | pdf-lib + @pdf-lib/fontkit（Web Worker） |
| 中文字体 | Noto Sans SC（subset 嵌入） |
| 打包 | electron-builder（Windows 便携版，asar:false） |
| CI | GitHub Actions（windows-latest 原生构建） |
| 测试 | Vitest（106 单元测试） |

### 架构

```
Electron Main (electron/)
├── main.ts          主进程入口，创建窗口、注册 IPC
├── preload.ts       contextBridge 暴露 API（文件对话框、读写、打开外部链接）
└── ipc/             IPC handlers（dialog / fs / shell）

Renderer (src/)
├── App.tsx          根布局：Toolbar + Workspace + StatusBar
├── components/
│   ├── Toolbar/      顶部工具栏（模式切换、文件操作、标注工具、设置）
│   ├── Sidebar/      左侧文档列表
│   ├── PageGrid/     页面编辑模式缩略图网格
│   ├── ReaderView/   阅读/内容编辑模式连续滚动视图
│   ├── AnnotationLayer/  标注交互层（创建/拖拽/缩放/右键）
│   ├── InspectorPanel/   页面属性面板
│   ├── ContentForms/     水印/页眉/页脚表单弹窗
│   ├── SettingsPanel/    设置面板（隐藏广告条）
│   └── StatusBar/        底部状态栏（文档信息 + 广告条）
├── store/editorStore.ts  Zustand 全局状态
├── worker/
│   ├── pdf.worker.ts     Web Worker 入口（pdf-lib 操作）
│   ├── pdfEngine.ts      烘焙/导出/合成/裁剪逻辑
│   ├── fontLoader.ts     CJK 字体加载（Worker 环境）
│   └── workerClient.ts   Worker 请求/响应封装
└── lib/
    ├── pdfRenderer.ts    pdf.js 渲染（canvas/dataURL）
    ├── coord.ts          PDF 坐标 ↔ 屏幕像素转换
    └── pageNumber.ts     页码模板解析
```

---

## 开发

### 环境要求

- Node.js 20+
- npm

### 安装与运行

```bash
npm install
npm run dev:electron    # 开发模式（编译 + Vite dev server + Electron）
```

### 构建

```bash
npm run build           # TypeScript 编译 + Vite 构建 + Electron 编译
npm run package:win     # Windows 便携版打包（产出 release/win-unpacked/）
npm run icons           # 重新生成应用图标
```

### 测试

```bash
npm test                # 运行单元测试（106 个）
npm run test:e2e        # Playwright E2E 测试
```

---

## 打包发布

### Windows 便携版

```bash
npm run package:win
# 产出：release/win-unpacked/（解压即用的目录）
```

### GitHub Actions CI

推送 `v*` 开头的 tag 自动触发 Windows 原生构建并发布 Release：

```bash
git tag v0.3.0
git push origin v0.3.0
```

产物 `XunzhiPDFEditor-portable-win-x64.zip` 自动附加到 GitHub Release。

详见 [docs/打包说明.md](docs/打包说明.md) 和 [docs/github发布.md](docs/github发布.md)。

### 首次运行说明（未签名）

应用未做代码签名，首次运行时：

- **Windows SmartScreen** 提示"未知发布者" -> 点"更多信息" -> "仍要运行"。

---

## 项目结构

```
xunzhi-pdf-editor/
├── electron/              Electron 主进程
├── src/                   渲染进程源码
├── build/                 应用图标（icon.ico / icon.png）
├── scripts/               图标生成脚本
├── docs/                  文档（打包说明、GitHub 发布）
├── tests/                 单元测试 + 测试 stubs
├── .github/workflows/     CI 工作流
└── package.json           依赖 + electron-builder 配置
```

---

## License

私有项目。
