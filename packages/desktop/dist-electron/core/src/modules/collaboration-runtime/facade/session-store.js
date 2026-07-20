"use strict";
/**
 * Facade — Session 状态机 + 持久化
 *
 * 迁移自 src/lib/collaboration-runtime-service/index.ts（Story 9.38）
 * 职责：sessions/eventStores/blackboards 全局 Map + 磁盘持久化 + Session CRUD
 *
 * 注意：此模块不 import event-bus，避免循环依赖。
 * getRuntime() 在 facade/index.ts 中初始化，此处通过 initRuntime() 注入。
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
exports.STATE_ROOT_DIR = exports.blackboards = exports.eventStores = exports.sessions = void 0;
exports.getProjectStateDir = getProjectStateDir;
exports.saveProjectSessions = saveProjectSessions;
exports.generateId = generateId;
exports.getRuntime = getRuntime;
exports.loadPersistedSessions = loadPersistedSessions;
exports.createSession = createSession;
exports.listSessions = listSessions;
exports.getSession = getSession;
exports.getBlackboardState = getBlackboardState;
exports.getEvents = getEvents;
const path_1 = __importDefault(require("path"));
const collaboration_runtime_1 = require("../../../modules/collaboration-runtime");
const blackboard_1 = require("../../../modules/collaboration-runtime/session/blackboard");
const fs_event_store_1 = require("../../../modules/collaboration-runtime/session/fs-event-store");
const orphan_reconciler_1 = require("../../../modules/collaboration-runtime/session/orphan-reconciler");
const llm_config_1 = require("../../../lib/integrations/pi-agent/llm-config");
const user_config_1 = require("../../../lib/features/user-config");
if (!globalThis.__collaborationSessions) {
    globalThis.__collaborationSessions = new Map();
}
if (!globalThis.__collaborationEventStores) {
    globalThis.__collaborationEventStores = new Map();
}
if (!globalThis.__collaborationBlackboards) {
    globalThis.__collaborationBlackboards = new Map();
}
exports.sessions = globalThis.__collaborationSessions;
exports.eventStores = globalThis.__collaborationEventStores;
exports.blackboards = globalThis.__collaborationBlackboards;
const paths_1 = require("../../../lib/paths");
exports.STATE_ROOT_DIR = path_1.default.join((0, paths_1.getDataRoot)(), "projects");
function getProjectStateDir(projectId) {
    return path_1.default.join(exports.STATE_ROOT_DIR, projectId, "collaboration-sessions");
}
async function saveProjectSessions(projectId) {
    const projectSessions = Array.from(exports.sessions.values()).filter((session) => session.projectId === projectId);
    await new orphan_reconciler_1.OrphanReconciler(getProjectStateDir(projectId)).saveSessions(projectSessions);
}
/** 生成唯一 session ID */
function generateId() {
    return `cs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
// ============================================================================
// FileOps 实现（使用 fs/promises）
// ============================================================================
const fileOps = {
    read: async (p) => {
        const { readFile } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        return readFile(p, "utf-8");
    },
    write: async (p, content) => {
        const { mkdir, writeFile } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        await mkdir(path_1.default.dirname(p), { recursive: true });
        await writeFile(p, content, "utf-8");
    },
    exists: async (p) => {
        const { stat } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        try {
            await stat(p);
            return true;
        }
        catch {
            return false;
        }
    },
    listDir: async (p) => {
        const { readdir } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        return readdir(p);
    },
};
// ============================================================================
// Runtime 实例（懒加载，由 facade/index.ts 调用时传入 eventEmitter）
// ============================================================================
let runtime = null;
function getRuntime(emitter, agentDefinitionParser) {
    if (!runtime) {
        const parser = agentDefinitionParser ?? {
            parseAgentDefinition: (content) => ({ content }),
            parseToolDefinition: (_content) => ({ allowedTools: [] }),
        };
        const deps = {
            agentEngine: {
                startAgent: async () => {
                    throw new Error("Not implemented in Phase 1 — use /execute endpoint");
                },
                stopAgent: async () => { },
                getAgent: () => null,
            },
            toolExecutor: {
                execute: async () => ({}),
                listTools: () => [],
            },
            ontologyStore: {
                query: async () => [],
                save: async () => { },
                delete: async () => { },
            },
            fileOps,
            eventEmitter: emitter,
            agentDefinitionParser: parser,
        };
        runtime = new collaboration_runtime_1.CollaborationRuntime(deps);
    }
    return runtime;
}
// ============================================================================
// 持久化 + 孤儿回收
// ============================================================================
let persistenceInitialized = false;
/** 从磁盘加载已保存的会话，并运行孤儿回收 */
async function loadPersistedSessions() {
    if (persistenceInitialized) {
        return;
    }
    persistenceInitialized = true;
    const { readdir } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
    try {
        const projectIds = await readdir(exports.STATE_ROOT_DIR);
        for (const projectId of projectIds) {
            const persisted = await new orphan_reconciler_1.OrphanReconciler(getProjectStateDir(projectId)).loadSessions();
            for (const session of persisted) {
                if (session.status === "terminated" || session.status === "completed" || session.status === "aborted") {
                    continue;
                }
                exports.sessions.set(session.id, session);
            }
        }
    }
    catch {
        // ignore empty state root
    }
}
function summarizeRuntimeLLMConfig(config) {
    if (!config)
        return { provided: false };
    const credentialSource = config.anthropicCredentialSource
        ?? (config.anthropicAuthToken ? "anthropicAuthToken" : undefined)
        ?? (config.anthropicApiKey ? "anthropicApiKey" : undefined)
        ?? (config.authToken ? "authToken" : undefined)
        ?? (config.apiKey ? "apiKey" : undefined);
    return {
        provided: true,
        provider: config.provider ?? "default",
        model: config.model ?? "default",
        baseUrl: config.anthropicBaseUrl ?? config.baseUrl ?? "default",
        hasCredential: Boolean(config.anthropicAuthToken || config.anthropicApiKey || config.authToken || config.apiKey),
        credentialSource: credentialSource ?? "none",
        maxTokens: config.maxTokens ?? "default",
    };
}
function logRuntime(phase, data) {
    console.error(`[MultiAgentRuntime] ${phase} ${JSON.stringify(data)}`);
}
async function createSession(input, emitter, agentDefinitionParser) {
    const id = generateId();
    const now = new Date().toISOString();
    const llmConfig = (0, llm_config_1.normalizeRuntimeLLMConfig)(input.llmConfig)
        ?? (0, user_config_1.userLLMConfigToRuntimeLLMConfig)((0, user_config_1.readUserConfigWithProductDefaults)().llm);
    logRuntime("facade.session.create", {
        sessionId: id,
        projectId: input.projectId,
        mode: input.mode ?? "default",
        hasGlobalGoal: Boolean(input.globalGoal),
        llmConfig: summarizeRuntimeLLMConfig(llmConfig),
        llmConfigSource: (0, llm_config_1.normalizeRuntimeLLMConfig)(input.llmConfig) ? "request" : llmConfig ? "persisted" : "missing",
    });
    // 规范化 projectId：统一使用带 proj- 前缀的格式，确保与文件系统路径一致
    const projectId = input.projectId.startsWith("proj-") ? input.projectId : `proj-${input.projectId}`;
    const session = {
        id,
        projectId,
        globalGoal: input.globalGoal,
        status: "created",
        createdAt: now,
        updatedAt: now,
        config: {
            maxIterations: input.maxIterations,
            timeoutMs: input.timeoutMs,
            mode: input.mode,
            llmConfig,
        },
    };
    // 记录宿主进程 PID（Story 9.24）
    const sessionWithPid = new orphan_reconciler_1.OrphanReconciler(getProjectStateDir(projectId)).recordPid(session);
    exports.sessions.set(id, sessionWithPid);
    // 持久化到磁盘
    await saveProjectSessions(projectId);
    // 创建 EventStore — baseDir 不含 sessionId，由 FsEventStore.sessionDir() 拼接
    const sessionDir = path_1.default.join((0, paths_1.getDataRoot)(), "projects", projectId, "collaboration-sessions");
    const store = new fs_event_store_1.FsEventStore(sessionDir);
    exports.eventStores.set(id, store);
    // 创建 Blackboard
    const bb = new blackboard_1.Blackboard(id, path_1.default.join((0, paths_1.getDataRoot)(), "projects", projectId, "collaboration-sessions", id));
    exports.blackboards.set(id, bb);
    // 注册到 Runtime
    getRuntime(emitter, agentDefinitionParser).createSession(sessionWithPid);
    return sessionWithPid;
}
async function listSessions() {
    await loadPersistedSessions();
    // 运行孤儿回收（Story 9.24）
    const allSessions = Array.from(exports.sessions.values());
    const reports = (await Promise.all(Array.from(new Set(allSessions.map((session) => session.projectId))).map((projectId) => new orphan_reconciler_1.OrphanReconciler(getProjectStateDir(projectId)).runReconciliation(allSessions.filter((session) => session.projectId === projectId))))).flat();
    // 更新内存中的会话
    for (const report of reports) {
        if (report.action === "terminated") {
            const session = exports.sessions.get(report.sessionId);
            if (session) {
                session.status = "terminated";
                session.terminationReason = report.reason;
                session.updatedAt = new Date().toISOString();
            }
        }
    }
    return Array.from(exports.sessions.values());
}
async function getSession(id) {
    await loadPersistedSessions();
    return exports.sessions.get(id) ?? null;
}
async function getBlackboardState(id) {
    const bb = exports.blackboards.get(id);
    if (!bb) {
        return null;
    }
    return bb.toState();
}
async function getEvents(id) {
    const store = exports.eventStores.get(id);
    if (!store) {
        return [];
    }
    return store.read(id);
}
