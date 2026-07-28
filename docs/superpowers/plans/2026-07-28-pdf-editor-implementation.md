# PDF 编辑工具 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Electron 桌面 PDF 编辑工具,支持页面拆分/合并/提取/重排、旋转、批量操作、撤销/重做。

**Architecture:** 方案 B -- 主进程仅做文件 I/O,Web Worker 用 pdf-lib + pdf.js 处理 PDF,React 渲染进程用 Zustand 管理元数据状态。缩略图经 OffscreenCanvas → ImageBitmap 零拷贝转移。

**Tech Stack:** Electron + Vite + React + TypeScript + Zustand + @dnd-kit + pdf-lib + pdf.js + react-window + Vitest + Playwright

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `package.json` | 依赖与脚本 |
| `electron/main.ts` | 主进程入口:窗口创建、IPC 注册 |
| `electron/preload.ts` | preload 桥接:暴露安全 IPC API |
| `electron/ipc/dialog.ts` | 文件对话框处理 |
| `electron/ipc/fs.ts` | PDF 文件读写 |
| `src/main.tsx` | 渲染进程入口 |
| `src/App.tsx` | 根组件 + 三栏布局 |
| `src/types/pdf.ts` | Page、SourceDoc、Command 类型 |
| `src/worker/protocol.ts` | Worker 请求/响应类型 |
| `src/worker/pdfEngine.ts` | pdf-lib 操作(加载、导出) |
| `src/worker/thumbRenderer.ts` | pdf.js 缩略图渲染 |
| `src/worker/pdf.worker.ts` | Worker 入口:消息分发 |
| `src/worker/workerClient.ts` | 渲染进程侧 Worker 封装 |
| `src/store/editorStore.ts` | Zustand 主状态 |
| `src/store/history.ts` | 撤销/重做命令栈 |
| `src/hooks/useThumbnail.ts` | 缩略图懒加载 hook |
| `src/hooks/useSelection.ts` | 选择集逻辑 hook |
| `src/components/Toolbar/*` | 顶部工具栏 |
| `src/components/Sidebar/*` | 左侧文档列表 |
| `src/components/PageGrid/*` | 中间页面网格 + 拖拽 |
| `src/components/InspectorPanel/*` | 右侧属性面板 |
| `src/components/StatusBar/*` | 底部状态栏 |
| `tests/unit/*.test.ts` | Vitest 单元测试 |
| `tests/e2e/*.test.ts` | Playwright E2E |

**关键边界:** `src/worker/` 自包含,只依赖 pdf-lib + pdf.js,不导入 React/Electron,可独立测试。

---

## 阶段 1:项目骨架 + 单文档显示

### Task 1.1: 初始化项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`

- [ ] **Step 1: 初始化 npm 项目并安装依赖**

```bash
cd "/Users/gaozhenzhen/Desktop/pdf编辑工具"
npm init -y
npm install --save react react-dom zustand @dnd-kit/core @dnd-kit/sortable pdf-lib pdfjs-dist react-window
npm install --save-dev electron vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node vitest @playwright/test
```

- [ ] **Step 2: 配置 package.json scripts 与 main 入口**

修改 `package.json`,确保包含:
```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "dev:electron": "vite build && electron .",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 3: 配置 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "electron"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: 配置 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: 配置 vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  worker: {
    format: 'es',
  },
});
```

- [ ] **Step 6: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PDF 编辑工具</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: 创建 .gitignore**

```
node_modules
dist
dist-electron
*.log
.DS_Store
playwright-report
test-results
```

- [ ] **Step 8: 验证脚手架可运行**

```bash
npm run dev
```
Expected: Vite 启动,浏览器打开显示空白页面(此时还没有 main.tsx 内容,先验证服务能跑)。Ctrl+C 停止。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "chore: scaffold electron + vite + react + ts project"
```

---

### Task 1.2: 定义核心类型

**Files:**
- Create: `src/types/pdf.ts`
- Create: `src/worker/protocol.ts`

- [ ] **Step 1: 编写类型定义测试(类型检查即测试)**

创建 `src/types/pdf.ts`:
```typescript
export interface Page {
  id: string;
  sourceDocId: string;
  sourcePageIndex: number;
  rotation: 0 | 90 | 180 | 270;
  width: number;
  height: number;
  thumbnail: ImageBitmap | null;
  deleted: boolean;
}

export interface SourceDoc {
  id: string;
  fileName: string;
  pageCount: number;
}

export type CommandType = 'move' | 'delete' | 'rotate' | 'merge';

export interface Command {
  type: CommandType;
  payload: any;
  undo(): void;
}

export interface PageMeta {
  width: number;
  height: number;
}
```

- [ ] **Step 2: 编写 Worker 协议类型**

创建 `src/worker/protocol.ts`:
```typescript
export type WorkerRequestType = 'loadDoc' | 'renderThumb' | 'exportPdf';

export interface WorkerRequest {
  id: string;
  type: WorkerRequestType;
  payload: LoadDocPayload | RenderThumbPayload | ExportPdfPayload;
}

export interface LoadDocPayload {
  docId: string;
  buffer: ArrayBuffer;
}

export interface RenderThumbPayload {
  docId: string;
  pageIndex: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface ExportPdfPayload {
  pages: Array<{
    sourceDocId: string;
    sourcePageIndex: number;
    rotation: 0 | 90 | 180 | 270;
  }>;
}

export interface WorkerResponse {
  id: string;
  ok: boolean;
  data?: any;
  error?: string;
  transfer?: Transferable[];
}

export interface LoadDocResult {
  pageCount: number;
  pages: Array<{ width: number; height: number }>;
}
```

- [ ] **Step 3: 验证类型编译通过**

```bash
npx tsc --noEmit
```
Expected: 无错误输出。

- [ ] **Step 4: 提交**

```bash
git add src/types/pdf.ts src/worker/protocol.ts
git commit -m "feat: define core types (Page, SourceDoc, Command, Worker protocol)"
```

---

### Task 1.3: 实现主进程与 IPC

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `electron/ipc/dialog.ts`
- Create: `electron/ipc/fs.ts`

- [ ] **Step 1: 实现文件对话框 IPC**

创建 `electron/ipc/dialog.ts`:
```typescript
import { ipcMain, dialog } from 'electron';

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:openPdf', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths.map((path) => ({
      path,
      name: path.split('/').pop() || path,
    }));
  });

  ipcMain.handle('dialog:savePdf', async () => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled) {
      return null;
    }
    return result.filePath;
  });
}
```

- [ ] **Step 2: 实现文件读写 IPC**

创建 `electron/ipc/fs.ts`:
```typescript
import { ipcMain } from 'electron';
import { readFile, writeFile } from 'fs/promises';

export function registerFsHandlers(): void {
  ipcMain.handle('fs:readPdf', async (_event, path: string) => {
    const buffer = await readFile(path);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  });

  ipcMain.handle('fs:writePdf', async (_event, path: string, buffer: ArrayBuffer) => {
    await writeFile(path, Buffer.from(buffer));
    return true;
  });
}
```

- [ ] **Step 3: 实现 preload 桥接**

创建 `electron/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openPdfDialog: () => ipcRenderer.invoke('dialog:openPdf'),
  savePdfDialog: () => ipcRenderer.invoke('dialog:savePdf'),
  readPdf: (path: string) => ipcRenderer.invoke('fs:readPdf', path),
  writePdf: (path: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('fs:writePdf', path, buffer),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
```

- [ ] **Step 4: 实现主进程入口**

创建 `electron/main.ts`:
```typescript
import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerDialogHandlers } from './ipc/dialog.js';
import { registerFsHandlers } from './ipc/fs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  registerDialogHandlers();
  registerFsHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 5: 提交**

