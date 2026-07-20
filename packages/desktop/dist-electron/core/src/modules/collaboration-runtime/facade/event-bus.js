"use strict";
/**
 * Facade — SSE 客户端注册表 + 事件分发
 *
 * 迁移自 src/lib/collaboration-runtime-service/index.ts（Story 9.38）
 * 职责：SseEventEmitter、SSE client 注册/注销、grace 定时器、全局 eventEmitter
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventEmitter = void 0;
exports.addElectronForwarder = addElectronForwarder;
exports.registerClient = registerClient;
exports.unregisterClient = unregisterClient;
exports.getClientCount = getClientCount;
exports.startGraceTimer = startGraceTimer;
exports.subscribeToEvents = subscribeToEvents;
exports.unsubscribeFromEvents = unsubscribeFromEvents;
exports.clientDisconnected = clientDisconnected;
const path_1 = __importDefault(require("path"));
const fs_event_store_1 = require("../../../modules/collaboration-runtime/session/fs-event-store");
const session_store_1 = require("./session-store");
const paths_1 = require("../../../lib/paths");
class SseEventEmitter {
    constructor() {
        // Map from sessionId → clients subscribed to that session
        this.sessionClients = new Map();
    }
    emit(event) {
        const data = JSON.stringify(event);
        const targets = this.sessionClients.get(event.sessionId) ?? [];
        for (const client of targets) {
            try {
                client.send("message", data);
            }
            catch {
                // client disconnected, will be cleaned up
            }
        }
        // Electron 转发（同步，不依赖 SSE 客户端）
        for (const forwarder of globalThis.__collaborationElectronForwarders ?? []) {
            try {
                forwarder(event);
            }
            catch { /* ignore */ }
        }
    }
    addClient(sessionId, client) {
        const existing = this.sessionClients.get(sessionId) ?? [];
        if (!existing.includes(client)) {
            this.sessionClients.set(sessionId, [...existing, client]);
        }
    }
    removeClient(client) {
        for (const [sid, clients] of this.sessionClients) {
            const filtered = clients.filter((c) => c !== client);
            if (filtered.length !== clients.length) {
                this.sessionClients.set(sid, filtered);
            }
        }
    }
}
if (!globalThis.__collaborationEventEmitter) {
    globalThis.__collaborationEventEmitter = new SseEventEmitter();
}
if (!globalThis.__collaborationElectronForwarders) {
    globalThis.__collaborationElectronForwarders = new Set();
}
exports.eventEmitter = globalThis.__collaborationEventEmitter;
/**
 * 注册 Electron 转发回调（同步，不需要 await facade）。
 * 每个 RuntimeEvent 发出时都会调用所有已注册的回调。
 * 返回取消注册函数。
 */
function addElectronForwarder(cb) {
    globalThis.__collaborationElectronForwarders.add(cb);
    return () => { globalThis.__collaborationElectronForwarders.delete(cb); };
}
// ============================================================================
// SSE Consumer Tracking + Grace Period Disconnect
// ============================================================================
/** 每会话 SSE client 集合 */
const sessionClients = new Map();
/** 每会话断开 grace 定时器 */
const graceTimers = new Map();
const GRACE_PERIOD_MS = 30000; // 30s for page refresh reconnect
/** 注册客户端，如果有重连则取消 grace 定时器 */
function registerClient(id, client) {
    const clients = sessionClients.get(id) ?? new Set();
    clients.add(client);
    sessionClients.set(id, clients);
    // 页面刷新后重连，取消 grace 定时器
    const existing = graceTimers.get(id);
    if (existing) {
        clearTimeout(existing);
        graceTimers.delete(id);
    }
}
/** 移除客户端，最后一个离开时启动 grace 定时器 */
function unregisterClient(id, client) {
    const clients = sessionClients.get(id);
    if (!clients) {
        return;
    }
    clients.delete(client);
    if (clients.size === 0) {
        sessionClients.delete(id);
        startGraceTimer(id);
    }
}
/** 获取会话当前 SSE client 数量 */
function getClientCount(id) {
    return sessionClients.get(id)?.size ?? 0;
}
/** grace 定时器到期後如果没有新客户端连接，仅记录日志，不自动终止（进程由 window 关闭时手动回收） */
function startGraceTimer(id) {
    const timer = setTimeout(() => {
        graceTimers.delete(id);
        if (getClientCount(id) === 0) {
            console.error(`[collaboration] SSE disconnect: session ${id} has no clients after ${GRACE_PERIOD_MS}ms grace — waiting for explicit close`);
        }
    }, GRACE_PERIOD_MS);
    graceTimers.set(id, timer);
}
// ============================================================================
// Public API — SSE 订阅/取消订阅
// ============================================================================
function subscribeToEvents(id, client) {
    registerClient(id, client);
    exports.eventEmitter.addClient(id, client);
    // Reconstruct store if lost (HMR / server restart)
    let store = session_store_1.eventStores.get(id);
    if (!store) {
        const session = session_store_1.sessions.get(id);
        if (session) {
            const sessionDir = path_1.default.join((0, paths_1.getDataRoot)(), "projects", session.projectId, "collaboration-sessions");
            store = new fs_event_store_1.FsEventStore(sessionDir);
            session_store_1.eventStores.set(id, store);
        }
        else {
            // Session not in memory — scan filesystem to find the JSONL
            void (async () => {
                try {
                    const { readdir } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
                    const projectIds = await readdir(session_store_1.STATE_ROOT_DIR);
                    for (const pid of projectIds) {
                        const dir = path_1.default.join((0, paths_1.getDataRoot)(), "projects", pid, "collaboration-sessions");
                        const testStore = new fs_event_store_1.FsEventStore(dir);
                        const events = await testStore.read(id);
                        if (events.length > 0) {
                            session_store_1.eventStores.set(id, testStore);
                            return;
                        }
                    }
                }
                catch { /* ignore */ }
            })();
        }
    }
}
function unsubscribeFromEvents(client) {
    exports.eventEmitter.removeClient(client);
    // Find which session this client belongs to and unregister
    for (const [id, clients] of sessionClients) {
        if (clients.has(client)) {
            unregisterClient(id, client);
            break;
        }
    }
}
/** 显式通知某个会话的客户端断开（由 SSE route 调用） */
function clientDisconnected(id, client) {
    exports.eventEmitter.removeClient(client);
    unregisterClient(id, client);
}
