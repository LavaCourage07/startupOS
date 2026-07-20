"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readLocalFile = readLocalFile;
exports.writeLocalFile = writeLocalFile;
exports.listLocalFiles = listLocalFiles;
exports.deleteLocalFile = deleteLocalFile;
exports.watchLocalPath = watchLocalPath;
exports.unwatchLocalPath = unwatchLocalPath;
exports.subscribeToLocalFsChanges = subscribeToLocalFsChanges;
const env_1 = require("./env");
const ipc_protocol_1 = require("./ipc-protocol");
async function readLocalFile(filePath) {
    if (!(0, env_1.isElectron)()) {
        throw new Error('Local file system is only available in Electron');
    }
    return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.FS_READ, filePath);
}
async function writeLocalFile(filePath, content) {
    if (!(0, env_1.isElectron)()) {
        throw new Error('Local file system is only available in Electron');
    }
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.FS_WRITE, filePath, content);
}
async function listLocalFiles(dirPath) {
    if (!(0, env_1.isElectron)()) {
        throw new Error('Local file system is only available in Electron');
    }
    return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.FS_LIST, dirPath);
}
async function deleteLocalFile(filePath) {
    if (!(0, env_1.isElectron)()) {
        throw new Error('Local file system is only available in Electron');
    }
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.FS_DELETE, filePath);
}
async function watchLocalPath(targetPath) {
    if (!(0, env_1.isElectron)()) {
        return;
    }
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.FS_WATCH, targetPath);
}
async function unwatchLocalPath(targetPath) {
    if (!(0, env_1.isElectron)()) {
        return;
    }
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.FS_UNWATCH, targetPath);
}
function subscribeToLocalFsChanges(listener) {
    if (!(0, env_1.isElectron)()) {
        return () => { };
    }
    return (0, env_1.getIpcRenderer)().on(ipc_protocol_1.IPC_CHANNELS.FS_CHANGED, (payload) => {
        if (payload && typeof payload === 'object' && 'path' in payload && typeof payload.path === 'string') {
            listener({ path: payload.path });
        }
    });
}