```bash
git add electron/
git commit -m "feat: electron main process with IPC for file dialog and fs"
```

---

### Task 1.4: 实现 PDF 引擎(pdf-lib)

**Files:**
- Create: `src/worker/pdfEngine.ts`
- Test: `tests/unit/pdfEngine.test.ts`

- [ ] **Step 1: 编写加载与元数据提取的失败测试**

创建 `tests/unit/pdfEngine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { loadPdfFromBuffer, extractPageMeta } from '../../src/worker/pdfEngine';

async function makeTestPdf(pageCount: number): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([595, 842]); // A4
    page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 24 });
  }
  const bytes = await pdf.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('pdfEngine', () => {
  it('loads PDF from ArrayBuffer and returns PDFDocument', async () => {
    const buffer = await makeTestPdf(3);
    const pdf = await loadPdfFromBuffer(buffer);
    expect(pdf.getPageCount()).toBe(3);
  });

  it('extracts page metadata (width, height, count)', async () => {
    const buffer = await makeTestPdf(2);
    const pdf = await loadPdfFromBuffer(buffer);
    const meta = extractPageMeta(pdf);
    expect(meta.pageCount).toBe(2);
    expect(meta.pages).toHaveLength(2);
    expect(meta.pages[0].width).toBe(595);
    expect(meta.pages[0].height).toBe(842);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/pdfEngine.test.ts
```
Expected: FAIL with "Cannot find module '../../src/worker/pdfEngine'"

- [ ] **Step 3: 实现 pdfEngine 加载与元数据提取**

创建 `src/worker/pdfEngine.ts`:
```typescript
import { PDFDocument } from 'pdf-lib';
import type { LoadDocResult } from './protocol';

export async function loadPdfFromBuffer(buffer: ArrayBuffer): Promise<PDFDocument> {
  return PDFDocument.load(buffer, { ignoreEncryption: true });
}

export function extractPageMeta(pdf: PDFDocument): LoadDocResult {
  const pages = pdf.getPages().map((page) => ({
    width: page.getWidth(),
    height: page.getHeight(),
  }));
  return {
    pageCount: pages.length,
    pages,
  };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/pdfEngine.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: 编写导出功能的失败测试**

追加到 `tests/unit/pdfEngine.test.ts`:
```typescript
import { buildExportPdf } from '../../src/worker/pdfEngine';

describe('buildExportPdf', () => {
  it('builds new PDF from selected pages with rotation applied', async () => {
    const buffer = await makeTestPdf(3);
    const pdf = await loadPdfFromBuffer(buffer);
    const docs = new Map([['doc1', pdf]]);

    const result = await buildExportPdf(docs, [
      { sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 90 },
      { sourceDocId: 'doc1', sourcePageIndex: 2, rotation: 0 },
    ]);

    expect(result.getPageCount()).toBe(2);
    const pages = result.getPages();
    expect(pages[0].getRotation().angle).toBe(90);
    expect(pages[1].getRotation().angle).toBe(0);
  });

  it('throws when source doc not found', async () => {
    await expect(buildExportPdf(new Map(), [
      { sourceDocId: 'missing', sourcePageIndex: 0, rotation: 0 },
    ])).rejects.toThrow('Source document not found: missing');
  });
});
```

- [ ] **Step 6: 运行测试验证失败**

```bash
npx vitest run tests/unit/pdfEngine.test.ts
```
Expected: FAIL with "buildExportPdf is not defined"

- [ ] **Step 7: 实现 buildExportPdf**

追加到 `src/worker/pdfEngine.ts`:
```typescript
import { degrees } from 'pdf-lib';
import type { ExportPdfPayload } from './protocol';

export async function buildExportPdf(
  docs: Map<string, PDFDocument>,
  pages: ExportPdfPayload['pages'],
): Promise<PDFDocument> {
  const newPdf = await PDFDocument.create();
  for (const pageSpec of pages) {
    const sourcePdf = docs.get(pageSpec.sourceDocId);
    if (!sourcePdf) {
      throw new Error(`Source document not found: ${pageSpec.sourceDocId}`);
    }
    const [copied] = await newPdf.copyPages(sourcePdf, [pageSpec.sourcePageIndex]);
    copied.setRotation(degrees(pageSpec.rotation));
    newPdf.addPage(copied);
  }
  return newPdf;
}
```

- [ ] **Step 8: 运行测试验证通过**

```bash
npx vitest run tests/unit/pdfEngine.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 9: 提交**

```bash
git add src/worker/pdfEngine.ts tests/unit/pdfEngine.test.ts
git commit -m "feat: pdf engine - load, extract meta, build export with rotation"
```

---

### Task 1.5: 实现缩略图渲染(pdf.js)

**Files:**
- Create: `src/worker/thumbRenderer.ts`

- [ ] **Step 1: 配置 pdf.js worker**

在 `src/worker/thumbRenderer.ts` 中,使用 pdf.js 的 `getDocument` API。由于已在 Worker 内,直接用主线程 pdf.js:

```typescript
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// 设置 worker 路径(pdf.js 内部 worker)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

const docCache = new Map<string, PDFDocumentProxy>();

export async function loadPdfForRender(
  docId: string,
  buffer: ArrayBuffer,
): Promise<PDFDocumentProxy> {
  const cached = docCache.get(docId);
  if (cached) return cached;
  const task = pdfjsLib.getDocument({ data: buffer });
  const doc = await task.promise;
  docCache.set(docId, doc);
  return doc;
}

export async function renderThumb(
  docId: string,
  pageIndex: number,
  rotation: 0 | 90 | 180 | 270,
  maxWidth: number = 200,
): Promise<ImageBitmap> {
  const doc = docCache.get(docId);
  if (!doc) throw new Error(`Document not loaded for render: ${docId}`);

  const page = await doc.getPage(pageIndex + 1); // pdf.js 用 1-based
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale, rotation });

  const canvas = new OffscreenCanvas(scaledViewport.width, scaledViewport.height);
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  return canvas.transferToImageBitmap();
}

export function disposeDoc(docId: string): void {
  const doc = docCache.get(docId);
  if (doc) {
    doc.destroy();
    docCache.delete(docId);
  }
}
```

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit
```
Expected: 无错误。若有 pdf.js 类型缺失,运行 `npm install --save-dev @types/pdfjs-dist` 或确认 pdfjs-dist 自带类型。

- [ ] **Step 3: 提交**

```bash
git add src/worker/thumbRenderer.ts
git commit -m "feat: thumbnail renderer using pdf.js + OffscreenCanvas"
```

---

### Task 1.6: 实现 Worker 入口

**Files:**
- Create: `src/worker/pdf.worker.ts`

- [ ] **Step 1: 实现 Worker 消息分发**

创建 `src/worker/pdf.worker.ts`:
```typescript
import { PDFDocument } from 'pdf-lib';
import { loadPdfFromBuffer, extractPageMeta, buildExportPdf } from './pdfEngine';
import { loadPdfForRender, renderThumb, disposeDoc } from './thumbRenderer';
import type { WorkerRequest, WorkerResponse } from './protocol';

const docs = new Map<string, PDFDocument>();
const thumbCache = new Map<string, ImageBitmap>();

function respond(msg: WorkerResponse, transfer?: Transferable[]): void {
  (self as any).postMessage(msg, transfer || []);
}

function thumbKey(docId: string, pageIndex: number, rotation: number): string {
  return `${docId}:${pageIndex}:${rotation}`;
}

