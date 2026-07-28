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
