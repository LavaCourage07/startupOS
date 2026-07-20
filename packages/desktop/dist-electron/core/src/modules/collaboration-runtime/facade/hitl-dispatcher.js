"use strict";
/**
 * Facade — HITL 用户回复路由
 *
 * 迁移自 src/lib/collaboration-runtime-service/index.ts（Story 9.38）
 * 职责：sendMessageToSupervisor、respondToHumanReview
 *
 * 依赖：session-store（sessions、eventStores、blackboards）、event-bus（eventEmitter）
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
exports.setStartDag = setStartDag;
exports.setResumeSupervisorHitl = setResumeSupervisorHitl;
exports.respondToHumanReview = respondToHumanReview;
exports.sendMessageToSupervisor = sendMessageToSupervisor;
const path_1 = __importDefault(require("path"));
const paths_1 = require("../../../lib/paths");
const llm_config_1 = require("../../../lib/integrations/pi-agent/llm-config");
const user_config_1 = require("../../../lib/features/user-config");
const blackboard_1 = require("../../../modules/collaboration-runtime/session/blackboard");
const fs_event_store_1 = require("../../../modules/collaboration-runtime/session/fs-event-store");
const session_store_1 = require("./session-store");
const event_bus_1 = require("./event-bus");
// startDag 需要前向引用，通过 setStartDag 注入（避免循环依赖）
let _startDag = null;
function setStartDag(fn) {
    _startDag = fn;
}
// resumeSupervisorHitl 需要前向引用，通过 setResumeSupervisorHitl 注入（避免循环依赖）
let _resumeSupervisorHitl = null;
function setResumeSupervisorHitl(fn) {
    _resumeSupervisorHitl = fn;
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
/**
 * 将消息中的附件引用 `[附件: name (name)]` 展开为包含绝对路径的格式。
 * 上传 API 返回的 path 是相对于 basePath 的文件名，需要补全为绝对路径。
 */