async function handleRequest(req: WorkerRequest): Promise<void> {
  try {
    switch (req.type) {
      case 'loadDoc': {
        const { docId, buffer } = req.payload as any;
        const pdf = await loadPdfFromBuffer(buffer);
        docs.set(docId, pdf);
        await loadPdfForRender(docId, buffer);
        const meta = extractPageMeta(pdf);
        respond({ id: req.id, ok: true, data: meta });
        break;
      }
      case 'renderThumb': {
        const { docId, pageIndex, rotation } = req.payload as any;
        const key = thumbKey(docId, pageIndex, rotation);
        let bitmap = thumbCache.get(key);
        if (!bitmap) {
          bitmap = await renderThumb(docId, pageIndex, rotation);
          thumbCache.set(key, bitmap);
        }
        respond({ id: req.id, ok: true, data: bitmap }, [bitmap]);
        break;
      }
      case 'exportPdf': {
        const { pages } = req.payload as any;
        const newPdf = await buildExportPdf(docs, pages);
        const bytes = await newPdf.save();
        const buffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        );
        respond({ id: req.id, ok: true, data: buffer }, [buffer]);
        break;
      }
      default:
        respond({ id: req.id, ok: false, error: `Unknown request type: ${(req as any).type}` });
    }
  } catch (err) {
    respond({ id: req.id, ok: false, error: String(err) });
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  handleRequest(e.data);
};
```

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
git add src/worker/pdf.worker.ts
git commit -m "feat: worker entry - dispatch load/render/export requests with cache"
```

---

### Task 1.7: 实现 Worker 客户端封装

**Files:**
- Create: `src/worker/workerClient.ts`

- [ ] **Step 1: 实现请求/响应 Promise 封装**

创建 `src/worker/workerClient.ts`:
```typescript
import type { WorkerRequest, WorkerResponse } from './protocol';

const pending = new Map<string, { resolve: (data: any) => void; reject: (err: Error) => void }>();

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const res = e.data;
      const p = pending.get(res.id);
      if (!p) return;
      pending.delete(res.id);
      if (res.ok) {
        p.resolve(res.data);
      } else {
        p.reject(new Error(res.error || 'Worker error'));
      }
    };
  }
  return worker;
}

let nextId = 0;

function request<T = any>(type: WorkerRequest['type'], payload: any, transfer?: Transferable[]): Promise<T> {
  const id = String(++nextId);
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const req: WorkerRequest = { id, type, payload } as WorkerRequest;
    getWorker().postMessage(req, transfer || []);
  });
}

export const workerClient = {
  loadDoc: (docId: string, buffer: ArrayBuffer) =>
    request('loadDoc', { docId, buffer }, [buffer]),
  renderThumb: (docId: string, pageIndex: number, rotation: 0 | 90 | 180 | 270) =>
    request<ImageBitmap>('renderThumb', { docId, pageIndex, rotation }),
  exportPdf: (pages: any[]) =>
    request<ArrayBuffer>('exportPdf', { pages }),
};
```

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
git add src/worker/workerClient.ts
git commit -m "feat: worker client with promise-based request/response"
```

---

### Task 1.8: 实现 Zustand 编辑器状态(基础)

**Files:**
- Create: `src/store/editorStore.ts`

- [ ] **Step 1: 实现基础状态与 loadDocument 动作**

创建 `src/store/editorStore.ts`:
```typescript
import { create } from 'zustand';
import type { Page, SourceDoc } from '../types/pdf';
import { workerClient } from '../worker/workerClient';

interface EditorState {
  sourceDocs: SourceDoc[];
  pages: Page[];
  activeDocId: string | null;
  selection: Set<string>;
  lastSelectedId: string | null;
  past: Command[];
  future: Command[];
  loadingThumbs: Set<string>;
  isExporting: boolean;
  error: string | null;

  loadDocument: (path: string, fileName: string) => Promise<void>;
  setPageThumbnail: (pageId: string, bitmap: ImageBitmap) => void;
  setError: (err: string | null) => void;
}

let docCounter = 0;

