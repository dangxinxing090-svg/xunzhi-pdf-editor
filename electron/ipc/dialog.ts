import { ipcMain, dialog } from 'electron';
import { basename } from 'node:path';

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:openPdf', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths.map((filePath) => ({
      path: filePath,
      name: basename(filePath),
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
