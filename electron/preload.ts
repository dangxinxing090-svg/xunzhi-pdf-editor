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
