"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_CHANNELS = void 0;
exports.IPC_CHANNELS = {
    WINDOW_CREATE: 'window:create',
    WINDOW_CLOSE: 'window:close',
    WINDOW_FOCUS: 'window:focus',
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE: 'window:maximize',
    WINDOW_CLOSED: 'window:closed',
    FS_READ: 'fs:read',
    FS_WRITE: 'fs:write',
    FS_LIST: 'fs:list',
    FS_DELETE: 'fs:delete',
    FS_WATCH: 'fs:watch',
    FS_UNWATCH: 'fs:unwatch',
    FS_CHANGED: 'fs:changed',
    AGENT_START: 'agent:start',
    AGENT_STOP: 'agent:stop',
    AGENT_MESSAGE: 'agent:message',
    AGENT_ABORT: 'agent:abort',
    AGENT_EVENT: 'agent:event',
    AGENT_EXIT: 'agent:exit',
};
