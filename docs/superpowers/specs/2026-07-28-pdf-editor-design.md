# PDF 编辑工具 - 设计文档

> 创建日期: 2026-07-28
> 状态: 已确认,待审阅

## 1. 概述

基于 Electron 的桌面 PDF 编辑工具,专注页面级操作:拆分、合并、提取、重排。支持可视化缩略图拖拽、页面旋转、多页批量操作、撤销/重做。

### 核心功能
- 页面操作:拆分 / 合并 / 提取 / 重排
- 页面旋转(90/180/270 度)
- 多页选中 / 批量操作
- 撤销 / 重做

### 非目标(YAGNI)
- 编辑 PDF 原有文字内容
- 添加标注 / 注释
- 表单填写 / 创建
- OCR 识别

## 2. 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 桌面框架 | Electron | 生态成熟,PDF 库丰富,开发速度快 |
| 前端 | React + TypeScript + Vite | 生态最大,组件库丰富 |
| 状态管理 | Zustand | 轻量,API 简洁 |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable | React 生态最现代,支持多选拖拽,维护活跃 |
| PDF 操作 | pdf-lib | 纯 JS,拆分/合并/旋转能力强,无原生依赖 |
| 缩略图渲染 | pdf.js | Mozilla 出品,渲染能力强 |
| 虚拟滚动 | react-window | 大文档性能 |
| 测试 | Vitest + Playwright | 单元 + E2E |

## 3. 架构:方案 B(Web Worker 卸载重活)

### 3.1 整体结构

```
┌─────────────────────────────────────────────────────┐
│              渲染进程主线程 (React UI)                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ 工具栏      │  │ 页面网格视图  │  │ 属性面板   │  │
│  └─────────────┘  └──────────────┘  └────────────┘  │
│         │                │                ▲          │
│         ▼                ▼                │          │
│  ┌──────────────────────────────────────────────┐   │
│  │       编辑器状态管理 (Zustand)               │   │
│  │  - pages: Page[] (元数据 + ImageBitmap)      │   │
│  │  - selection: Set<pageId>                   │   │
│  │  - history: 过去/未来栈 (撤销/重做)          │   │
│  └──────────────────────────────────────────────┘   │
│         │ IPC (preload 桥接)                  ▲     │
│         ▼  文件读写                       postMessage│
└─────────┼────────────────────────────────────┼──────┘
          │                                    │
┌─────────▼────────────────┐  ┌────────────────▼──────┐
│   主进程 (Node.js)       │  │   Web Worker           │
│                          │  │   (pdf.js + pdf-lib)   │
│                          │  │   耗时操作:           │
│   仅负责:               │  │   - 渲染缩略图         │
│   - 文件对话框           │  │     (OffscreenCanvas   │
│   - 读 PDF -> ArrayBuffer│  │      -> ImageBitmap    │
│   - 写 PDF 到磁盘        │  │      零拷贝转移)       │
│   不碰 PDF 解析          │  │   - 拆分/合并/旋转     │
└──────────────────────────┘  │     (pdf-lib)          │
                              └────────────────────────┘
```

### 3.2 三个独立单元,职责单一

| 单元 | 职责 | 不做什么 |
|------|------|---------|
| 主进程 | 文件对话框、磁盘 I/O、窗口管理 | 不解析 PDF 内容 |
| Web Worker | 渲染缩略图、pdf-lib 页面操作 | 不接触 DOM、不碰磁盘 |
| React 渲染进程 | UI 交互、状态管理、撤销重做 | 不直接做耗时计算 |

### 3.3 关键设计决策

1. **PDF 数据驻留 Worker,不外泄**
   主进程读入 PDF -> ArrayBuffer -> transfer(零拷贝)给 Worker。Worker 持有 PDFDocument 实例,后续所有操作都在 Worker 内完成。渲染进程只持有 Page[] 元数据 + ImageBitmap。

2. **缩略图零拷贝传递**
   Worker 用 OffscreenCanvas 渲染页面 -> transferToImageBitmap() -> postMessage 时放进 transfer list,主线程零拷贝收到 ImageBitmap,直接用 canvas 绘制。

3. **撤销/重做用命令模式**
   每个操作封装为 { type, payload, undo() }。因为操作的是元数据(顺序、旋转、删除),不是 PDF 二进制,撤销几乎零成本。

### 3.4 为什么选方案 B 而非方案 C

