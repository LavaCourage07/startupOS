"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentProjectService = void 0;
const electron_1 = require("electron");
const ipc_protocol_1 = require("../ipc-protocol");
const persistent_agent_manager_1 = require("../../../../core/src/lib/integrations/pi-agent/persistent-agent-manager");
const display_content_1 = require("../../../../core/src/lib/integrations/pi-agent/display-content");
const stream_dedupe_1 = require("../../../../core/src/lib/integrations/pi-agent/stream-dedupe");
const user_config_1 = require("../../../../core/src/lib/features/user-config");
const SYSTEM_TRIGGER_GREETING = '__SYSTEM_TRIGGER_GREETING__';
const SYSTEM_GREETING_PROMPT = `系统启动触发: 请按照你的工作模式中的"启动时状态判断"流程，读取 output/business-model.json 判断当前项目状态，并生成相应的问候语。如果文件不存在，按照全新访谈流程开始；如果文件存在，进入模型审阅模式。`;
function extractTextContent(content) {
    return (0, display_content_1.extractDisplayContent)(content, { allowThinkingFallback: true });
}
function isToolCallOnlyContent(content) {
    const trimmed = content.trim();
    if (/".*name".*:.*"(read_file|write_file|list_directory|bash|file)/i.test(trimmed))
        return true;
    if (/tool_name\s*:/i.test(trimmed))
        return true;
    if (/[a-z_]+\s*\([^)]{0,200}\)/i.test(trimmed))
        return true;
    if (/[*`]*\s*[\(（]\s*(调用工具|Calling|Tool call)\s*[:：\s]/i.test(trimmed))
        return true;
    if (/\*\*工具\s*[:：\s]/i.test(trimmed))
        return true;
    if (/"status"\s*:/i.test(trimmed))
        return true;
    return false;
}
function stripToolCodeBlocks(content) {
    let result = content.replace(/```(?:json)?\s*\n([\s\S]*?)```/g, (match) => {
        return isToolCallOnlyContent(match) ? '' : match;
    });
    result = result.split('\n').filter(line => {
        const trimmed = line.trim();
        if (trimmed === '')
            return false;
        if (/[*`]*\s*[\(（]\s*(调用工具|Calling|Tool call)\s*[:：\s]/i.test(trimmed))
            return false;
        if (/\*\*工具\s*[:：\s]/i.test(trimmed))
            return false;
        if (/^\{?\s*"status"\s*:/i.test(trimmed))
            return false;
        if (isToolCallOnlyContent(trimmed))
            return false;
        return true;
    }).join('\n');
    result = result.replace(/[a-z_]+\s*\([^)]{0,200}\)/gi, '').trim();
    result = result.replace(/\n{3,}/g, '\n\n').trim();
    return result;
}
function sendToAllWindows(projectId, type, data) {
    const payload = JSON.stringify({ projectId, type, data });
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send(ipc_protocol_1.IPC_CHANNELS.AGENT_EVENT, payload);
        }
    }
}
class AgentProjectService {
    constructor() {
        this.registerHandlers();
    }
    registerHandlers() {
        // ── Project Agent Start ──────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_PROJECT_START, async (_event, request) => {
            try {
                if (!request.projectId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'projectId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                (0, user_config_1.persistRuntimeLLMConfig)(request.llmConfig);
                const agent = await persistent_agent_manager_1.persistentAgentManager.startAgent(request.projectId, request.llmConfig);
                return {
                    success: true,
                    data: { status: agent.getStatus() },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentProjectService] Start agent failed');
            }
        });
        // ── Project Agent Stop ───────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_PROJECT_STOP, async (_event, request) => {
            try {
                if (!request.projectId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'projectId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                await persistent_agent_manager_1.persistentAgentManager.stopAgent(request.projectId);
                return {
                    success: true,
                    data: { stopped: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentProjectService] Stop agent failed');
            }
        });
        // ── Project Agent Message (streaming via AGENT_EVENT) ────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_PROJECT_MESSAGE, async (_event, request) => {
            try {
                if (!request.projectId || !request.content) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'projectId and content are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                (0, user_config_1.persistRuntimeLLMConfig)(request.llmConfig);
                // Auto-start agent if not running
                let agent = persistent_agent_manager_1.persistentAgentManager.getAgent(request.projectId);
                if (!agent) {
                    console.log(`[AgentProjectService] Agent not running for ${request.projectId}, auto-starting...`);
                    agent = await persistent_agent_manager_1.persistentAgentManager.startAgent(request.projectId, request.llmConfig);
                }
                // System greeting substitution
                const actualContent = request.content === SYSTEM_TRIGGER_GREETING
                    ? SYSTEM_GREETING_PROMPT
                    : request.content;
                // Track accumulated text for final assistant_message
                let assistantContent = '';
                let assistantMessageSent = false;
                const unsubscribe = agent.subscribe((event) => {
                    switch (event.type) {
                        case 'message_update': {
                            const asm = event['assistantMessageEvent'];
                            if (asm?.type === 'text_delta' && typeof asm.delta === 'string') {
                                const merged = (0, stream_dedupe_1.getVisibleStreamDelta)(assistantContent, asm.delta);
                                assistantContent = merged.content;
                                if (merged.delta) {
                                    sendToAllWindows(request.projectId, 'text_delta', { delta: merged.delta });
                                }
                            }
                            break;
                        }
                        case 'tool_execution_start':
                            sendToAllWindows(request.projectId, 'tool_start', {
                                toolCallId: event['toolCallId'],
                                toolName: event['toolName'],
                                args: event['args'],
                            });
                            break;
                        case 'tool_execution_end':
                            sendToAllWindows(request.projectId, 'tool_end', {
                                toolCallId: event['toolCallId'],
                                toolName: event['toolName'],
                                result: event['result'],
                                isError: event['isError'],
                            });
                            // 检测 write_file 写入业务模型文件，主动通知前端刷新
                            if (event['toolName'] === 'write_file' && !event['isError']) {
                                const result = event['result'];
                                const details = result?.['details'];
                                const filePath = details?.['filePath'] ?? '';
                                if (filePath.includes('business-model.json') || filePath.includes('interview-progress.md')) {
                                    sendToAllWindows(request.projectId, 'artifact_changed', {
                                        filename: filePath.split('/').pop() || filePath,
                                        filePath,
                                    });
                                }
                            }
                            break;
                        case 'message_end': {
                            if (assistantMessageSent)
                                break;
                            const msg = event['message'];
                            if (msg?.role === 'assistant') {
                                const extracted = (0, stream_dedupe_1.reconcileFinalStreamContent)(assistantContent, extractTextContent(msg.content));
                                if (extracted) {
                                    const stripped = stripToolCodeBlocks(extracted);
                                    if (stripped) {
                                        assistantContent = stripped;
                                        sendToAllWindows(request.projectId, 'assistant_message', { content: stripped, isStreaming: false });
                                        assistantMessageSent = true;
                                    }
                                }
                            }
                            break;
                        }
                        case 'agent_error':
                            sendToAllWindows(request.projectId, 'error', {
                                message: event['error']?.message || 'Unknown error',
                            });
                            break;
                    }
                });
                // Fire-and-forget: start processing, broadcast events, then signal done
                agent.handleMessage(actualContent, request.sessionId).then(() => {
                    unsubscribe();
                    if (!assistantMessageSent && assistantContent) {
                        const stripped = stripToolCodeBlocks(assistantContent);
                        if (stripped) {
                            sendToAllWindows(request.projectId, 'assistant_message', { content: stripped, isStreaming: false });
                        }
                    }
                    sendToAllWindows(request.projectId, 'done', null);
                }).catch((err) => {
                    unsubscribe();
                    sendToAllWindows(request.projectId, 'error', {
                        message: err instanceof Error ? err.message : 'Message processing failed',
                    });
                });
                return {
                    success: true,
                    data: { started: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentProjectService] Send message failed');
            }
        });
        // ── Project Agent Abort ──────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_PROJECT_ABORT, async (_event, request) => {
            try {
                if (!request.projectId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'projectId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const agent = persistent_agent_manager_1.persistentAgentManager.getAgent(request.projectId);
                if (agent) {
                    agent.abort();
                }
                return {
                    success: true,
                    data: { aborted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[AgentProjectService] Abort failed');
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
exports.AgentProjectService = AgentProjectService;
