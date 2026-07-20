"use strict";
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
exports.AgentSessionService = void 0;
const electron_1 = require("electron");
const ipc_protocol_1 = require("../ipc-protocol");
const agent_1 = require("../../../../core/src/lib/features/agent");
const user_config_1 = require("../../../../core/src/lib/features/user-config");
const agent_manager_1 = require("../../../../core/src/lib/integrations/pi-agent/agent-manager");
const display_content_1 = require("../../../../core/src/lib/integrations/pi-agent/display-content");
const stream_dedupe_1 = require("../../../../core/src/lib/integrations/pi-agent/stream-dedupe");
const consolidator_1 = require("../../../../core/src/modules/memory-core/core/consolidator");
const paths_1 = require("../../../../core/src/lib/paths");
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
function extractTextContent(content) {
    return (0, display_content_1.extractDisplayContent)(content, { allowThinkingFallback: true });
}
function formatVisibleAgentError(error) {
    const raw = error instanceof Error ? error.message : String(error);
    const compact = raw.replace(/\s+/g, ' ').trim();
    const jsonStart = compact.indexOf('{');
    if (jsonStart >= 0) {
        try {
            const payload = JSON.parse(compact.slice(jsonStart));
            const providerError = payload.error;
            const parts = [
                providerError?.code,
                providerError?.type,
                providerError?.message,
                payload.request_id ? `request_id=${payload.request_id}` : undefined,
            ].filter((part) => Boolean(part));
            if (parts.length > 0) {
                return `LLM 请求失败：${parts.join(' · ')}`;
            }
        }
        catch {
            // Fall through to compact text.
        }
    }
    return `LLM 请求失败：${compact || 'Unknown error'}`;
}
const ENTRY_TYPE_DIRS = {
    project: 'projects',
    solution: 'projects',
    agent: 'agents',
    'role-agent': 'agents',
    skill: 'skills',
};
class AgentSessionService {
    constructor() {
        this.registerHandlers();
    }
    registerHandlers() {
        // ── Session List ──────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_LIST, async (_event, request) => {
            console.log('[IPC] AGENT_SESSION_LIST', request);
            try {
                const sessions = await agent_1.agentSessionService.listSessions(request?.projectId);
                return {
                    success: true,
                    data: { sessions, count: sessions.length },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] List sessions failed');
            }
        });
        // ── Session Create ────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_CREATE, async (_event, request) => {
            console.log('[IPC] AGENT_SESSION_CREATE', {
                projectId: request.projectId,
                projectName: request.projectName,
                agentType: request.agentType,
                agentBaseDir: request.agentBaseDir,
                outputDir: request.outputDir,
                sessionId: request.sessionId,
            });
            try {
                if (!request.projectId || !request.projectName) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'projectId and projectName are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                (0, user_config_1.persistRuntimeLLMConfig)(request.llmConfig);
                // If sessionId provided, check for existing session
                if (request.sessionId) {
                    const existing = await agent_1.agentSessionService.getSession(request.sessionId, request.projectId);
                    if (existing) {
                        const session = await agent_1.agentSessionService.updateSession(request.sessionId, {
                            ...(request.llmConfig ? { llmConfig: request.llmConfig } : {}),
                            ...(request.agentType ? { agentType: request.agentType } : {}),
                            projectContext: {
                                ...request.projectContext,
                                ...(request.agentBaseDir ? { currentPath: request.agentBaseDir } : {}),
                                ...(request.outputDir ? { outputDir: request.outputDir } : {}),
                            },
                        }, request.projectId) ?? existing;
                        return {
                            success: true,
                            data: session,
                            timestamp: new Date().toISOString(),
                        };
                    }
                }
                // Ensure agentBaseDir exists
                if (request.agentBaseDir) {
                    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
                    fs.mkdirSync(request.agentBaseDir, { recursive: true });
                }
                const createRequest = {
                    projectId: request.projectId,
                    projectName: request.projectName,
                    systemPrompt: request.systemPrompt,
                    agentType: request.agentType,
                    projectContext: {
                        ...request.projectContext,
                        ...(request.agentBaseDir ? { currentPath: request.agentBaseDir } : {}),
                        ...(request.outputDir ? { outputDir: request.outputDir } : {}),
                    },
                    sessionId: request.sessionId,
                    llmConfig: request.llmConfig,
                };
                const session = await agent_1.agentSessionService.createSession(createRequest);
                return {
                    success: true,
                    data: session,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Create session failed');
            }
        });
        // ── Session Get ───────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_GET, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const session = await agent_1.agentSessionService.getSession(request.sessionId, request.projectId);
                if (!session) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: session,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Get session failed');
            }
        });
        // ── Session Update ────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_UPDATE, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const session = await agent_1.agentSessionService.updateSession(request.sessionId, request.updates, request.projectId);
                if (!session) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: session,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Update session failed');
            }
        });
        // ── Session Delete ────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_DELETE, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const deleted = await agent_1.agentSessionService.deleteSession(request.sessionId);
                if (!deleted) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Delete session failed');
            }
        });
        // ── Session Destroy (runtime agent cleanup) ───────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_DESTROY, async (_event, request) => {
            try {
                // In-process mode: try direct removal by sessionId
                let removed = request.sessionId ? await agent_manager_1.agentManager.finalizeAndRemoveAgent(request.sessionId) : false;
                // Fallback: resolve projectId from session and try removing by projectId
                if (!removed && request.sessionId) {
                    const session = await agent_1.agentSessionService.getSession(request.sessionId);
                    if (session?.projectContext?.projectId) {
                        const actualProjectId = session.projectContext.projectId;
                        const stats = agent_manager_1.agentManager.getStats();
                        for (const entry of stats.sessions) {
                            const agentEntry = agent_manager_1.agentManager.agents.get(entry.sessionId);
                            if (agentEntry?.projectId === actualProjectId) {
                                await agent_manager_1.agentManager.finalizeAndRemoveAgent(entry.sessionId);
                                removed = true;
                                break;
                            }
                        }
                    }
                }
                // Fallback: try by projectId directly
                if (!removed && request.projectId) {
                    const stats = agent_manager_1.agentManager.getStats();
                    for (const entry of stats.sessions) {
                        const agentEntry = agent_manager_1.agentManager.agents.get(entry.sessionId);
                        if (agentEntry?.projectId === request.projectId) {
                            await agent_manager_1.agentManager.finalizeAndRemoveAgent(entry.sessionId);
                            removed = true;
                            break;
                        }
                    }
                }
                return {
                    success: true,
                    data: {
                        sessionId: request.sessionId ?? request.projectId ?? 'unknown',
                        agentDestroyed: removed,
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Destroy session failed');
            }
        });
        // ── Session Statistics ────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_STATISTICS, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const session = await agent_1.agentSessionService.getSession(request.sessionId);
                if (!session) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const statistics = await agent_1.agentSessionService.getProjectStatistics(session.projectContext.projectId);
                return {
                    success: true,
                    data: statistics,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Get statistics failed');
            }
        });
        // ── Session Summary ───────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_SUMMARY, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const summary = await agent_1.agentSessionService.getSessionSummary(request.sessionId);
                if (!summary) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: summary,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Get summary failed');
            }
        });
        // ── Session Message (non-streaming) ──────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_MESSAGE, async (_event, request) => {
            try {
                if (!request.sessionId || !request.content) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId and content are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const session = await agent_1.agentSessionService.getSession(request.sessionId, request.projectId);
                if (!session) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const updatedSession = await agent_1.agentSessionService.addMessage(request.sessionId, {
                    role: (request.role || 'user'),
                    content: request.content,
                }, request.projectId);
                if (!updatedSession) {
                    return {
                        success: false,
                        error: { code: 'INTERNAL_ERROR', message: 'Failed to add message' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const userMessage = updatedSession.messages[updatedSession.messages.length - 1];
                const agent = await agent_manager_1.agentManager.getOrCreateAgent(request.sessionId, session.projectContext.projectId, {
                    systemPrompt: session.systemPrompt || undefined,
                    agentType: session.agentType,
                    agentBaseDir: session.projectContext.currentPath,
                    outputDir: session.projectContext.outputDir,
                    llmConfig: session.llmConfig,
                });
                let assistantContent = '';
                let hasError = false;
                let errorMessage = '';
                const unsubscribe = agent.subscribe((event) => {
                    switch (event.type) {
                        case 'message_update': {
                            const asm = event['assistantMessageEvent'];
                            if (asm?.type === 'text_delta' && typeof asm.delta === 'string') {
                                assistantContent = (0, stream_dedupe_1.getVisibleStreamDelta)(assistantContent, asm.delta).content;
                            }
                            break;
                        }
                        case 'message_end': {
                            const msg = event['message'];
                            if (msg?.role === 'assistant' && msg.content) {
                                const extracted = extractTextContent(msg.content);
                                if (extracted)
                                    assistantContent = (0, stream_dedupe_1.reconcileFinalStreamContent)(assistantContent, extracted);
                            }
                            break;
                        }
                        case 'agent_end': {
                            const msg = event['message'];
                            if (msg?.role === 'assistant' && msg.content) {
                                const extracted = extractTextContent(msg.content);
                                if (extracted)
                                    assistantContent = (0, stream_dedupe_1.reconcileFinalStreamContent)(assistantContent, extracted);
                            }
                            const msgs = event['messages'];
                            if (msgs && Array.isArray(msgs)) {
                                const lastAssistant = [...msgs].reverse().find((m) => m?.role === 'assistant');
                                if (lastAssistant?.content) {
                                    const extracted = extractTextContent(lastAssistant.content);
                                    if (extracted)
                                        assistantContent = (0, stream_dedupe_1.reconcileFinalStreamContent)(assistantContent, extracted);
                                }
                            }
                            break;
                        }
                        case 'agent_error':
                            hasError = true;
                            errorMessage = event['error']?.message || 'Unknown error';
                            break;
                    }
                });
                try {
                    await agent.prompt(request.content);
                }
                catch (promptError) {
                    hasError = true;
                    errorMessage = promptError instanceof Error ? promptError.message : 'Failed to call LLM';
                }
                unsubscribe();
                if (!assistantContent) {
                    try {
                        const state = await agent.getSessionState();
                        const msgs = state.messages || [];
                        const last = msgs[msgs.length - 1];
                        if (last?.role === 'assistant' && last.content) {
                            assistantContent = extractTextContent(last.content);
                        }
                    }
                    catch { }
                    if (!assistantContent) {
                        assistantContent = hasError ? `[LLM Error: ${errorMessage}]` : 'No response generated';
                    }
                }
                const savedSession = await agent_1.agentSessionService.addMessage(request.sessionId, {
                    role: 'assistant',
                    content: assistantContent,
                }, request.projectId);
                const assistantMessage = savedSession?.messages[savedSession.messages.length - 1];
                return {
                    success: true,
                    data: { userMessage, assistantMessage },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Send message failed');
            }
        });
        // ── Session Message Stream ──────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_MESSAGE_STREAM, async (_event, request) => {
            console.log('[IPC] AGENT_SESSION_MESSAGE_STREAM', {
                sessionId: request.sessionId,
                content: request.content?.slice(0, 100),
                role: request.role,
                projectId: request.projectId,
            });
            try {
                if (!request.sessionId || !request.content) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId and content are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const session = await agent_1.agentSessionService.getSession(request.sessionId, request.projectId);
                if (!session) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                await agent_1.agentSessionService.addMessage(request.sessionId, {
                    role: (request.role || 'user'),
                    content: request.content,
                }, request.projectId);
                const agent = await agent_manager_1.agentManager.getOrCreateAgent(request.sessionId, session.projectContext.projectId, {
                    systemPrompt: session.systemPrompt || undefined,
                    agentType: session.agentType,
                    agentBaseDir: session.projectContext.currentPath,
                    outputDir: session.projectContext.outputDir,
                    llmConfig: session.llmConfig,
                });
                // 批量发送缓冲区，减少 IPC 调用频率
                let eventBatch = [];
                let batchTimer = null;
                const BATCH_INTERVAL = 16; // ~60fps
                const flushBatch = () => {
                    if (eventBatch.length === 0)
                        return;
                    const batch = eventBatch;
                    eventBatch = [];
                    batchTimer = null;
                    const payload = JSON.stringify({
                        type: 'batch_events',
                        sessionId: request.sessionId,
                        streamId: request.streamId,
                        events: batch,
                    });
                    for (const win of electron_1.BrowserWindow.getAllWindows()) {
                        if (!win.isDestroyed()) {
                            win.webContents.send(ipc_protocol_1.IPC_CHANNELS.AGENT_EVENT, payload);
                        }
                    }
                };
                const sendToRenderer = (eventType, data) => {
                    // 立即发送关键事件，其他事件批量发送
                    if (eventType === 'done' || eventType === 'error' || eventType === 'assistant_message') {
                        flushBatch();
                        const payload = JSON.stringify({ type: eventType, sessionId: request.sessionId, streamId: request.streamId, data });
                        for (const win of electron_1.BrowserWindow.getAllWindows()) {
                            if (!win.isDestroyed()) {
                                win.webContents.send(ipc_protocol_1.IPC_CHANNELS.AGENT_EVENT, payload);
                            }
                        }
                    }
                    else {
                        eventBatch.push({ type: eventType, data });
                        if (!batchTimer) {
                            batchTimer = setTimeout(flushBatch, BATCH_INTERVAL);
                        }
                    }
                };
                let assistantContent = '';
                let assistantMessageSent = false;
                const unsubscribe = agent.subscribe((event) => {
                    switch (event.type) {
                        // In-process mode: library emits message_update with nested assistantMessageEvent
                        case 'message_update': {
                            const asm = event['assistantMessageEvent'];
                            if (asm?.type === 'text_delta' && typeof asm.delta === 'string') {
                                const merged = (0, stream_dedupe_1.getVisibleStreamDelta)(assistantContent, asm.delta);
                                assistantContent = merged.content;
                                if (merged.delta) {
                                    sendToRenderer('text_delta', { delta: merged.delta });
                                }
                            }
                            break;
                        }
                        case 'tool_execution_start':
                            sendToRenderer('tool_start', { toolName: event['toolName'] });
                            break;
                        case 'tool_execution_end':
                            sendToRenderer('tool_end', { toolName: event['toolName'] });
                            // 检测 write_file 写入解决方案文件，主动通知前端刷新
                            if (event['toolName'] === 'write_file') {
                                const result = event['result'];
                                const details = result?.['details'];
                                const filePath = details?.['filePath'] ?? '';
                                if (filePath.includes('solutions/') && filePath.includes('manifest.json')) {
                                    sendToRenderer('artifact_changed', {
                                        filename: filePath.split('/').pop() || filePath,
                                        filePath,
                                        artifactType: 'solution',
                                    });
                                }
                            }
                            break;
                        case 'message_end': {
                            const msg = event['message'];
                            if (msg?.role === 'assistant') {
                                const extracted = extractTextContent(msg.content);
                                if (extracted)
                                    assistantContent = (0, stream_dedupe_1.reconcileFinalStreamContent)(assistantContent, extracted);
                            }
                            if (assistantContent && !assistantMessageSent) {
                                sendToRenderer('assistant_message', { content: assistantContent });
                                assistantMessageSent = true;
                            }
                            break;
                        }
                        case 'agent_end': {
                            if (assistantMessageSent)
                                break;
                            const msg = event['message'];
                            if (msg?.role === 'assistant' && msg.content) {
                                const extracted = extractTextContent(msg.content);
                                if (extracted)
                                    assistantContent = (0, stream_dedupe_1.reconcileFinalStreamContent)(assistantContent, extracted);
                            }
                            const msgs = event['messages'];
                            if (msgs && Array.isArray(msgs)) {
                                const lastAssistant = [...msgs].reverse().find((m) => m?.role === 'assistant');
                                if (lastAssistant?.content) {
                                    const extracted = extractTextContent(lastAssistant.content);
                                    if (extracted)
                                        assistantContent = (0, stream_dedupe_1.reconcileFinalStreamContent)(assistantContent, extracted);
                                }
                            }
                            if (assistantContent) {
                                sendToRenderer('assistant_message', { content: assistantContent });
                                assistantMessageSent = true;
                            }
                            break;
                        }
                        case 'agent_error':
                            sendToRenderer('error', { message: event['error']?.message || 'Unknown error' });
                            break;
                    }
                });
                agent.prompt(request.content).then(async () => {
                    unsubscribe();
                    if (assistantContent) {
                        await agent_1.agentSessionService.addMessage(request.sessionId, {
                            role: 'assistant',
                            content: assistantContent,
                        }, request.projectId);
                    }
                    sendToRenderer('done', {});
                }).catch(async (err) => {
                    unsubscribe();
                    const visibleError = formatVisibleAgentError(err);
                    await agent_1.agentSessionService.addMessage(request.sessionId, {
                        role: 'assistant',
                        content: visibleError,
                    }, request.projectId);
                    sendToRenderer('assistant_message', { content: visibleError, isStreaming: false });
                    sendToRenderer('error', { message: visibleError });
                    sendToRenderer('agent_error', { message: visibleError });
                    sendToRenderer('done', {});
                });
                return {
                    success: true,
                    data: { started: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Stream message failed');
            }
        });
        // ── Session Abort ──────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_SESSION_ABORT, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                agent_manager_1.agentManager.removeAgent(request.sessionId);
                return {
                    success: true,
                    data: { aborted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Abort failed');
            }
        });
        // ── Agent Content Get ─────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_CONTENT_GET, async (_event, request) => {
            try {
                if (!request.agentId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'agentId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const dataAgentDir = path_1.default.join((0, paths_1.getDataRoot)(), 'agents', request.agentId);
                const dataAgentFilePath = path_1.default.join(dataAgentDir, 'Agent.md');
                const claudeAgentDir = path_1.default.join((0, paths_1.getClaudeDir)(), 'skills', request.agentId);
                const claudeAgentFilePath = path_1.default.join(claudeAgentDir, 'Agent.md');
                let agentDir;
                let agentFilePath;
                if ((0, fs_1.existsSync)(dataAgentFilePath)) {
                    agentDir = dataAgentDir;
                    agentFilePath = dataAgentFilePath;
                }
                else if ((0, fs_1.existsSync)(claudeAgentFilePath)) {
                    agentDir = claudeAgentDir;
                    agentFilePath = claudeAgentFilePath;
                }
                else {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: `Agent "${request.agentId}" not found` },
                        timestamp: new Date().toISOString(),
                    };
                }
                const content = (0, fs_1.readFileSync)(agentFilePath, 'utf-8');
                const outputDir = path_1.default.join((0, paths_1.getDataRoot)(), 'agents', request.agentId);
                return {
                    success: true,
                    data: { content, baseDir: agentDir, outputDir },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Get agent content failed');
            }
        });
        // ── Memory Consolidate ────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_MEMORY_CONSOLIDATE, async (_event, request) => {
            try {
                if (!request.entryType || !request.entryId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'entryType and entryId are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const baseDir = ENTRY_TYPE_DIRS[request.entryType];
                if (!baseDir) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: `Unknown entryType: ${request.entryType}` },
                        timestamp: new Date().toISOString(),
                    };
                }
                const agentDir = path_1.default.join((0, paths_1.getDataRoot)(), baseDir, request.entryId);
                const consolidator = new consolidator_1.MemoryConsolidator(agentDir);
                const result = await consolidator.consolidate();
                return {
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentSessionService] Memory consolidate failed');
            }
        });
    }
    toErrorResponse(error, logMessage) {
        console.error(logMessage, error);
        return {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            timestamp: new Date().toISOString(),
        };
    }
}
exports.AgentSessionService = AgentSessionService;
