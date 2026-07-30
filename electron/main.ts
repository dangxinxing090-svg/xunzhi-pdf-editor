import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerDialogHandlers } from './ipc/dialog.js';
import { registerFsHandlers } from './ipc/fs.js';
import { registerShellHandlers } from './ipc/shell.js';

// CommonJS provides __dirname natively in Electron main process
declare const __dirname: string;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  registerDialogHandlers();
  registerFsHandlers();
  registerShellHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
