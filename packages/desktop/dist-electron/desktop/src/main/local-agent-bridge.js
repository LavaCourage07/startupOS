"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalAgentBridge = void 0;
const node_events_1 = require("node:events");
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("./paths");
const electron_1 = require("electron");
const ipc_protocol_1 = require("./ipc-protocol");
class LocalAgentBridge extends node_events_1.EventEmitter {
    constructor() {
        super();
        this.agents = new Map();
        this.registerIpcHandlers();
    }
    registerIpcHandlers() {
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_START, async (_event, config) => {
            return this.startAgent(config);
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_STOP, async (_event, agentId) => {
            await this.stopAgent(agentId);
            return true;
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_MESSAGE, async (_event, payload) => {
            await this.sendMessage(payload.agentId, payload.message);
            return true;
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.AGENT_ABORT, async (_event, agentId) => {
            await this.abortAgent(agentId);
            return true;
        });
    }
    async startAgent(config) {
        const existing = this.agents.get(config.agentId);
        if (existing) {
            return config.agentId;
        }
        const workerPath = node_path_1.default.join((0, paths_1.getMonorepoRoot)(), 'src/modules/collaboration-runtime/sandbox/agent-worker.mts');
        const child = (0, node_child_process_1.spawn)(process.execPath, ['--import', 'tsx', workerPath], {
            cwd: (0, paths_1.getMonorepoRoot)(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NODE_OPTIONS: process.env['NODE_OPTIONS'],
            },
        });
        const state = {
            config,
            process: child,
            buffer: '',
        };
        child.stdout.on('data', (chunk) => {
            this.handleWorkerOutput(config.agentId, chunk.toString('utf-8'));
        });
        child.stderr.on('data', (chunk) => {
            console.error(`[LocalAgentBridge:${config.agentId}]`, chunk.toString('utf-8'));
        });
        child.on('exit', (code) => {
            this.agents.delete(config.agentId);
            this.notifyRenderer(ipc_protocol_1.IPC_CHANNELS.AGENT_EXIT, {
                agentId: config.agentId,
                sessionId: config.sessionId,
                code,
            });
        });
        this.agents.set(config.agentId, state);
        this.sendCommand(config.agentId, {
            type: 'initialize',
            config: {
                projectId: config.projectId,
                agentId: config.agentId,
                workingDirectory: config.workingDirectory,
                agentType: config.agentType ?? 'originos',
                systemPrompt: config.systemPrompt,
            },
        });
        return config.agentId;
    }
    async stopAgent(agentId) {
        if (!this.agents.has(agentId)) {
            return;
        }
        this.sendCommand(agentId, { type: 'shutdown' });
        setTimeout(() => {
            this.agents.get(agentId)?.process.kill('SIGKILL');
        }, 3000);
    }
    async abortAgent(agentId) {
        if (!this.agents.has(agentId)) {
            return;
        }
        this.sendCommand(agentId, { type: 'abort' });
    }
    async sendMessage(agentId, message) {
        if (!this.agents.has(agentId)) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        this.sendCommand(agentId, { type: 'prompt', message });
    }
    sendCommand(agentId, command) {
        const state = this.agents.get(agentId);
        if (!state) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        state.process.stdin.write(`${JSON.stringify(command)}\n`);
    }
    handleWorkerOutput(agentId, chunk) {
        const state = this.agents.get(agentId);
        if (!state) {
            return;
        }
        state.buffer += chunk;
        const lines = state.buffer.split('\n');
        state.buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.trim()) {
                continue;
            }
            try {
                const message = JSON.parse(line);
                if (message.type === 'event') {
                    const envelope = {
                        agentId,
                        sessionId: state.config.sessionId,
                        event: message.event,
                    };
                    this.emit('agent:event', envelope);
                    this.notifyRenderer(ipc_protocol_1.IPC_CHANNELS.AGENT_EVENT, envelope);
                }
                else if (message.type === 'error') {
                    this.notifyRenderer(ipc_protocol_1.IPC_CHANNELS.AGENT_EVENT, {
                        agentId,
                        sessionId: state.config.sessionId,
                        event: {
                            type: 'agent_error',
                            error: {
                                message: message.message ?? 'Unknown agent worker error',
                            },
                        },
                    });
                }
            }
            catch (error) {
                console.error('[LocalAgentBridge] Failed to parse worker output:', error);
            }
        }
    }
    notifyRenderer(channel, payload) {
        for (const window of electron_1.BrowserWindow.getAllWindows()) {
            window.webContents.send(channel, payload);
        }
    }
    async shutdown() {
        await Promise.all(Array.from(this.agents.keys()).map((agentId) => this.stopAgent(agentId)));
        this.agents.clear();
    }
}
exports.LocalAgentBridge = LocalAgentBridge;
