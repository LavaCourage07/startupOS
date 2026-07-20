"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachDevToolsContextMenu = attachDevToolsContextMenu;
const electron_1 = require("electron");
function openDevTools(webContents) {
    if (webContents.isDestroyed())
        return;
    webContents.openDevTools({ mode: 'detach' });
}
function attachDevToolsContextMenu(window) {
    window.webContents.on('context-menu', (_event, params) => {
        if (window.isDestroyed() || window.webContents.isDestroyed())
            return;
        const menu = electron_1.Menu.buildFromTemplate([
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
