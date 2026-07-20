"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillService = void 0;
const electron_1 = require("electron");
const ipc_protocol_1 = require("../ipc-protocol");
const skill_evolution_1 = require("../../../../core/src/lib/integrations/pi-agent/skill-evolution");
const service_1 = require("../../../../core/src/lib/features/skills/service");
class SkillService {
    constructor() {
        this.registerHandlers();
    }
    registerHandlers() {
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_LIST, async (_event, request = {}) => {
            try {
                return {
                    success: true,
                    data: (0, service_1.listSkills)(request),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[SkillService] List skills failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_REFRESH, async () => {
            try {
                return {
                    success: true,
                    data: (0, service_1.refreshSkills)(),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[SkillService] Refresh skills failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_CONTENT, async (_event, request) => {
            try {
                return {
                    success: true,
                    data: (0, service_1.getSkillContent)(request),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[SkillService] Get skill content failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_SESSION_LIST, async (_event, request) => {
            try {
                return {
                    success: true,
                    data: await (0, service_1.listSkillSessions)(request),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[SkillService] List skill sessions failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_EXECUTION_START, async (_event, request) => {
            try {
                const result = await (0, service_1.startSkillExecution)(request);
                return {
                    success: true,
                    data: result.data,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[SkillService] Start skill execution failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_EXECUTION_COMPLETE, async (_event, request) => {
            try {
                return {
                    success: true,
                    data: await (0, service_1.completeSkillExecution)(request),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[SkillService] Complete skill execution failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_EXECUTION_MESSAGE, async (_event, request) => {
            try {
                const result = await (0, service_1.sendSkillExecutionMessage)(request);
                return {
                    success: true,
                    data: result.data,
                    error: result.error,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[SkillService] Send skill execution message failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_EXECUTION_MESSAGE_STREAM, async (event, request) => {
            try {
                await (0, service_1.streamSkillExecutionMessage)(request, (streamEvent) => {
                    event.sender.send(ipc_protocol_1.IPC_CHANNELS.SKILL_EXECUTION_EVENT, {
                        ...streamEvent,
                        streamId: request.streamId,
                    });
                });
                return {
                    success: true,
                    data: { streamId: request.streamId },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                event.sender.send(ipc_protocol_1.IPC_CHANNELS.SKILL_EXECUTION_EVENT, {
                    streamId: request.streamId,
                    executionId: request.executionId,
                    type: 'error',
                    data: {
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                });
                return this.toErrorResponse(error, '[SkillService] Stream skill execution message failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_EXECUTION_TIMELINE, async (_event, request) => {
            try {
                return {
                    success: true,
                    data: await (0, service_1.getSkillExecutionTimeline)(request),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[SkillService] Get skill execution timeline failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.SKILL_EVOLUTION_RUN, async (_event, request) => {
            try {
                const result = await (0, skill_evolution_1.handleSkillEvolution)(request);
                return result.response;
            }
            catch (error) {
                console.error('[SkillService] Skill evolution failed:', error);
                return {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                    timestamp: new Date().toISOString(),
                };
            }
        });
    }
    toErrorResponse(error, logMessage) {
        console.error(logMessage, error);
        if (error instanceof service_1.SkillServiceError) {
            return {
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                },
                timestamp: new Date().toISOString(),
            };
        }
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
exports.SkillService = SkillService;