方案 C(主进程+IPC)的痛点是 IPC 序列化开销大,尤其缩略图图片数据。虽然可用临时文件 URL 绕开,但引入临时目录管理、URL 生命周期、清理逻辑等新复杂度。

实际工作负载中,真正耗时的只有缩略图渲染一处。Web Worker 的 OffscreenCanvas + transferToImageBitmap 零拷贝方案直接解决了这个问题,无需临时文件。pdf-lib 的拆分/合并/旋转只操作 PDF 结构,几十毫秒完成。

方案 C 的优势(原生模块、内存隔离、多核并行)对本项目用不上,反而要承担架构复杂度。

## 4. 数据模型与状态管理

### 4.1 核心数据类型

```typescript
// 渲染进程持有的页面元数据(不包含 PDF 二进制)
interface Page {
  id: string;              // 唯一标识,React key
  sourceDocId: string;     // 来源文档 ID(支持多文档合并)
  sourcePageIndex: number; // 在源文档中的原始页码
  rotation: 0 | 90 | 180 | 270;  // 旋转角度
  width: number;           // 原始页面尺寸(点)
  height: number;
  thumbnail: ImageBitmap | null;  // 缩略图,异步加载
  deleted: boolean;        // 软删除,支持撤销
}

// 已加载的源文档(Worker 持有实际 PDFDocument,这里只是元数据)
interface SourceDoc {
  id: string;
  fileName: string;
  pageCount: number;
  // 实际的 pdf-lib PDFDocument 在 Worker 内,不暴露到渲染进程
}

// 撤销/重做的命令对象
interface Command {
  type: 'move' | 'delete' | 'rotate' | 'merge';
  payload: any;
  undo(): void;            // 撤销时执行
}
```

### 4.2 Zustand 状态结构

```typescript
interface EditorState {
  // === 数据 ===
  sourceDocs: SourceDoc[];
  pages: Page[];
  selection: Set<string>;
  activeDocId: string | null;

  // === 历史栈 ===
  past: Command[];
  future: Command[];

  // === 异步状态 ===
  loadingThumbs: Set<string>;
  isExporting: boolean;
  error: string | null;

  // === 动作 ===
  loadDocument: (file: File) => Promise<void>;
  movePages: (pageIds: string[], toIndex: number) => void;
  deletePages: (pageIds: string[]) => void;
  rotatePages: (pageIds: string[], degrees: 90 | 180 | 270) => void;
  // ...
}
```

### 4.3 关键设计点

1. **软删除 + 撤销零成本**
   删除时不从 pages 移除,只标记 deleted: true,显示时过滤。撤销只需把 deleted 设回 false。导出时才真正剔除。UI 可显示"已删除"灰显状态。

2. **旋转直接改元数据,不碰 PDF**
   rotation 字段存在 Page 上,旋转只改这个数字。导出时由 Worker 把累计旋转角度应用到 PDF。旋转响应瞬时,多次旋转累积(90 + 90 = 180)。

3. **选择集用 Set,O(1) 查询**
   拖拽多选、Ctrl/Cmd 点击增选、Shift 范围选,都用 Set<pageId>。

4. **缩略图懒加载**
   loadDocument 后只创建 Page[] 元数据,thumbnail: null。组件挂载到视口内时才发消息让 Worker 渲染。大文档(100+ 页)不卡顿。

5. **撤销/重做是命令栈,不是快照**
   不存全量状态快照(内存浪费),每个 Command 只记"做了什么 + 怎么撤销":
   ```typescript
   {
     type: 'move',
     payload: { pageIds, fromIndex, toIndex },
     undo: () => { /* 把 pageIds 移回 fromIndex */ }
   }
   ```

## 5. 通信设计

### 5.1 三层通信结构

```
React 组件 (调用 hooks)
    │
    ▼
Zustand store (动作层)
    │
    ├──ipcRenderer──> 主进程 IPC (文件 I/O)
    │
    └──worker.postMessage──> Worker 通信层 (计算)
```

### 5.2 Worker 请求/响应协议

```typescript
interface WorkerRequest {
  id: string;              // 请求 ID,关联响应
  type: 'loadDoc' | 'renderThumb' | 'exportPdf';
  payload: any;
}

interface WorkerResponse {
  id: string;
  ok: boolean;
  data?: any;
  error?: string;
  transfer?: Transferable[];  // 零拷贝转移列表
}
```

### 5.3 主进程 IPC 通道(4 个,职责单纯)

