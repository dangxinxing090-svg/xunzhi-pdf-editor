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