function expandAttachmentPaths(message, attachmentsAbsDir) {
    // 匹配 [附件: filename (filename)] 格式
    return message.replace(/\[附件: ([^\]]+?) \(([^)]+)\)\]/g, (_match, displayName, filePath) => {
        // filePath 可能是纯文件名，也可能已含路径；取 basename 拼绝对路径
        const absPath = path_1.default.join(attachmentsAbsDir, path_1.default.basename(filePath));
        return `[附件: ${displayName} (${absPath})]`;
    });
}
/** 用户回复 Human Review 请求 — Story 9.34: 路由到 Supervisor，不再直接 resume Worker */
async function respondToHumanReview(id, _agentId, response) {
    return sendMessageToSupervisor(id, response);
}
async function sendMessageToSupervisor(id, message, workerId, llmConfig) {
    await (0, session_store_1.loadPersistedSessions)();
    const session = session_store_1.sessions.get(id);
    if (!session) {
        return { success: false, error: `Session ${id} not found` };
    }
    // 用户最新的 llmConfig 优先级更高，每次发消息时更新 session 里存的配置
    if (llmConfig !== undefined && llmConfig !== null) {
        session.config.llmConfig = (0, llm_config_1.normalizeRuntimeLLMConfig)(llmConfig);
        logRuntime("facade.message.llm_config.request", {
            sessionId: id,
            projectId: session.projectId,
            llmConfig: summarizeRuntimeLLMConfig(session.config.llmConfig),
        });
    }
    else {
        const persistedConfig = (0, user_config_1.userLLMConfigToRuntimeLLMConfig)((0, user_config_1.readUserConfigWithProductDefaults)().llm);
        if (persistedConfig) {
            session.config.llmConfig = persistedConfig;
            logRuntime("facade.message.llm_config.persisted", {
                sessionId: id,
                projectId: session.projectId,
                llmConfig: summarizeRuntimeLLMConfig(session.config.llmConfig),
            });
        }
        else {
            logRuntime("facade.message.llm_config.missing", {
                sessionId: id,
                projectId: session.projectId,
                llmConfig: summarizeRuntimeLLMConfig(session.config.llmConfig),
            });
        }
    }
    logRuntime("facade.message.received", {
        sessionId: id,
        projectId: session.projectId,
        status: session.status,
        workerId: workerId ?? null,
        messageChars: message.length,
    });
    // 展开消息中的附件路径为绝对路径
    const attachmentsAbsDir = path_1.default.join((0, paths_1.getDataRoot)(), "projects", session.projectId, "collaboration-sessions", id, "attachments");
    const expandedMessage = expandAttachmentPaths(message, attachmentsAbsDir);
    // 欢迎模式：第一条消息成为全局目标，触发 DAG 启动（greeting 阶段不含附件，使用原始消息）
    if (session.status === "greeting") {
        session.globalGoal = expandedMessage;
        session.updatedAt = new Date().toISOString();
        // Recreate store/blackboard if lost (e.g. HMR)
        let store = session_store_1.eventStores.get(id);
        if (!store) {
            const sessionDir = path_1.default.join((0, paths_1.getDataRoot)(), "projects", session.projectId, "collaboration-sessions");
            store = new fs_event_store_1.FsEventStore(sessionDir);
            session_store_1.eventStores.set(id, store);
            const bb = new blackboard_1.Blackboard(id, path_1.default.join((0, paths_1.getDataRoot)(), "projects", session.projectId, "collaboration-sessions", id));
            session_store_1.blackboards.set(id, bb);
        }
        // 记录用户输入事件
        const userEvent = {
            id: `evt-user-goal-${Date.now()}`,
            sessionId: id,
            seq: 0,
            type: "USER_INPUT",
            payload: { message: expandedMessage },
            source: "user",
            target: "supervisor",
            timestamp: new Date().toISOString(),
        };
        void store.append(userEvent);
        event_bus_1.eventEmitter.emit(userEvent);
        if (_startDag) {
            await _startDag(session, store, id);
        }
        return { success: true };
    }
    if (session.status !== "running") {
        return { success: false, error: `Session ${id} is not running (status: ${session.status})` };
    }
    // Record the user reply event (使用展开后的消息，含附件绝对路径)
    const inputEvent = {
        id: `evt-user-reply-${Date.now()}`,
        sessionId: id,
        seq: 0,
        type: "USER_REPLY_TO_SUPERVISOR",
        payload: { to: "supervisor", message: expandedMessage, workerId: workerId ?? null },
        source: "user",
        target: "supervisor",
        timestamp: new Date().toISOString(),
    };
    const typedEvent = inputEvent;
    event_bus_1.eventEmitter.emit(typedEvent);
    const store = session_store_1.eventStores.get(id);
    if (store) {
        await store.append(typedEvent);
    }
    // If supervisor is suspended in HITL, resume it via the registry
    if (_resumeSupervisorHitl && _resumeSupervisorHitl(id, expandedMessage, workerId)) {
        return { success: true };
    }
    // Supervisor is alive and running — forward the message directly to keep conversation history
    const { getGlobalSpawner } = await Promise.resolve().then(() => __importStar(require("../../../modules/collaboration-runtime/sandbox")));
    const spawner = getGlobalSpawner();
    const supervisorAgentId = `supervisor-${id}`;
    const supervisorProc = spawner.get(supervisorAgentId);
    if (supervisorProc) {
        supervisorProc.prompt(expandedMessage).catch((err) => {
            console.error(`[hitl-dispatcher] Supervisor prompt error:`, err);
        });
        return { success: true };
    }
    // Supervisor no longer alive — start a fresh DAG with the new goal
    if (!store) {
        const sessionDir = path_1.default.join((0, paths_1.getDataRoot)(), "projects", session.projectId, "collaboration-sessions");
        const newStore = new fs_event_store_1.FsEventStore(sessionDir);
        session_store_1.eventStores.set(id, newStore);
    }
    const activeStore = session_store_1.eventStores.get(id);
    session.globalGoal = expandedMessage;
    if (_startDag) {
        await _startDag(session, activeStore, id);
    }
    return { success: true };
}
