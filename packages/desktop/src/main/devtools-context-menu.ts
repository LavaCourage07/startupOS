import { BrowserWindow, Menu, type WebContents } from 'electron';

function openDevTools(webContents: WebContents): void {
  if (webContents.isDestroyed()) return;
  webContents.openDevTools({ mode: 'detach' });
}

export function attachDevToolsContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_event, params) => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) return;

    const menu = Menu.buildFromTemplate([
      {
        label: 'Inspect Element',
        click: () => {
          if (params.x >= 0 && params.y >= 0) {
            window.webContents.inspectElement(params.x, params.y);
          }
          openDevTools(window.webContents);
        },
      },
      {
        label: 'Open DevTools',
        click: () => openDevTools(window.webContents),
      },
      { type: 'separator' },
      {
        label: 'Reload Window',
        click: () => {
          if (!window.webContents.isDestroyed()) {
            window.webContents.reload();
          }
        },
      },
    ]);

    menu.popup({ window });
  });
}
