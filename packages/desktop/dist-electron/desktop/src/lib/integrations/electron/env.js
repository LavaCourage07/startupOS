"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isElectron = isElectron;
exports.getElectronBridge = getElectronBridge;
exports.getIpcRenderer = getIpcRenderer;
function getWindowWithElectron() {
    return window;
}
function isElectron() {
    return typeof window !== 'undefined' && typeof getWindowWithElectron().electron !== 'undefined';
}
function getElectronBridge() {
    if (!isElectron()) {
        throw new Error('Not running in Electron environment');
    }
    return getWindowWithElectron().electron;
}
function getIpcRenderer() {
    return getElectronBridge().ipcRenderer;
}
