/** 编辑器模式:阅读 / 页面编辑 / 内容编辑。 */
export type EditorMode = 'read' | 'pages' | 'content';

export interface Page {
  id: string;
  sourceDocId: string;
  sourcePageIndex: number;
  rotation: 0 | 90 | 180 | 270;
  width: number;
  height: number;
  thumbnail: string | null;  // dataURL,由主线程 pdf.js 渲染
  deleted: boolean;
}

export interface SourceDoc {
  id: string;
  fileName: string;
  pageCount: number;
  filePath: string | null;  // 磁盘文档有路径,合成文档(合并/拆分/另存)为 null
}

export type CommandType = 'move' | 'delete' | 'rotate' | 'merge' | 'insert' | 'duplicate' | 'split';

export interface Command {
  type: CommandType;
  payload: any;
  undo(): void;
}

export interface PageMeta {
  width: number;
  height: number;
}

/** 标注/内容编辑对象类型。 */
export type AnnotationType =
  | 'rect' | 'ellipse' | 'highlight' | 'text'
  | 'image' | 'watermark' | 'header' | 'footer';

/** 内容编辑工具(创建模式)。select = 仅选择/移动已有对象。 */
export type ContentTool = AnnotationType | 'select' | 'crop';

interface BaseAnno {
  id: string;
  pageId: string;
  type: AnnotationType;
  /** PDF 坐标系(pt,左下角原点)。 */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShapeAnno extends BaseAnno {
  type: 'rect' | 'ellipse';
  stroke: string;
  strokeWidth: number;
  fill?: string;
}

export interface HighlightAnno extends BaseAnno {
  type: 'highlight';
  color: string;
  opacity: number;
}

export interface TextAnno extends BaseAnno {
  type: 'text' | 'watermark' | 'header' | 'footer';
  text: string;
  color: string;
  fontSize: number;
  rotation?: number;
  opacity?: number;
}

export interface ImageAnno extends BaseAnno {
  type: 'image';
  dataUrl: string;
}

export type Annotation = ShapeAnno | HighlightAnno | TextAnno | ImageAnno;

/** 传递给 worker 的标注规格(用 pageIndex 替代 pageId)。 */
export interface AnnoSpec {
  pageIndex: number;
  type: AnnotationType;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  color?: string;
  fontSize?: number;
  rotation?: number;
  opacity?: number;
  text?: string;
  imageDataUrl?: string;
}