export const useEditorStore = create<EditorState>((set, get) => ({
  sourceDocs: [],
  pages: [],
  activeDocId: null,
  selection: new Set(),
  lastSelectedId: null,
  past: [],
  future: [],
  loadingThumbs: new Set(),
  isExporting: false,
  error: null,

  loadDocument: async (path, fileName) => {
    try {
      const buffer = await window.electronAPI.readPdf(path);
      const docId = `doc-${++docCounter}`;
      await workerClient.loadDoc(docId, buffer);
      // 重新读 buffer 给 pdf.js(pdf-lib 在 worker 内已消费)
      const buffer2 = await window.electronAPI.readPdf(path);
      await workerClient.loadDoc(docId, buffer2);

      // 获取元数据需要再次 load - 改为:loadDoc 返回 meta
      // 修正:让 loadDoc 返回元数据
      const meta = await workerClient.loadDoc(docId, buffer);
      // 注意:上面调用了两次 loadDoc,实际应只一次并返回 meta
      // 见下方修正

      const doc: SourceDoc = {
        id: docId,
        fileName,
        pageCount: meta.pageCount,
      };

      const pages: Page[] = meta.pages.map((p: any, i: number) => ({
        id: `${docId}-p${i}`,
        sourceDocId: docId,
        sourcePageIndex: i,
        rotation: 0,
        width: p.width,
        height: p.height,
        thumbnail: null,
        deleted: false,
      }));

      set((state) => ({
        sourceDocs: [...state.sourceDocs, doc],
        pages: [...state.pages, ...pages],
        activeDocId: docId,
        error: null,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  setPageThumbnail: (pageId, bitmap) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, thumbnail: bitmap } : p,
      ),
    }));
  },

  setError: (err) => set({ error: err }),
}));
```

注意上面 `loadDocument` 的 buffer 重复消费问题需修正:

- [ ] **Step 2: 修正 loadDocument 的 buffer 消费问题**

修正 `loadDocument` 实现。pdf-lib 的 `load` 不消费原 buffer(它复制数据),但为安全起见只调用一次。同时让 `workerClient.loadDoc` 返回 meta。重写 `loadDocument`:

```typescript
  loadDocument: async (path, fileName) => {
    try {
      const buffer = await window.electronAPI.readPdf(path);
      const docId = `doc-${++docCounter}`;
      const meta = await workerClient.loadDoc(docId, buffer);

      const doc: SourceDoc = {
        id: docId,
        fileName,
        pageCount: meta.pageCount,
      };

      const pages: Page[] = meta.pages.map((p: any, i: number) => ({
        id: `${docId}-p${i}`,
        sourceDocId: docId,
        sourcePageIndex: i,
        rotation: 0,
        width: p.width,
        height: p.height,
        thumbnail: null,
        deleted: false,
      }));

      set((state) => ({
        sourceDocs: [...state.sourceDocs, doc],
        pages: [...state.pages, ...pages],
        activeDocId: docId,
        error: null,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },
```

并修改 `workerClient.loadDoc` 的返回类型以包含 meta:

修改 `src/worker/workerClient.ts` 中 `loadDoc`:
```typescript
  loadDoc: (docId: string, buffer: ArrayBuffer) =>
    request<{ pageCount: number; pages: Array<{ width: number; height: number }> }>(
      'loadDoc', { docId, buffer }, [buffer],
    ),
```

同时确认 Worker `loadDoc` 处理返回 meta(已在 Task 1.6 中返回 `extractPageMeta(pdf)`,✓)。

- [ ] **Step 3: 验证编译通过**

```bash
npx tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add src/store/editorStore.ts src/worker/workerClient.ts
git commit -m "feat: zustand editor store with loadDocument and thumbnail state"
```

---

### Task 1.9: 实现三栏布局静态组件

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Create: `src/components/Toolbar/Toolbar.tsx`
- Create: `src/components/Sidebar/Sidebar.tsx`
- Create: `src/components/PageGrid/PageGrid.tsx`
- Create: `src/components/PageGrid/PageCard.tsx`
- Create: `src/components/InspectorPanel/InspectorPanel.tsx`
- Create: `src/components/StatusBar/StatusBar.tsx`
- Create: `src/global.d.ts`

- [ ] **Step 1: 声明 electronAPI 全局类型**

创建 `src/global.d.ts`:
```typescript
import type { ElectronAPI } from '../../electron/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

- [ ] **Step 2: 实现渲染进程入口**

创建 `src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: 实现 App 三栏布局**

创建 `src/App.tsx`:
```typescript
import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PageGrid } from './components/PageGrid/PageGrid';
import { InspectorPanel } from './components/InspectorPanel/InspectorPanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <Sidebar />
        <PageGrid />
        <InspectorPanel />
      </div>
      <StatusBar />
    </div>
  );
}
```

- [ ] **Step 4: 实现基础样式**

创建 `src/App.css`:
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; font-family: -apple-system, sans-serif; }
.app { display: flex; flex-direction: column; height: 100vh; }
.workspace { display: flex; flex: 1; overflow: hidden; }
```

- [ ] **Step 5: 实现 Toolbar(打开按钮)**

创建 `src/components/Toolbar/Toolbar.tsx`:
```typescript
import { useEditorStore } from '../../store/editorStore';

export function Toolbar() {
  const loadDocument = useEditorStore((s) => s.loadDocument);

  const handleOpen = async () => {
    const files = await window.electronAPI.openPdfDialog();
    if (!files) return;
    for (const f of files) {
      await loadDocument(f.path, f.name);
    }
  };

  return (
    <div className="toolbar">
      <button onClick={handleOpen}>打开</button>
      <button disabled>导出 ▾</button>
      <span className="spacer" />
      <button disabled>↶</button>
      <button disabled>↷</button>
    </div>
  );
}
```

- [ ] **Step 6: 实现 Sidebar**

创建 `src/components/Sidebar/Sidebar.tsx`:
```typescript
import { useEditorStore } from '../../store/editorStore';

export function Sidebar() {
  const sourceDocs = useEditorStore((s) => s.sourceDocs);
  const activeDocId = useEditorStore((s) => s.activeDocId);

  return (
    <div className="sidebar">
      <h3>文档</h3>
      {sourceDocs.length === 0 && <p className="empty">未加载文档</p>}
      {sourceDocs.map((doc) => (
        <div
          key={doc.id}
          className={`doc-item ${doc.id === activeDocId ? 'active' : ''}`}
        >
          <span className="doc-name">{doc.fileName}</span>
          <span className="doc-count">{doc.pageCount} 页</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: 实现 PageCard**

创建 `src/components/PageGrid/PageCard.tsx`:
```typescript
import { useEffect, useRef } from 'react';
import type { Page } from '../../types/pdf';
import { useEditorStore } from '../../store/editorStore';
import { workerClient } from '../../worker/workerClient';

interface Props {
  page: Page;
  index: number;
}

export function PageCard({ page, index }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setPageThumbnail = useEditorStore((s) => s.setPageThumbnail);

  useEffect(() => {
    if (page.thumbnail) {
      drawToCanvas(canvasRef.current, page.thumbnail, page.rotation);
      return;
    }
    let cancelled = false;
    workerClient
      .renderThumb(page.sourceDocId, page.sourcePageIndex, page.rotation)
      .then((bitmap) => {
        if (cancelled) return;
        setPageThumbnail(page.id, bitmap);
        drawToCanvas(canvasRef.current, bitmap, page.rotation);
      });
    return () => { cancelled = true; };
  }, [page.thumbnail, page.rotation, page.id, page.sourceDocId, page.sourcePageIndex]);

  return (
    <div className={`page-card ${page.deleted ? 'deleted' : ''}`}>
      <canvas ref={canvasRef} />
      <span className="page-number">{index + 1}</span>
    </div>
  );
}

function drawToCanvas(
  canvas: HTMLCanvasElement | null,
  bitmap: ImageBitmap,
  rotation: number,
) {
  if (!canvas) return;
  const isLandscape = rotation === 90 || rotation === 270;
  canvas.width = isLandscape ? bitmap.height : bitmap.width;
  canvas.height = isLandscape ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
}
```

- [ ] **Step 8: 实现 PageGrid**

创建 `src/components/PageGrid/PageGrid.tsx`:
```typescript
import { useEditorStore } from '../../store/editorStore';
import { PageCard } from './PageCard';

export function PageGrid() {
  const pages = useEditorStore((s) => s.pages);

  if (pages.length === 0) {
    return (
      <div className="page-grid empty">
        <p>点击"打开"加载 PDF 文件</p>
      </div>
    );
  }

  return (
    <div className="page-grid">
      {pages.map((page, index) => (
        <PageCard key={page.id} page={page} index={index} />
      ))}
    </div>
  );
}
```

- [ ] **Step 9: 实现 InspectorPanel 与 StatusBar(占位)**

创建 `src/components/InspectorPanel/InspectorPanel.tsx`:
```typescript
export function InspectorPanel() {
  return (
    <div className="inspector-panel">
      <h3>属性</h3>
      <p className="empty">未选中页面</p>
    </div>
  );
}
```

创建 `src/components/StatusBar/StatusBar.tsx`:
```typescript
import { useEditorStore } from '../../store/editorStore';

export function StatusBar() {
  const pages = useEditorStore((s) => s.pages);
  const deletedCount = pages.filter((p) => p.deleted).length;

  return (
    <div className="status-bar">
      共 {pages.length} 页 · 已删除 {deletedCount}
    </div>
  );
}
```

- [ ] **Step 10: 添加组件样式**

创建 `src/components/components.css`:
```css
.toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid #ddd; background: #f5f5f5; }
.toolbar .spacer { flex: 1; }
.toolbar button { padding: 6px 12px; cursor: pointer; }
.toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }

