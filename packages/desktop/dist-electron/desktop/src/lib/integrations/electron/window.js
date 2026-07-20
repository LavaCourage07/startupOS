"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNativeWindow = createNativeWindow;
exports.closeNativeWindow = closeNativeWindow;
exports.focusNativeWindow = focusNativeWindow;
exports.minimizeNativeWindow = minimizeNativeWindow;
exports.maximizeNativeWindow = maximizeNativeWindow;
exports.subscribeToNativeWindowClosed = subscribeToNativeWindowClosed;
const env_1 = require("./env");
const ipc_protocol_1 = require("./ipc-protocol");
async function createNativeWindow(config) {
    if (!(0, env_1.isElectron)()) {
        throw new Error('Native windows are only available in Electron');
    }
    return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.WINDOW_CREATE, config);
}
async function closeNativeWindow(windowId) {
    if (!(0, env_1.isElectron)())
        return;
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.WINDOW_CLOSE, windowId);
}
async function focusNativeWindow(windowId) {
    if (!(0, env_1.isElectron)())
        return;
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.WINDOW_FOCUS, windowId);
}
async function minimizeNativeWindow(windowId) {
    if (!(0, env_1.isElectron)())
        return;
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.WINDOW_MINIMIZE, windowId);
}
async function maximizeNativeWindow(windowId) {
    if (!(0, env_1.isElectron)())
        return;
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.WINDOW_MAXIMIZE, windowId);
}
function subscribeToNativeWindowClosed(listener) {
    if (!(0, env_1.isElectron)()) {
        return () => { };
    }
    return (0, env_1.getIpcRenderer)().on(ipc_protocol_1.IPC_CHANNELS.WINDOW_CLOSED, (windowId) => {
        if (typeof windowId === 'string') {
            listener(windowId);
        }
    });
}
