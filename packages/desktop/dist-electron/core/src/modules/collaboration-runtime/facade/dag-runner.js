"use strict";
/**
 * Facade — DAG 启动 + abort
 *
 * 迁移自 src/lib/collaboration-runtime-service/index.ts（Story 9.38）
 * 职责：executeSession、startDag、abortSession
 *
 * 依赖：session-store、event-bus（eventEmitter）
 * import executeSupervisorDag 暂时从 engine/supervisor-dag（步骤 5 更新后）
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeSession = executeSession;
exports.startDag = startDag;
exports.abortSession = abortSession;
const path_1 = __importDefault(require("path"));
const blackboard_1 = require("../../../modules/collaboration-runtime/session/blackboard");
const fs_event_store_1 = require("../../../modules/collaboration-runtime/session/fs-event-store");
const sandbox_1 = require("../../../modules/collaboration-runtime/sandbox");
const session_store_1 = require("./session-store");
const event_bus_1 = require("./event-bus");
const hitl_dispatcher_1 = require("./hitl-dispatcher");
const paths_1 = require("../../../lib/paths");
const supervisor_dag_1 = require("../../../modules/collaboration-runtime/engine/supervisor-dag");
// 注入 hitl-dispatcher 需要的函数引用（避免循环依赖）
(0, hitl_dispatcher_1.setStartDag)(startDag);
(0, hitl_dispatcher_1.setResumeSupervisorHitl)(supervisor_dag_1.resumeSupervisorHitl);
async function executeSession(id) {
    await (0, session_store_1.loadPersistedSessions)();
    const session = session_store_1.sessions.get(id);
    if (!session) {
        throw new Error(`Session ${id} not found`);
    }
    // 确保 EventStore 和 Blackboard 存在（HMR 后内存丢失）
    let bb = session_store_1.blackboards.get(id);
    let store = session_store_1.eventStores.get(id);
    if (!bb || !store) {
        const sessionDir = path_1.default.join((0, paths_1.getDataRoot)(), "projects", session.projectId, "collaboration-sessions");
        store = new fs_event_store_1.FsEventStore(sessionDir);
        bb = new blackboard_1.Blackboard(id, path_1.default.join((0, paths_1.getDataRoot)(), "projects", session.projectId, "collaboration-sessions", id));
        session_store_1.blackboards.set(id, bb);
        session_store_1.eventStores.set(id, store);
    }
    // 无全局目标时进入欢迎模式：发出欢迎消息，等待用户输入目标
    if (!session.globalGoal) {
        session.status = "greeting";
        session.updatedAt = new Date().toISOString();
        await (0, session_store_1.saveProjectSessions)(session.projectId);
        const welcomeEvent = {
            id: `evt-welcome-${Date.now()}`,
            sessionId: id,
            seq: 0,
            type: "ASSISTANT_MESSAGE",
            payload: {
                content: "你好！我是多 Agent 协作系统的 Supervisor。请告诉我你想完成什么目标，我会负责分解任务并协调各 Agent 为你执行。",
            },
            source: "supervisor",
            timestamp: new Date().toISOString(),
        };
        // Await persistence before emitting so the welcome message is durable
        // before any renderer receives it.
        await store.append(welcomeEvent);
        event_bus_1.eventEmitter.emit(welcomeEvent);
        return { status: "greeting", result: null };
    }
    return startDag(session, store, id);
}
async function startDag(session, store, id) {
    session.status = "running";
    session.updatedAt = new Date().toISOString();
    await (0, session_store_1.saveProjectSessions)(session.projectId);
    const llmConfig = session.config.llmConfig;
    const credentialSource = llmConfig?.anthropicCredentialSource
        ?? (llmConfig?.anthropicAuthToken ? "anthropicAuthToken" : undefined)
        ?? (llmConfig?.anthropicApiKey ? "anthropicApiKey" : undefined)
        ?? (llmConfig?.authToken ? "authToken" : undefined)
        ?? (llmConfig?.apiKey ? "apiKey" : undefined);
    console.error(`[MultiAgentRuntime] facade.dag.start ${JSON.stringify({
        sessionId: id,
        projectId: session.projectId,
        goalChars: (session.globalGoal ?? "").length,
        timeoutMs: session.config.timeoutMs ?? "default",
        maxIterations: session.config.maxIterations ?? "default",
        llmConfig: llmConfig ? {
            provided: true,
            provider: llmConfig.provider ?? "default",
            model: llmConfig.model ?? "default",
            baseUrl: llmConfig.anthropicBaseUrl ?? llmConfig.baseUrl ?? "default",
            hasCredential: Boolean(llmConfig.anthropicAuthToken || llmConfig.anthropicApiKey || llmConfig.authToken || llmConfig.apiKey),
            credentialSource: credentialSource ?? "none",
            maxTokens: llmConfig.maxTokens ?? "default",
        } : { provided: false },
    })}`);
    // Supervisor 在后台运行，不阻塞 HTTP 请求（支持 HITL 长时间暂停）
    void (0, supervisor_dag_1.executeSupervisorDag)({
        projectId: session.projectId,
        globalGoal: session.globalGoal ?? "",
        sessionId: id,
        timeoutMs: session.config.timeoutMs,
        maxIterations: session.config.maxIterations,
        llmConfig: session.config.llmConfig,
    }, store, event_bus_1.eventEmitter).then(async () => {
        // DAG 完成后保持 "running" 状态 — supervisor 进程仍存活，用户可以继续发送消息触发新 DAG
        session.updatedAt = new Date().toISOString();
        await (0, session_store_1.saveProjectSessions)(session.projectId);
    }).catch(async (err) => {
        console.error(`[collaboration] executeSession ${id} failed:`, err);
        session.status = "aborted";
        session.updatedAt = new Date().toISOString();
        await (0, session_store_1.saveProjectSessions)(session.projectId);
    });
    return { status: "running", result: null };
}
// abortSession 通过集成层取消正在运行的 DAG
async function abortSession(id) {
    await (0, session_store_1.loadPersistedSessions)();
    const session = session_store_1.sessions.get(id);
    if (session) {
        session.status = "aborted";
        session.updatedAt = new Date().toISOString();
        await (0, session_store_1.saveProjectSessions)(session.projectId);
    }
    // Destroy all collaboration processes for this session
    const spawner = (0, sandbox_1.getGlobalSpawner)();
    try {
        await spawner.destroy(`supervisor-${id}`);
    }
    catch { /* already gone */ }
}
