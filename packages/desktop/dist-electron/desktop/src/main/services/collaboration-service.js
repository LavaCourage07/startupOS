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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationService = void 0;
const electron_1 = require("electron");
const ipc_protocol_1 = require("../ipc-protocol");
const event_bus_1 = require("../../../../core/src/modules/collaboration-runtime/facade/event-bus");
const user_config_1 = require("../../../../core/src/lib/features/user-config");
// Dynamic import wrapper — collaboration-runtime is a heavy module
let facade = null;
async function getFacade() {
    if (!facade) {
        facade = await Promise.resolve().then(() => __importStar(require('../../../../core/src/modules/collaboration-runtime/facade')));
    }
    return facade;
}
function summarizeRuntimeLLMConfig(config) {
    if (!config)
        return { provided: false };
    const credentialSource = config.anthropicCredentialSource
        ?? (config.anthropicAuthToken ? 'anthropicAuthToken' : undefined)
        ?? (config.anthropicApiKey ? 'anthropicApiKey' : undefined)
        ?? (config.authToken ? 'authToken' : undefined)
        ?? (config.apiKey ? 'apiKey' : undefined);
    return {
        provided: true,
        provider: config.provider ?? 'default',
        model: config.model ?? 'default',
        baseUrl: config.anthropicBaseUrl ?? config.baseUrl ?? 'default',
        hasCredential: Boolean(config.anthropicAuthToken || config.anthropicApiKey || config.authToken || config.apiKey),
        credentialSource: credentialSource ?? 'none',
        maxTokens: config.maxTokens ?? 'default',
    };
}
function logRuntime(phase, data) {
    console.error(`[MultiAgentRuntime] ${phase} ${JSON.stringify(data)}`);
}
class CollaborationService {
    constructor() {
        this.cleanupFn = null;
        this.registerHandlers();
        this.setupEventForwarding();
    }
    registerHandlers() {
        // ── Topology ──────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.COLLAB_TOPOLOGY_GET, async (_event, request) => {
            try {
                if (!request.projectId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'projectId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const f = await getFacade();
                const topology = await f.loadProjectTopology(request.projectId);
                if (!topology) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'No topology found for project' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: topology,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[CollaborationService] Get topology failed');
            }
        });
        // ── Session List ──────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.COLLAB_SESSION_LIST, async () => {
            try {
                const f = await getFacade();
                const sessions = await f.listSessions();
                return {
                    success: true,
                    data: sessions,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[CollaborationService] List sessions failed');
            }
        });
        // ── Session Create ────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.COLLAB_SESSION_CREATE, async (_event, request) => {
            try {
                const llmConfig = request['llmConfig'] && typeof request['llmConfig'] === 'object'
                    ? request['llmConfig']
                    : undefined;
                logRuntime('ipc.session.create.received', {
                    projectId: typeof request['projectId'] === 'string' ? request['projectId'] : 'unknown',
                    mode: typeof request['mode'] === 'string' ? request['mode'] : 'unknown',
                    hasGlobalGoal: typeof request['globalGoal'] === 'string' && request['globalGoal'].length > 0,
                    llmConfig: summarizeRuntimeLLMConfig(llmConfig),
                });
                const f = await getFacade();
                const session = await f.createSession(request);
                logRuntime('ipc.session.create.result', {
                    sessionId: session.id,
                    projectId: session.projectId,
                    status: session.status,
                    llmConfig: summarizeRuntimeLLMConfig(session.config.llmConfig),
                });
                return {
                    success: true,
                    data: session,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[CollaborationService] Create session failed');
            }
        });
        // ── Session Get ───────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.COLLAB_SESSION_GET, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const f = await getFacade();
                const session = await f.getSession(request.sessionId);
                if (!session) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const blackboard = await f.getBlackboardState(request.sessionId);
                return {
                    success: true,
                    data: { session, blackboard },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[CollaborationService] Get session failed');
            }
        });
        // ── Session Abort ─────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.COLLAB_SESSION_ABORT, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const f = await getFacade();
                await f.abortSession(request.sessionId);
                return {
                    success: true,
                    data: { status: 'aborted' },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[CollaborationService] Abort session failed');
            }
        });
        // ── Session Execute ───────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.COLLAB_SESSION_EXECUTE, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const f = await getFacade();
                const result = await f.executeSession(request.sessionId);
                return {
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[CollaborationService] Execute session failed');
            }
        });
        // ── Session Message ───────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.COLLAB_SESSION_MESSAGE_POST, async (_event, request) => {
            try {
                if (!request.sessionId || !request.message) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId and message are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const llmConfig = request.llmConfig && typeof request.llmConfig === 'object'
                    ? request.llmConfig
                    : undefined;
                logRuntime('ipc.message.received', {
                    sessionId: request.sessionId,
                    workerId: request.workerId ?? null,
                    messageChars: request.message.length,
                    llmConfig: summarizeRuntimeLLMConfig(llmConfig),
                });
                (0, user_config_1.persistRuntimeLLMConfig)(llmConfig);
                const f = await getFacade();
                const result = await f.sendMessageToSupervisor(request.sessionId, request.message, request.workerId, llmConfig);
                logRuntime('ipc.message.result', {
                    sessionId: request.sessionId,
                    success: result.success,
                    error: result.error ?? null,
                });
                if (!result.success) {
                    return {
                        success: false,
                        error: { code: 'MESSAGE_FAILED', message: result.error ?? 'Failed to send message' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: { success: true, to: 'supervisor' },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[CollaborationService] Send message failed');
            }
        });
        // ── Blackboard ────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.COLLAB_BLACKBOARD_GET, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const f = await getFacade();
                const state = await f.getBlackboardState(request.sessionId);
                if (!state) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: state,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[CollaborationService] Get blackboard failed');
            }
        });
        // ── Human Review (deprecated) ─────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.COLLAB_HUMAN_REVIEW, async (_event, request) => {
            try {
                if (!request.sessionId || !request.agentId || !request.response) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId, agentId, and response are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const f = await getFacade();
                const result = await f.respondToHumanReview(request.sessionId, request.agentId, request.response);
                if (!result.success) {
                    return {
                        success: false,
                        error: { code: 'REVIEW_FAILED', message: result.error ?? 'Failed to respond' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: { success: true, deprecated: 'Use POST /messages instead' },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[CollaborationService] Human review failed');
            }
        });
    }
    /**
     * Forward collaboration runtime events to all renderer windows via IPC.
     * Uses addElectronForwarder — synchronous registration, no race with executeSession.
     */
    setupEventForwarding() {
        this.cleanupFn = (0, event_bus_1.addElectronForwarder)((event) => {
            const data = JSON.stringify(event);
            for (const window of electron_1.BrowserWindow.getAllWindows()) {
                if (!window.isDestroyed()) {
                    window.webContents.send(ipc_protocol_1.IPC_CHANNELS.COLLAB_EVENT, data);
                }
            }
        });
    }
    dispose() {
        this.cleanupFn?.();
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
exports.CollaborationService = CollaborationService;