| 通道 | 方向 | 用途 | 数据 |
|------|------|------|------|
| dialog:openPdf | 渲染->主 | 打开文件选择对话框 | 返回 {path, name} |
| fs:readPdf | 渲染->主 | 读 PDF 为 ArrayBuffer | 入参 path,返回 ArrayBuffer |
| fs:writePdf | 渲染->主 | 写 PDF 到磁盘 | 入参 {path, buffer} |
| dialog:savePdf | 渲染->主 | 保存对话框 | 返回 path |

主进程不解析 PDF,只是"文件搬运工"。

### 5.4 Worker 内部结构

```typescript
let docs = new Map<string, PDFDocument>();  // 持有已加载的 PDFDocument

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = e.data;
  try {
    switch (type) {
      case 'loadDoc': {
        const pdf = await PDFDocument.load(payload.buffer, { ignoreEncryption: true });
        docs.set(payload.docId, pdf);
        const meta = extractPageMeta(pdf);
        respond(id, { ok: true, data: meta });
        break;
      }
      case 'renderThumb': {
        const pdf = docs.get(payload.docId);
        const bitmap = await renderPageToBitmap(pdf, payload.pageIndex, payload.rotation);
        respond(id, { ok: true, data: bitmap }, [bitmap]);  // 零拷贝转移
        break;
      }
      case 'exportPdf': {
        const newPdf = await buildExportPdf(docs, payload.pages);
        const bytes = await newPdf.save();
        respond(id, { ok: true, data: bytes }, [bytes.buffer]);
        break;
      }
    }
  } catch (err) {
    respond(id, { ok: false, error: String(err) });
  }
};
```

### 5.5 缩略图缓存策略

Worker 内维护 `Map<pageKey, ImageBitmap>` 缓存:
- pageKey = `${docId}:${pageIndex}:${rotation}`
- 旋转时先查缓存(90->180 可能命中)
- 未命中才重新渲染
- 文档关闭时释放缓存 + bitmap.close() 防内存泄漏

### 5.6 错误处理边界

| 层 | 处理什么 | 怎么处理 |
|----|---------|---------|
| 主进程 IPC | 文件不存在、权限、磁盘满 | 返回 {ok:false, error},UI 显示提示 |
| Worker | PDF 损坏、加密、pdf-lib 异常 | 捕获后返回 error,不 crash Worker |
| 渲染进程 | Worker 超时、消息异常 | 设置 error 状态,UI 显示重试按钮 |

Worker 内用 try/catch 包住每个请求,确保单次失败不影响后续操作。

### 5.7 完整流程示例:打开并显示一个 PDF

```
1. 用户点"打开"
   └─> ipcRenderer.invoke('dialog:openPdf')
       └─> 主进程显示对话框,返回 {path, name}

2. 渲染进程读文件
   └─> ipcRenderer.invoke('fs:readPdf', path)
       └─> 主进程读文件,返回 ArrayBuffer(transfer,零拷贝)

3. 渲染进程交给 Worker 加载
   └─> worker.postMessage({id, type:'loadDoc', payload:{docId, buffer}}, [buffer])
       └─> Worker 用 pdf-lib 加载,存入 docs Map
       └─> 返回 {pageCount, pages: [{width, height}, ...]}

4. 渲染进程更新 Zustand
   └─> 设置 sourceDocs、pages(元数据,thumbnail: null)

5. 页面网格组件挂载,可见页面触发缩略图加载
   └─> useThumbnail(pageId) hook
       └─> worker.postMessage({id, type:'renderThumb', payload:{docId, pageIndex, rotation}})
           └─> Worker: pdf.js 渲染 -> OffscreenCanvas -> transferToImageBitmap()
           └─> 返回 ImageBitmap(transfer,零拷贝)
       └─> 更新 pages[i].thumbnail = bitmap
       └─> canvas 绘制 ImageBitmap
```

## 6. UI 设计

### 6.1 三栏布局

