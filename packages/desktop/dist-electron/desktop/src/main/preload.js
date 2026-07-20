"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
function sanitizeIpcArg(value) {
    if (value === undefined) {
        return null;
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeIpcArg);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .filter(([, entryValue]) => entryValue !== undefined)
            .map(([key, entryValue]) => [key, sanitizeIpcArg(entryValue)]));
    }
    return value;
}
const electronApi = {
    isElectron: true,
    ipcRenderer: {
        send(channel, payload) {
            if (payload === undefined) {
                electron_1.ipcRenderer.send(channel);
                return;
            }
            electron_1.ipcRenderer.send(channel, sanitizeIpcArg(payload));
        },
        invoke(channel, ...args) {
            return electron_1.ipcRenderer.invoke(channel, ...args.map(sanitizeIpcArg));
        },
        on(channel, listener) {
            const wrappedListener = (_event, ...args) => {
                listener(...args);
            };
            electron_1.ipcRenderer.on(channel, wrappedListener);
            return () => {
                electron_1.ipcRenderer.removeListener(channel, wrappedListener);
            };
        },
    },
};
electron_1.contextBridge.exposeInMainWorld('electron', electronApi);
