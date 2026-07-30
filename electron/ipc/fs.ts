import { ipcMain } from 'electron';
import { readFile, writeFile, rename } from 'fs/promises';

export function registerFsHandlers(): void {
  ipcMain.handle('fs:readPdf', async (_event, path: string) => {
    const buffer = await readFile(path);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  });

  ipcMain.handle('fs:writePdf', async (_event, path: string, buffer: ArrayBuffer) => {
    await writeFile(path, Buffer.from(buffer));
    return true;
  });

  ipcMain.handle('fs:renameFile', async (_event, oldPath: string, newPath: string) => {
    await rename(oldPath, newPath);
    return true;
  });
}
