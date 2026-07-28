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