```
┌──────────────────────────────────────────────────────┐
│  [打开]  [导出 ▾]  [↶] [↷]              [-  100%  +] │
├────────┬──────────────────────────┬────────────────┤
│ 文档   │                          │  属性          │
│        │   ┌────┐  ┌────┐  ┌────┐ │                │
│▸a.pdf  │   │    │  │████│  │    │ │  第 2 页       │
│ 5 页   │   │ 1  │  │ 2  │  │ 3  │ │  A4 · 竖向     │
│        │   │    │  │████│  │    │ │                │
│▸b.pdf  │   └────┘  └────┘  └────┘ │  [ ↻ 旋转 ]    │
│ 3 页   │                          │  [ ✕ 删除 ]    │
│        │   ┌────┐  ┌────┐  ┌────┐ │  [ ⤴ 提取 ]    │
│        │   │    │  │    │  │    │ │                │
│        │   │ 4  │  │ 5  │  │ 6  │ │                │
│        │   │    │  │    │  │    │ │                │
│        │   └────┘  └────┘  └────┘ │                │
├────────┴──────────────────────────┴────────────────┤
│  共 8 页 · 选中 1 · 已删除 0 · 100%                 │
└──────────────────────────────────────────────────────┘
```

- 左栏:已加载文档列表(可多选合并)
- 中栏:页面缩略图网格(拖拽重排区)
- 右栏:选中页的属性与操作
- 所有区域常驻可见

### 6.2 组件树

```
<App>
  <Toolbar>                       顶部工具栏
    <OpenButton />
    <ExportButton />              导出(下拉:当前文档/选中页/合并全部)
    <UndoRedoButtons />           撤销/重做(灰显当不可用)
    <ZoomControls />              缩略图大小 +/-
  </Toolbar>

  <Workspace>                     主工作区
    <Sidebar>                     左侧文档列表
      <DocTab />
    </Sidebar>

    <PageGrid>                    核心区域
      <PageCard />
      <DropIndicator />
    </PageGrid>

    <InspectorPanel>              右侧属性面板
      <PageInfo />
      <RotateButtons />
      <DeleteButton />
      <ExtractButton />
    </InspectorPanel>
  </Workspace>

  <StatusBar>                     底部状态栏
</App>
```

### 6.3 交互设计

**选中(三种方式):**

| 操作 | 行为 |
|------|------|
| 单击页面 | 清空已选,只选该页 |
| Ctrl/Cmd + 单击 | 增删该页到选择集 |
| Shift + 单击 | 范围选:从上次锚点到当前页 |
| 框选(空白处拖拽) | 拖出矩形,框住的页面选中 |
| Ctrl/Cmd + A | 全选当前文档 |
| Esc | 清空选择 |

**拖拽重排:**
- 拖拽单个页面:选中该页拖动
- 拖拽多个:选中多页后,拖动其中任一页,整组移动
- 拖动时显示半透明跟随光标 + 蓝色插入指示线
- 释放在两页之间:插入到该位置,后面的页面后移
- 跨文档拖拽:从一个 DocTab 拖到另一个(合并场景)

**旋转:**
- 选中页面 -> 右侧面板点旋转按钮(顺时针 90°)
- 或右键菜单 -> 旋转
- 旋转累积:rotation = (rotation + 90) % 360
- 旋转即时反映在缩略图(若缓存命中)或重新渲染

**删除/恢复:**
- 选中 -> Delete 键 或 面板删除按钮
- 页面灰显 + 删除线效果,不从网格移除(软删除)
- 状态栏显示"已删除 N 页"
- Ctrl+Z 撤销删除,页面恢复正常

**导出:**
- 工具栏导出按钮,下拉菜单:
  - 导出当前文档(剔除已删除页)
  - 导出选中页为新 PDF
  - 合并所有文档导出
- 点导出 -> 弹保存对话框 -> Worker 构建 PDF -> 主进程写盘

### 6.4 拖拽库:@dnd-kit

选 @dnd-kit/core + @dnd-kit/sortable:
- React 生态最现代,支持键盘无障碍
- 原生支持多选拖拽
- 跨容器排序(Sidebar 多文档合并场景)
- 包体积小,维护活跃
- 不用 react-beautiful-dnd(已停止维护)

### 6.5 性能考量

| 问题 | 方案 |
|------|------|
| 大文档(100+页)网格卡顿 | 虚拟滚动(react-window),只渲染可见行 |
| 缩略图重复渲染 | IntersectionObserver 检测可见,懒加载 + Worker 缓存 |
| 拖拽时频繁重渲染 | dnd-kit 内部用 transform 不触发 React 重渲染 |
| ImageBitmap 内存 | 文档关闭 / 页面真正删除时调 bitmap.close() |

## 7. 项目结构