.sidebar { width: 200px; border-right: 1px solid #ddd; padding: 12px; overflow-y: auto; background: #fafafa; }
.sidebar h3 { font-size: 13px; color: #666; margin-bottom: 8px; }
.sidebar .empty { color: #999; font-size: 13px; }
.doc-item { display: flex; justify-content: space-between; padding: 6px 8px; border-radius: 4px; font-size: 13px; }
.doc-item.active { background: #e3f2fd; }
.doc-count { color: #999; }

.page-grid { flex: 1; overflow-y: auto; padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; align-content: start; }
.page-grid.empty { display: flex; align-items: center; justify-content: center; color: #999; }
.page-card { border: 1px solid #ddd; border-radius: 4px; padding: 8px; text-align: center; background: white; position: relative; }
.page-card.deleted { opacity: 0.4; }
.page-card canvas { max-width: 100%; height: auto; display: block; margin: 0 auto; }
.page-card .page-number { font-size: 12px; color: #666; }

.inspector-panel { width: 220px; border-left: 1px solid #ddd; padding: 12px; background: #fafafa; }
.inspector-panel h3 { font-size: 13px; color: #666; margin-bottom: 8px; }
.inspector-panel .empty { color: #999; font-size: 13px; }

.status-bar { padding: 4px 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666; background: #f5f5f5; }
```

在 `src/main.tsx` 顶部添加:
```typescript
import './components/components.css';
```

- [ ] **Step 11: 启动 dev 验证**

```bash
npm run dev:electron
```
Expected: Electron 窗口打开,显示三栏布局。点"打开"选择 PDF,左侧显示文档,中间显示缩略图网格。

- [ ] **Step 12: 提交**

```bash
git add src/
git commit -m "feat: three-pane layout with PDF loading and thumbnail display"
```

---

## 阶段 2:选择与拖拽

### Task 2.1: 实现选择集状态

**Files:**
- Modify: `src/store/editorStore.ts`
- Create: `src/hooks/useSelection.ts`

- [ ] **Step 1: 编写选择逻辑失败测试**

创建 `tests/unit/editorStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

function seedPages(ids: string[]) {
  useEditorStore.setState({
    pages: ids.map((id, i) => ({
      id, sourceDocId: 'doc1', sourcePageIndex: i,
      rotation: 0 as const, width: 595, height: 842,
      thumbnail: null, deleted: false,
    })),
    selection: new Set(),
  });
}

describe('selection', () => {
  beforeEach(() => {
    useEditorStore.setState({ pages: [], selection: new Set(), lastSelectedId: null });
  });

  it('selectPage replaces selection with single page', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.getState().selectPage('b', false, false);
    expect(useEditorStore.getState().selection).toEqual(new Set(['b']));
  });

  it('ctrl+click toggles page in selection', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.getState().selectPage('a', false, false);
    useEditorStore.getState().selectPage('b', true, false);
    expect(useEditorStore.getState().selection).toEqual(new Set(['a', 'b']));
    useEditorStore.getState().selectPage('a', true, false);
    expect(useEditorStore.getState().selection).toEqual(new Set(['b']));
  });

  it('shift+click selects range from last selected', () => {
    seedPages(['a', 'b', 'c', 'd', 'e']);
    useEditorStore.getState().selectPage('a', false, false);
    useEditorStore.getState().selectPage('d', false, true);
    expect(useEditorStore.getState().selection).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('clearSelection empties the set', () => {
    seedPages(['a']);
    useEditorStore.getState().selectPage('a', false, false);
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().selection.size).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/editorStore.test.ts
```
Expected: FAIL - selectPage/clearSelection not defined, lastSelectedId not in state.

- [ ] **Step 3: 添加选择状态与动作到 store**

修改 `src/store/editorStore.ts`,在 state 接口添加:
```typescript
  selection: Set<string>;
  lastSelectedId: string | null;

  selectPage: (pageId: string, ctrl: boolean, shift: boolean) => void;
  clearSelection: () => void;
```

在初始 state 添加:
```typescript
  selection: new Set(),
  lastSelectedId: null,
```

在 create 回调添加动作:
```typescript
  selectPage: (pageId, ctrl, shift) => {
    const { pages, selection, lastSelectedId } = get();
    if (shift && lastSelectedId) {
      const ids = pages.map((p) => p.id);
      const start = ids.indexOf(lastSelectedId);
      const end = ids.indexOf(pageId);
      if (start === -1 || end === -1) return;
      const [from, to] = start < end ? [start, end] : [end, start];
      const range = ids.slice(from, to + 1);
      set({ selection: new Set([...selection, ...range]) });
    } else if (ctrl) {
      const next = new Set(selection);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      set({ selection: next, lastSelectedId: pageId });
    } else {
      set({ selection: new Set([pageId]), lastSelectedId: pageId });
    }
  },

  clearSelection: () => set({ selection: new Set(), lastSelectedId: null }),
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/editorStore.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: 提交**

```bash
git add src/store/editorStore.ts tests/unit/editorStore.test.ts
git commit -m "feat: selection state with click/ctrl/shift range select"
```

---

### Task 2.2: PageCard 集成选择交互

**Files:**
- Modify: `src/components/PageGrid/PageCard.tsx`

- [ ] **Step 1: 为 PageCard 添加点击选择**

修改 `src/components/PageGrid/PageCard.tsx`,在组件内添加 selection 读取与点击处理:
```typescript
import { useEditorStore } from '../../store/editorStore';
// ... 已有 import

export function PageCard({ page, index }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setPageThumbnail = useEditorStore((s) => s.setPageThumbnail);
  const selected = useEditorStore((s) => s.selection.has(page.id));
  const selectPage = useEditorStore((s) => s.selectPage);

  // ... 已有 useEffect

  const handleClick = (e: React.MouseEvent) => {
    selectPage(page.id, e.ctrlKey || e.metaKey, e.shiftKey);
  };

  return (
    <div
      className={`page-card ${page.deleted ? 'deleted' : ''} ${selected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} />
      <span className="page-number">{index + 1}</span>
    </div>
  );
}
```

- [ ] **Step 2: 添加选中样式**

在 `src/components/components.css` 的 `.page-card` 规则后追加:
```css
.page-card.selected { border-color: #1976d2; box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.3); }
```

- [ ] **Step 3: 验证编译通过**

```bash
npx tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add src/components/PageGrid/PageCard.tsx src/components/components.css
git commit -m "feat: page card click selection with visual feedback"
```

---

### Task 2.3: 实现拖拽重排

**Files:**
- Modify: `src/store/editorStore.ts`
- Modify: `src/components/PageGrid/PageGrid.tsx`
- Create: `tests/unit/movePages.test.ts`

- [ ] **Step 1: 编写 movePages 失败测试**

创建 `tests/unit/movePages.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

function seedPages(ids: string[]) {
  useEditorStore.setState({
    pages: ids.map((id, i) => ({
      id, sourceDocId: 'doc1', sourcePageIndex: i,
      rotation: 0 as const, width: 595, height: 842,
      thumbnail: null, deleted: false,
    })),
  });
}

describe('movePages', () => {
  beforeEach(() => {
    useEditorStore.setState({ pages: [], past: [], future: [] });
  });

  it('moves a single page to a new index', () => {
    seedPages(['a', 'b', 'c', 'd']);
    useEditorStore.getState().movePages(['a'], 3);
    const ids = useEditorStore.getState().pages.map((p) => p.id);
    expect(ids).toEqual(['b', 'c', 'd', 'a']);
  });

  it('moves multiple pages preserving their relative order', () => {
    seedPages(['a', 'b', 'c', 'd', 'e']);
    useEditorStore.getState().movePages(['b', 'd'], 4);
    const ids = useEditorStore.getState().pages.map((p) => p.id);
    expect(ids).toEqual(['a', 'c', 'e', 'b', 'd']);
  });

  it('pushes command to past and clears future', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.setState({ future: [{ type: 'move', payload: {}, undo: () => {} }] });
    useEditorStore.getState().movePages(['a'], 2);
    expect(useEditorStore.getState().past.length).toBe(1);
    expect(useEditorStore.getState().future.length).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/movePages.test.ts
```
Expected: FAIL - movePages not defined, past/future not in state.

- [ ] **Step 3: 实现 movePages 与历史栈**

修改 `src/store/editorStore.ts`,在接口添加:
```typescript
  past: Command[];
  future: Command[];
  movePages: (pageIds: string[], toIndex: number) => void;
```

在初始 state 添加:
```typescript
  past: [],
  future: [],
```

在 create 回调添加:
```typescript
  movePages: (pageIds, toIndex) => {
    const { pages } = get();
    const fromIndices = pageIds
      .map((id) => pages.findIndex((p) => p.id === id))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);
    if (fromIndices.length === 0) return;

    const movingPages = fromIndices.map((i) => pages[i]);
    const remaining = pages.filter((p) => !pageIds.includes(p.id));

    // 计算 toIndex 相对 remaining 的位置
    const adjustedToIndex = toIndex - fromIndices.filter((i) => i < toIndex).length;
    const clampedIndex = Math.max(0, Math.min(adjustedToIndex, remaining.length));

    const newPages = [
      ...remaining.slice(0, clampedIndex),
      ...movingPages,
      ...remaining.slice(clampedIndex),
    ];

    const fromStart = fromIndices[0];
    const undo = () => {
      const currentPages = get().pages;
      const movingBack = newPages.filter((p) => pageIds.includes(p.id));
      const stayingBack = currentPages.filter((p) => !pageIds.includes(p.id));
      const result = [...stayingBack];
      result.splice(fromStart, 0, ...movingBack);
      set({ pages: result });
    };

    set((state) => ({
      pages: newPages,
      past: [...state.past, { type: 'move' as const, payload: { pageIds, fromIndices, toIndex }, undo }],
      future: [],
    }));
  },
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/movePages.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: 集成 @dnd-kit 到 PageGrid**

修改 `src/components/PageGrid/PageGrid.tsx`:
```typescript
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { useEditorStore } from '../../store/editorStore';
import { PageCard } from './PageCard';

export function PageGrid() {
  const pages = useEditorStore((s) => s.pages);
  const movePages = useEditorStore((s) => s.movePages);

  if (pages.length === 0) {
    return (
      <div className="page-grid empty">
        <p>点击"打开"加载 PDF 文件</p>
      </div>
    );
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIndex = pages.findIndex((p) => p.id === active.id);
    const toIndex = pages.findIndex((p) => p.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    movePages([String(active.id)], toIndex);
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="page-grid">
          {pages.map((page, index) => (
            <PageCard key={page.id} page={page} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 6: 让 PageCard 可拖拽**

修改 `src/components/PageGrid/PageCard.tsx`,用 `useSortable`:
```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// ... 已有 import

export function PageCard({ page, index }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  // ... 已有的 canvas/thumbnail 逻辑

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`page-card ${page.deleted ? 'deleted' : ''} ${selected ? 'selected' : ''}`}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      <canvas ref={canvasRef} />
      <span className="page-number">{index + 1}</span>
    </div>
  );
}
```

- [ ] **Step 7: 验证编译与运行**

```bash
npx tsc --noEmit && npm run dev:electron
```
Expected: 编译无错,Electron 中可拖拽页面改变顺序。

- [ ] **Step 8: 提交**

```bash
git add src/store/editorStore.ts src/components/PageGrid/ tests/unit/movePages.test.ts
git commit -m "feat: drag-to-reorder pages with dnd-kit and history tracking"
```

---

## 阶段 3:旋转与删除 + 撤销/重做

### Task 3.1: 实现旋转

**Files:**
- Modify: `src/store/editorStore.ts`
- Create: `tests/unit/rotatePages.test.ts`

- [ ] **Step 1: 编写旋转失败测试**

创建 `tests/unit/rotatePages.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

function seedPages(ids: string[]) {
  useEditorStore.setState({
    pages: ids.map((id, i) => ({
      id, sourceDocId: 'doc1', sourcePageIndex: i,
      rotation: 0 as const, width: 595, height: 842,
      thumbnail: null, deleted: false,
    })),
  });
}

describe('rotatePages', () => {
  beforeEach(() => {
    useEditorStore.setState({ pages: [], past: [], future: [] });
  });

  it('increments rotation by 90 degrees', () => {
    seedPages(['a', 'b']);
    useEditorStore.getState().rotatePages(['a'], 90);
    const page = useEditorStore.getState().pages.find((p) => p.id === 'a')!;
    expect(page.rotation).toBe(90);
  });

  it('wraps around at 360', () => {
    seedPages(['a']);
    useEditorStore.getState().setState({
      pages: [{ id: 'a', sourceDocId: 'doc1', sourcePageIndex: 0, rotation: 270, width: 595, height: 842, thumbnail: null, deleted: false }],
    });
    useEditorStore.getState().rotatePages(['a'], 90);
    expect(useEditorStore.getState().pages[0].rotation).toBe(0);
  });

  it('pushes undo command to past', () => {
    seedPages(['a']);
    useEditorStore.getState().rotatePages(['a'], 90);
    expect(useEditorStore.getState().past.length).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/rotatePages.test.ts
```
Expected: FAIL - rotatePages not defined.

- [ ] **Step 3: 实现 rotatePages**

修改 `src/store/editorStore.ts`,接口添加:
```typescript
  rotatePages: (pageIds: string[], degrees: 90 | 180 | 270) => void;
```

create 回调添加:
```typescript
  rotatePages: (pageIds, degrees) => {
    const { pages } = get();
    const targetPages = pages.filter((p) => pageIds.includes(p.id));
    const oldRotations = new Map(targetPages.map((p) => [p.id, p.rotation]));

    const newPages = pages.map((p) =>
      pageIds.includes(p.id)
        ? { ...p, rotation: ((p.rotation + degrees) % 360) as 0 | 90 | 180 | 270 }
        : p,
    );

    const undo = () => {
      set((state) => ({
        pages: state.pages.map((p) =>
          oldRotations.has(p.id) ? { ...p, rotation: oldRotations.get(p.id)! } : p,
        ),
      }));
    };

    set((state) => ({
      pages: newPages,
      past: [...state.past, { type: 'rotate' as const, payload: { pageIds, degrees }, undo }],
      future: [],
    }));
  },
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/rotatePages.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: 提交**

```bash
git add src/store/editorStore.ts tests/unit/rotatePages.test.ts
git commit -m "feat: rotate pages with 90deg increments and history"
```

---

### Task 3.2: 实现软删除

**Files:**
- Modify: `src/store/editorStore.ts`
- Create: `tests/unit/deletePages.test.ts`

- [ ] **Step 1: 编写删除失败测试**

创建 `tests/unit/deletePages.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/store/editorStore';

function seedPages(ids: string[]) {
  useEditorStore.setState({
    pages: ids.map((id, i) => ({
      id, sourceDocId: 'doc1', sourcePageIndex: i,
      rotation: 0 as const, width: 595, height: 842,
      thumbnail: null, deleted: false,
    })),
  });
}

describe('deletePages', () => {
  beforeEach(() => {
    useEditorStore.setState({ pages: [], past: [], future: [], selection: new Set() });
  });

  it('marks pages as deleted (soft delete)', () => {
    seedPages(['a', 'b', 'c']);
    useEditorStore.getState().deletePages(['b']);
    const b = useEditorStore.getState().pages.find((p) => p.id === 'b')!;
    expect(b.deleted).toBe(true);
    const a = useEditorStore.getState().pages.find((p) => p.id === 'a')!;
    expect(a.deleted).toBe(false);
  });

  it('clears deleted pages from selection', () => {
    seedPages(['a', 'b']);
    useEditorStore.getState().selectPage('a', false, false);
    useEditorStore.getState().selectPage('b', true, false);
    useEditorStore.getState().deletePages(['a']);
    expect(useEditorStore.getState().selection.has('a')).toBe(false);
    expect(useEditorStore.getState().selection.has('b')).toBe(true);
  });

  it('pushes undo command that restores deleted state', () => {
    seedPages(['a']);
    useEditorStore.getState().deletePages(['a']);
    expect(useEditorStore.getState().past.length).toBe(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages[0].deleted).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/deletePages.test.ts
```
Expected: FAIL - deletePages/undo not defined.

- [ ] **Step 3: 实现 deletePages 与 undo/redo**

修改 `src/store/editorStore.ts`,接口添加:
```typescript
  deletePages: (pageIds: string[]) => void;
  undo: () => void;
  redo: () => void;
```

create 回调添加:
```typescript
  deletePages: (pageIds) => {
    const { pages, selection } = get();
    const oldStates = new Map(
      pages.filter((p) => pageIds.includes(p.id)).map((p) => [p.id, p.deleted]),
    );

    const undo = () => {
      set((state) => ({
        pages: state.pages.map((p) =>
          oldStates.has(p.id) ? { ...p, deleted: oldStates.get(p.id)! } : p,
        ),
      }));
    };

    const nextSelection = new Set(selection);
    pageIds.forEach((id) => nextSelection.delete(id));

    set((state) => ({
      pages: pages.map((p) =>
        pageIds.includes(p.id) ? { ...p, deleted: true } : p,
      ),
      selection: nextSelection,
      past: [...state.past, { type: 'delete' as const, payload: { pageIds }, undo }],
      future: [],
    }));
  },

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return;
    const cmd = past[past.length - 1];
    cmd.undo();
    set({
      past: past.slice(0, -1),
      future: [...future, cmd],
    });
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;
    const cmd = future[future.length - 1];
    // 重做需要重新执行 - 由于 undo 闭包已记录状态,redo 需重新应用
    // 简化:命令对象记录足够信息以重新执行。对于 delete,redo = 再次标记 deleted
    if (cmd.type === 'delete') {
      const { pageIds } = cmd.payload;
      set((state) => ({
        pages: state.pages.map((p) =>
          pageIds.includes(p.id) ? { ...p, deleted: true } : p,
        ),
      }));
    } else if (cmd.type === 'move') {
      get().movePages(cmd.payload.pageIds, cmd.payload.toIndex);
      // movePages 会再次 push past,需移除多余的
      set((state) => ({ past: state.past.slice(0, -1) }));
    } else if (cmd.type === 'rotate') {
      get().rotatePages(cmd.payload.pageIds, cmd.payload.degrees);
      set((state) => ({ past: state.past.slice(0, -1) }));
    }
    set({
      past: [...past, cmd],
      future: future.slice(0, -1),
    });
  },
```

注意:redo 逻辑较复杂,因为 undo 用闭包记录状态。为保持简洁与正确,采用「重做即重新执行原操作」策略。但 movePages/rotatePages 内部会 push past,所以需在调用后移除多余的那条。这是权衡,后续可重构为命令模式带 execute/undo 双方法。

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/deletePages.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: 运行全部单元测试**

```bash
npx vitest run
```
Expected: 所有测试 PASS

- [ ] **Step 6: 提交**

```bash
git add src/store/editorStore.ts tests/unit/deletePages.test.ts
git commit -m "feat: soft delete pages with undo/redo support"
```

---

### Task 3.3: InspectorPanel 集成旋转/删除按钮

**Files:**
- Modify: `src/components/InspectorPanel/InspectorPanel.tsx`
- Modify: `src/components/Toolbar/Toolbar.tsx`

- [ ] **Step 1: 实现 InspectorPanel 操作按钮**

修改 `src/components/InspectorPanel/InspectorPanel.tsx`:
```typescript
import { useEditorStore } from '../../store/editorStore';

export function InspectorPanel() {
  const pages = useEditorStore((s) => s.pages);
  const selection = useEditorStore((s) => s.selection);
  const rotatePages = useEditorStore((s) => s.rotatePages);
  const deletePages = useEditorStore((s) => s.deletePages);

  const selectedPages = pages.filter((p) => selection.has(p.id) && !p.deleted);
  if (selectedPages.length === 0) {
    return (
      <div className="inspector-panel">
        <h3>属性</h3>
        <p className="empty">未选中页面</p>
      </div>
    );
  }

  const first = selectedPages[0];

  return (
    <div className="inspector-panel">
      <h3>属性</h3>
      <p>选中 {selectedPages.length} 页</p>
      {selectedPages.length === 1 && (
        <>
          <p>第 {pages.indexOf(first) + 1} 页</p>
          <p>{Math.round(first.width)} × {Math.round(first.height)}</p>
          <p>旋转:{first.rotation}°</p>
        </>
      )}
      <button onClick={() => rotatePages([...selection], 90)}>↻ 旋转 90°</button>
      <button onClick={() => deletePages([...selection])}>✕ 删除</button>
    </div>
  );
}
```

- [ ] **Step 2: 实现 Toolbar 撤销/重做按钮**

修改 `src/components/Toolbar/Toolbar.tsx`:
```typescript
import { useEditorStore } from '../../store/editorStore';

export function Toolbar() {
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);

  const handleOpen = async () => {
    const files = await window.electronAPI.openPdfDialog();
    if (!files) return;
    for (const f of files) {
      await loadDocument(f.path, f.name);
    }
  };

  return (
    <div className="toolbar">
      <button onClick={handleOpen}>打开</button>
      <button disabled>导出 ▾</button>
      <span className="spacer" />
      <button onClick={undo} disabled={!canUndo}>↶</button>
      <button onClick={redo} disabled={!canRedo}>↷</button>
    </div>
  );
}
```

- [ ] **Step 3: 添加键盘快捷键(Delete 删除、Ctrl+Z 撤销)**

修改 `src/App.tsx`,添加 useEffect:
```typescript
import { useEffect } from 'react';
import { useEditorStore } from './store/editorStore';
// ... 已有 import

export default function App() {
  const deletePages = useEditorStore((s) => s.deletePages);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const selection = useEditorStore((s) => s.selection);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.size > 0) {
          e.preventDefault();
          deletePages([...selection]);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection, deletePages, undo, redo]);

  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <Sidebar />
        <PageGrid />
        <InspectorPanel />
      </div>
      <StatusBar />
    </div>
  );
}
```

- [ ] **Step 4: 验证编译与运行**

```bash
npx tsc --noEmit && npm run dev:electron
```
Expected: 选中页面后右侧显示旋转/删除按钮,点击生效,撤销/重做工作。

- [ ] **Step 5: 提交**

```bash
git add src/components/ src/App.tsx
git commit -m "feat: inspector panel rotate/delete + toolbar undo/redo + shortcuts"
```

---

## 阶段 4:多文档合并与导出

### Task 4.1: 实现导出功能

**Files:**
- Modify: `src/store/editorStore.ts`
- Modify: `src/components/Toolbar/Toolbar.tsx`

- [ ] **Step 1: 实现 exportPdf 动作**

修改 `src/store/editorStore.ts`,接口添加:
```typescript
  exportPdf: (mode: 'current' | 'selected' | 'all') => Promise<void>;
```

create 回调添加:
```typescript
  exportPdf: async (mode) => {
    const { pages, selection, sourceDocs, activeDocId } = get();
    let exportPages: Page[];
    if (mode === 'current') {
      exportPages = pages.filter((p) => p.sourceDocId === activeDocId && !p.deleted);
    } else if (mode === 'selected') {
      exportPages = pages.filter((p) => selection.has(p.id) && !p.deleted);
    } else {
      exportPages = pages.filter((p) => !p.deleted);
    }
    if (exportPages.length === 0) {
      set({ error: '没有可导出的页面' });
      return;
    }

    set({ isExporting: true, error: null });
    try {
      const savePath = await window.electronAPI.savePdfDialog();
      if (!savePath) {
        set({ isExporting: false });
        return;
      }
      const workerPages = exportPages.map((p) => ({
        sourceDocId: p.sourceDocId,
        sourcePageIndex: p.sourcePageIndex,
        rotation: p.rotation,
      }));
      const buffer = await workerClient.exportPdf(workerPages);
      await window.electronAPI.writePdf(savePath, buffer);
      set({ isExporting: false });
    } catch (err) {
      set({ isExporting: false, error: String(err) });
    }
  },
```

- [ ] **Step 2: 实现 Toolbar 导出下拉菜单**

修改 `src/components/Toolbar/Toolbar.tsx`,替换导出按钮:
```typescript
import { useState } from 'react';
// ... 已有 import

export function Toolbar() {
  // ... 已有 hooks
  const exportPdf = useEditorStore((s) => s.exportPdf);
  const isExporting = useEditorStore((s) => s.isExporting);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // ... handleOpen

  return (
    <div className="toolbar">
      <button onClick={handleOpen}>打开</button>
      <div className="export-menu">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          disabled={isExporting}
        >
          {isExporting ? '导出中...' : '导出 ▾'}
        </button>
        {showExportMenu && (
          <div className="dropdown">
            <button onClick={() => { exportPdf('current'); setShowExportMenu(false); }}>
              导出当前文档
            </button>
            <button onClick={() => { exportPdf('selected'); setShowExportMenu(false); }}>
              导出选中页
            </button>
            <button onClick={() => { exportPdf('all'); setShowExportMenu(false); }}>
              合并全部导出
            </button>
          </div>
        )}
      </div>
      <span className="spacer" />
      <button onClick={undo} disabled={!canUndo}>↶</button>
      <button onClick={redo} disabled={!canRedo}>↷</button>
    </div>
  );
}
```

- [ ] **Step 3: 添加导出菜单样式**

在 `src/components/components.css` 追加:
```css
.export-menu { position: relative; }
.export-menu .dropdown { position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10; min-width: 160px; }
.export-menu .dropdown button { display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; }
.export-menu .dropdown button:hover { background: #f0f0f0; }
```

- [ ] **Step 4: 验证编译与运行**

```bash
npx tsc --noEmit && npm run dev:electron
```
Expected: 点导出下拉,选择模式,弹保存框,生成 PDF。

- [ ] **Step 5: 提交**

```bash
git add src/store/editorStore.ts src/components/Toolbar/Toolbar.tsx src/components/components.css
git commit -m "feat: export PDF with current/selected/all modes"
```

---

## 阶段 5:打磨

### Task 5.1: 虚拟滚动

**Files:**
- Modify: `src/components/PageGrid/PageGrid.tsx`

- [ ] **Step 1: 用 react-window 实现虚拟网格**

修改 `src/components/PageGrid/PageGrid.tsx`:
```typescript
import { FixedSizeGrid } from 'react-window';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useEditorStore } from '../../store/editorStore';
import { PageCard } from './PageCard';

const COLUMN_WIDTH = 180;
const ROW_HEIGHT = 240;
const GAP = 16;

export function PageGrid() {
  const pages = useEditorStore((s) => s.pages);
  const movePages = useEditorStore((s) => s.movePages);

  if (pages.length === 0) {
    return <div className="page-grid empty"><p>点击"打开"加载 PDF 文件</p></div>;
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const toIndex = pages.findIndex((p) => p.id === over.id);
    if (toIndex === -1) return;
    movePages([String(active.id)], toIndex);
  };

  // 简化:虚拟滚动与 dnd-kit 集成复杂,这里用 CSS grid + overflow,大文档时启用
  // 完整虚拟滚动需自定义 dnd-kit droppable。先保持非虚拟,后续优化。
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="page-grid">
          {pages.map((page, index) => (
            <PageCard key={page.id} page={page} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

注意:react-window 与 dnd-kit 的深度集成需要自定义 droppable 网格,实现复杂度高。本任务先保留 CSS grid 方案(里程碑 5 验收要求 100 页流畅,CSS grid 在 100 页时仍可用)。完整虚拟滚动留作后续优化,在计划中记录此权衡。

- [ ] **Step 2: 验证 100 页场景**

```bash
npm run dev:electron
```
用一个 100 页 PDF 测试,确认滚动与拖拽流畅(若不流畅,记录为已知限制)。

- [ ] **Step 3: 提交**

```bash
git add src/components/PageGrid/PageGrid.tsx
git commit -m "chore: document virtual scroll tradeoff, keep css grid for now"
```

---

### Task 5.2: 错误处理与状态显示

**Files:**
- Modify: `src/components/StatusBar/StatusBar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: StatusBar 显示错误与选中数**

修改 `src/components/StatusBar/StatusBar.tsx`:
```typescript
import { useEditorStore } from '../../store/editorStore';

export function StatusBar() {
  const pages = useEditorStore((s) => s.pages);
  const selection = useEditorStore((s) => s.selection);
  const error = useEditorStore((s) => s.error);
  const isExporting = useEditorStore((s) => s.isExporting);

  const deletedCount = pages.filter((p) => p.deleted).length;

  return (
    <div className="status-bar">
      <span>共 {pages.length} 页</span>
      <span>· 选中 {selection.size}</span>
      <span>· 已删除 {deletedCount}</span>
      {isExporting && <span className="status-exporting">· 导出中...</span>}
      {error && <span className="status-error">· 错误:{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: 添加错误样式**

在 `src/components/components.css` 追加:
```css
.status-bar { display: flex; gap: 8px; }
.status-error { color: #d32f2f; }
.status-exporting { color: #1976d2; }
```

- [ ] **Step 3: 提交**

```bash
git add src/components/StatusBar/StatusBar.tsx src/components/components.css
git commit -m "feat: status bar shows selection count, errors, export state"
```

---

### Task 5.3: E2E 冒烟测试

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.test.ts`

- [ ] **Step 1: 配置 Playwright**

创建 `playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
```

- [ ] **Step 2: 编写冒烟测试(渲染进程 UI,不依赖 Electron)**

创建 `tests/e2e/smoke.test.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('app loads with empty state', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.toolbar')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.page-grid.empty')).toBeVisible();
  await expect(page.locator('.inspector-panel')).toBeVisible();
  await expect(page.locator('.status-bar')).toContainText('共 0 页');
});

test('toolbar shows open and export buttons', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.toolbar button')).toContainText(['打开', '导出']);
});
```

注意:完整 E2E(打开真实 PDF、拖拽、导出)需要 Electron 环境,配置复杂。此处先覆盖 UI 渲染冒烟测试,验证布局完整性。完整 Electron E2E 留作后续。

- [ ] **Step 3: 运行 E2E**

```bash
npx playwright install
npx playwright test
```
Expected: 2 tests PASS

- [ ] **Step 4: 提交**

```bash
git add playwright.config.ts tests/e2e/smoke.test.ts
git commit -m "test: e2e smoke test for layout and toolbar"
```

---

## 计划完成

所有 5 个阶段完成后的验收清单:

- [ ] 能打开 PDF,显示缩略图网格(阶段 1)
- [ ] 能拖拽改变页面顺序,多选页面(阶段 2)
- [ ] 能旋转、删除,撤销/重做工作(阶段 3)
- [ ] 能合并多文档并导出新 PDF(阶段 4)
- [ ] 100 页 PDF 可用,异常有提示,E2E 通过(阶段 5)

## 自审记录

**Spec 覆盖检查:**
- ✅ 拆分/合并/提取/重排 → movePages(2.3)、exportPdf selected/all 模式(4.1)
- ✅ 页面旋转 → rotatePages(3.1)
- ✅ 多页选中/批量操作 → selection(2.1)、InspectorPanel 批量按钮(3.3)
- ✅ 撤销/重做 → undo/redo(3.2)、Toolbar 按钮(3.3)
- ✅ 可视化缩略图拖拽 → pdf.js 渲染(1.5)、dnd-kit(2.3)
- ✅ 三栏布局 → App.tsx(1.9)

**已知权衡(非占位符,是明确决策):**
- 虚拟滚动(5.1):react-window 与 dnd-kit 深度集成复杂度高,100 页内 CSS grid 足够,留作后续优化
- redo 实现(3.2):采用「重新执行原操作」策略,调用 movePages/rotatePages 后移除多余 past 条目,可后续重构为 execute/undo 双方法命令模式
- E2E(5.3):先覆盖渲染进程 UI 冒烟测试,完整 Electron E2E 留作后续
