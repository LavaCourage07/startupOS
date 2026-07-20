"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRegistryService = void 0;
const electron_1 = require("electron");
const ipc_protocol_1 = require("../ipc-protocol");
const user_registry_1 = require("../../../../core/src/lib/features/user-registry");
class UserRegistryService {
    constructor() {
        this.registerHandlers();
    }
    registerHandlers() {
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.USER_AGENT_LIST, async () => {
            try {
                return {
                    success: true,
                    data: (0, user_registry_1.listUserAgents)(),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[UserRegistryService] List user agents failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.USER_AGENT_GET, async (_event, id) => {
            try {
                const agent = (0, user_registry_1.getUserAgent)(id);
                if (!agent) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: `User agent not found: ${id}` },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: agent,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[UserRegistryService] Get user agent failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.USER_SKILL_LIST, async () => {
            try {
                return {
                    success: true,
                    data: (0, user_registry_1.listUserSkills)(),
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[UserRegistryService] List user skills failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.USER_SKILL_GET, async (_event, id) => {
            try {
                const skill = (0, user_registry_1.getUserSkill)(id);
                if (!skill) {
                    return {
                        success: false,
                        error: { code: 'NOT_FOUND', message: `User skill not found: ${id}` },
                        timestamp: new Date().toISOString(),
                    };
                }
                return {
                    success: true,
                    data: skill,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[UserRegistryService] Get user skill failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.USER_AGENT_DELETE, async (_event, id) => {
            try {
                (0, user_registry_1.deleteUserAgent)(id);
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[UserRegistryService] Delete user agent failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.USER_SKILL_DELETE, async (_event, id) => {
            try {
                (0, user_registry_1.deleteUserSkill)(id);
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[UserRegistryService] Delete user skill failed');
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
exports.UserRegistryService = UserRegistryService;
