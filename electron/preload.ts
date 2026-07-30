import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openPdfDialog: () => ipcRenderer.invoke('dialog:openPdf'),
  savePdfDialog: (defaultName?: string) => ipcRenderer.invoke('dialog:savePdf', defaultName),
  readPdf: (path: string) => ipcRenderer.invoke('fs:readPdf', path),
  writePdf: (path: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('fs:writePdf', path, buffer),
  renameFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('fs:renameFile', oldPath, newPath),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
