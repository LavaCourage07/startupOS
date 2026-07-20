"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startLocalAgent = startLocalAgent;
exports.stopLocalAgent = stopLocalAgent;
exports.sendLocalAgentMessage = sendLocalAgentMessage;
exports.abortLocalAgent = abortLocalAgent;
exports.subscribeToLocalAgentEvents = subscribeToLocalAgentEvents;
const env_1 = require("./env");
const ipc_protocol_1 = require("./ipc-protocol");
async function startLocalAgent(config) {
    if (!(0, env_1.isElectron)()) {
        throw new Error('Local agent runtime is only available in Electron');
    }
    return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.AGENT_START, config);
}
async function stopLocalAgent(agentId) {
    if (!(0, env_1.isElectron)()) {
        return;
    }
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.AGENT_STOP, agentId);
}
async function sendLocalAgentMessage(agentId, message) {
    if (!(0, env_1.isElectron)()) {
        throw new Error('Local agent runtime is only available in Electron');
    }
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.AGENT_MESSAGE, { agentId, message });
}
async function abortLocalAgent(agentId) {
    if (!(0, env_1.isElectron)()) {
        return;
    }
    await (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.AGENT_ABORT, agentId);
}
function subscribeToLocalAgentEvents(listener) {
    if (!(0, env_1.isElectron)()) {
        return () => { };
    }
    return (0, env_1.getIpcRenderer)().on(ipc_protocol_1.IPC_CHANNELS.AGENT_EVENT, (payload) => {
        if (payload &&
            typeof payload === 'object' &&
            'agentId' in payload &&
            'sessionId' in payload &&
            'event' in payload) {
            listener(payload);
        }
    });
}
