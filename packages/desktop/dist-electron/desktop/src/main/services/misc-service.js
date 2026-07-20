"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiscService = void 0;
const electron_1 = require("electron");
const ipc_protocol_1 = require("../ipc-protocol");
const ontology_1 = require("../../../../core/src/lib/features/ontology");
const notification_system_1 = require("../../../../core/src/lib/integrations/pi-agent/notification-system");
const registry_1 = require("../../../../core/src/lib/features/services/launcher/registry");
const CultureSessionService_1 = require("../../../../core/src/lib/features/culture/services/CultureSessionService");
const CultureDetectionService_1 = require("../../../../core/src/lib/features/culture/services/CultureDetectionService");
const app_scanner_1 = require("../../../../core/src/lib/features/sandbox/app-scanner");
const user_config_1 = require("../../../../core/src/lib/features/user-config");
const native_notification_service_1 = require("./native-notification-service");
class MiscService {
    constructor() {
        this.registerHandlers();
    }
    registerHandlers() {
        // ── Interviews ──────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.INTERVIEW_LIST, async (_event, projectId) => {
            try {
                return {
                    success: true,
                    data: await ontology_1.interviewService.getProjectInterviews(projectId),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] List interviews failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.INTERVIEW_CREATE, async (_event, request) => {
            try {
                if (!request.projectId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'projectId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: await ontology_1.interviewService.createInterview(request.projectId, request.skipOptionalQuestions ?? false),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Create interview failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.INTERVIEW_GET, async (_event, interviewId) => {
            try {
                const interview = await ontology_1.interviewService.getInterview(interviewId);
                if (!interview) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Interview not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: interview,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Get interview failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.INTERVIEW_COMPLETE, async (_event, interviewId) => {
            try {
                return {
                    success: true,
                    data: await ontology_1.interviewService.completeInterview(interviewId),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Complete interview failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.INTERVIEW_ANSWER_SUBMIT, async (_event, _request) => {
            try {
                return {
                    success: true,
                    data: { submitted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Submit interview answer failed');
            }
        });
        // ── Notifications ───────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.NOTIFICATION_LIST, async (_event, filters) => {
            try {
                const manager = (0, notification_system_1.getNotificationManager)();
                return {
                    success: true,
                    data: await manager.listNotifications(filters || {}),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] List notifications failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.NOTIFICATION_UPDATE, async (_event, request) => {
            try {
                const manager = (0, notification_system_1.getNotificationManager)();
                const updated = await manager.updateNotificationStatus(request.id, request.updates.status);
                return {
                    success: true,
                    data: updated,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Update notification failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.NOTIFICATION_SHOW, async (_event, request) => {
            try {
                const title = typeof request.title === 'string' ? request.title.trim() : '';
                const body = typeof request.body === 'string' ? request.body.trim() : '';
                if (!title) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'title is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const result = await (0, native_notification_service_1.showNativeSystemNotification)({
                    title,
                    body,
                    silent: request.silent,
                    activationTarget: request.activationTarget,
                });
                return {
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Show notification failed');
            }
        });
        // ── Launch ──────────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.LAUNCH, async (_event, context) => {
            console.log('[IPC] LAUNCH', context);
            try {
                const launchContext = {
                    entryType: context.entryType,
                    entryId: context.entryId,
                    sessionId: context.sessionId,
                };
                const result = await (0, registry_1.launch)(launchContext);
                console.log('[IPC] LAUNCH result', {
                    success: result.success,
                    sessionId: result.sessionId,
                    baseDir: result.baseDir,
                    error: result.error,
                });
                return {
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Launch failed');
            }
        });
        // ── User Config ─────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.USER_CONFIG_GET, async () => {
            try {
                const config = (0, user_config_1.readUserConfigWithProductDefaults)();
                return { success: true, data: config, timestamp: new Date().toISOString() };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Get user config failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.USER_CONFIG_SET, async (_event, patch) => {
            try {
                const updated = (0, user_config_1.updateUserConfig)(patch);
                return { success: true, data: updated, timestamp: new Date().toISOString() };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Set user config failed');
            }
        });
        // ── Debug ───────────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.DEBUG_ENV, async () => {
            try {
                const envVars = {
                    ANTHROPIC_BASE_URL: process.env['ANTHROPIC_BASE_URL'],
                    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] ? process.env['ANTHROPIC_API_KEY'].substring(0, 10) + '...' : undefined,
                    ANTHROPIC_AUTH_TOKEN: process.env['ANTHROPIC_AUTH_TOKEN'] ? process.env['ANTHROPIC_AUTH_TOKEN'].substring(0, 10) + '...' : undefined,
                    ANTHROPIC_MODEL: process.env['ANTHROPIC_MODEL'],
                    LLM_PROVIDER: process.env['LLM_PROVIDER'],
                    OPENAI_BASE_URL: process.env['OPENAI_BASE_URL'],
                    OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ? process.env['OPENAI_API_KEY'].substring(0, 10) + '...' : undefined,
                    OPENAI_MODEL: process.env['OPENAI_MODEL'],
                };
                return {
                    success: true,
                    data: envVars,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Debug env failed');
            }
        });
        // ── Taste Detection ───────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.TASTE_DETECTION_START, async (_event, request) => {
            try {
                if (!request.userId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'userId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const validMaxTurns = Math.max(3, Math.min(5, request.maxTurns || 3));
                const sessionService = (0, CultureSessionService_1.getSessionService)();
                const session = await sessionService.createSession(request.userId, request.projectId, validMaxTurns);
                const firstQuestion = await sessionService.getFirstQuestion(session.sessionId);
                return {
                    success: true,
                    data: {
                        sessionId: session.sessionId,
                        userId: session.userId,
                        status: session.status,
                        currentTurn: session.currentTurn,
                        maxTurns: session.maxTurns,
                        firstQuestion,
                        createdAt: session.createdAt,
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Start taste detection failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.TASTE_DETECTION_MESSAGE, async (_event, request) => {
            try {
                if (!request.sessionId || !request.content) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId and content are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const sessionService = (0, CultureSessionService_1.getSessionService)();
                const session = await sessionService.getSession(request.sessionId);
                if (!session) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (session.status === 'completed') {
                    return {
                        success: false,
                        error: { code: 'SESSION_COMPLETED', message: 'Session already completed' },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (session.status === 'analyzing') {
                    return {
                        success: false,
                        error: { code: 'ANALYSIS_IN_PROGRESS', message: 'Session is analyzing' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const result = await sessionService.addMessage(request.sessionId, request.content, request.turn);
                return {
                    success: true,
                    data: {
                        sessionId: session.sessionId,
                        message: result.message,
                        role: 'assistant',
                        turn: result.turn,
                        isComplete: result.isComplete,
                        suggestedNextQuestion: result.nextQuestion,
                        nextAction: result.isComplete ? 'analyze' : 'continue',
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Taste detection message failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.TASTE_DETECTION_ANALYZE, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const sessionService = (0, CultureSessionService_1.getSessionService)();
                const session = await sessionService.getSession(request.sessionId);
                if (!session) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (!sessionService.isReadyForAnalysis(session) && !request.forceReanalyze) {
                    return {
                        success: false,
                        error: { code: 'SESSION_NOT_READY', message: 'Session not ready for analysis' },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (session.status === 'analyzing') {
                    return {
                        success: false,
                        error: { code: 'ANALYSIS_IN_PROGRESS', message: 'Analysis already in progress' },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (session.status === 'completed' && !request.forceReanalyze) {
                    return {
                        success: false,
                        error: { code: 'SESSION_ALREADY_COMPLETED', message: 'Session already analyzed' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const detectionService = (0, CultureDetectionService_1.getDetectionService)();
                const result = await detectionService.analyzeDialogue(request.sessionId);
                return {
                    success: true,
                    data: {
                        sessionId: session.sessionId,
                        analysisId: `analysis-${request.sessionId}-${Date.now()}`,
                        status: 'completed',
                        cultureLayer: result.cultureLayer,
                        confidence: result.confidence,
                        tasteDraftId: result.tasteDraftId,
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Taste detection analyze failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.TASTE_DETECTION_DRAFT, async (_event, request) => {
            try {
                if (!request.sessionId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const sessionService = (0, CultureSessionService_1.getSessionService)();
                const session = await sessionService.getSession(request.sessionId);
                if (!session) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Session not found' },
                        timestamp: new Date().toISOString(),
                    };
                }
                if (session.status !== 'completed') {
                    return {
                        success: false,
                        error: { code: 'ANALYSIS_NOT_COMPLETE', message: 'Analysis not yet completed' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const detectionService = (0, CultureDetectionService_1.getDetectionService)();
                const draft = await detectionService.getTasteDraft(request.sessionId);
                return {
                    success: true,
                    data: {
                        sessionId: session.sessionId,
                        userId: session.userId,
                        projectId: session.projectId,
                        draft: draft.tasteProfile,
                        isComplete: true,
                        generatedAt: draft.analysisCompletedAt,
                        confidence: draft.confidence,
                    },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] Taste detection draft failed');
            }
        });
        // ── Sandbox ───────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SANDBOX_APP_LIST, async () => {
            try {
                const apps = await (0, app_scanner_1.listSandboxApps)();
                return {
                    success: true,
                    data: { apps },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[MiscService] List sandbox apps failed');
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
exports.MiscService = MiscService;