```
pdf编辑工具/
├── package.json
├── electron/
│   ├── main.ts                  # 主进程入口(窗口、IPC)
│   └── ipc/
│       ├── dialog.ts            # 文件对话框处理
│       └── fs.ts                # 文件读写
├── src/                         # 渲染进程(React)
│   ├── main.tsx                 # 渲染进程入口
│   ├── App.tsx                  # 根组件 + 布局
│   ├── components/
│   │   ├── Toolbar/             # 工具栏
│   │   ├── Sidebar/             # 左侧文档列表
│   │   ├── PageGrid/            # 中间页面网格
│   │   │   ├── PageGrid.tsx
│   │   │   ├── PageCard.tsx     # 单页卡片
│   │   │   └── DropIndicator.tsx
│   │   ├── InspectorPanel/      # 右侧属性面板
│   │   └── StatusBar/           # 底部状态栏
│   ├── store/
│   │   ├── editorStore.ts       # Zustand 主状态
│   │   └── history.ts           # 撤销/重做命令栈
│   ├── hooks/
│   │   ├── useThumbnail.ts      # 缩略图懒加载
│   │   └── useSelection.ts      # 选择集逻辑
│   ├── worker/
│   │   ├── pdf.worker.ts        # Worker 入口
│   │   ├── pdfEngine.ts         # pdf-lib 操作
│   │   ├── thumbRenderer.ts     # pdf.js 缩略图渲染
│   │   └── protocol.ts          # 请求/响应类型定义
│   └── types/
│       └── pdf.ts               # Page, SourceDoc, Command 等类型
├── tests/
│   ├── unit/
│   │   ├── pdfEngine.test.ts    # 纯函数测试,无 Electron 依赖
│   │   ├── history.test.ts      # 命令栈测试
│   │   └── editorStore.test.ts  # 状态逻辑测试
│   └── e2e/
│       └── workflows.test.ts    # Playwright 全流程
└── docs/superpowers/specs/
    └── 2026-07-28-pdf-editor-design.md
```

**关键边界:** src/worker/ 是自包含单元,只依赖 pdf-lib + pdf.js,不导入 React/Electron。可直接在 Node 环境(测试)或 Worker(运行)中运行。

## 8. 测试策略

| 层级 | 测什么 | 工具 | 优先级 |
|------|--------|------|--------|
| 纯函数 | pdfEngine 的拆分/合并/旋转/导出逻辑、history 命令栈 | Vitest | 高 |
| 状态逻辑 | Zustand store 的动作(移动、删除、选择) | Vitest + 测试 PDF 夹具 | 高 |
| Worker 通信 | 请求/响应协议、错误处理 | Vitest(直接调 worker 模块) | 中 |
| E2E 全流程 | 打开 PDF -> 拖拽重排 -> 旋转 -> 导出 | Playwright + Electron | 中 |

**测试优先原则:** pdfEngine 和 history 是核心逻辑,优先写单元测试。UI 组件用 E2E 覆盖关键路径,不做组件级快照测试。

## 9. 实现路径(5 个里程碑)

### 里程碑 1: 项目骨架 + 单文档显示
- Electron + Vite + React + TS 脚手架
- 主进程 IPC(dialog/fs)
- Worker 加载 PDF,返回页面元数据
- pdf.js 渲染单页缩略图 -> ImageBitmap
- 三栏布局静态展示
- **验收:能打开一个 PDF,看到缩略图网格**

### 里程碑 2: 选择与拖拽
- @dnd-kit 接入,拖拽重排
- 单击/Ctrl/Shift 选择逻辑
- 选择集状态管理
- **验收:能拖拽改变页面顺序,多选页面**

### 里程碑 3: 旋转与删除
- 旋转按钮 + 右键菜单
- 软删除 + 灰显视觉
- 撤销/重做命令栈
- 缩略图缓存(旋转命中)
- **验收:旋转/删除后能撤销重做**

### 里程碑 4: 多文档合并与导出
- Sidebar 多文档列表
- 跨文档拖拽合并
- pdf-lib 构建导出文档
- 导出对话框 + 写盘
- **验收:合并两个 PDF,导出新文件**

### 里程碑 5: 打磨
- 虚拟滚动(大文档)
- 错误处理与提示
- 快捷键绑定
- E2E 测试
- **验收:100 页 PDF 流畅,异常有友好提示**

**依赖关系:** 1 -> 2 -> 3 -> 4 -> 5 顺序推进,每个里程碑可独立验收。
