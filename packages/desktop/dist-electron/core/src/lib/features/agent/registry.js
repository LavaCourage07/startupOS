"use strict";
/**
 * OS.3: Agent Registry Helper Functions
 * Utilities for working with the agent registry and Dock integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentErrorCodes = exports.AgentRegistryError = void 0;
exports.agentsToDockApps = agentsToDockApps;
exports.isValidAgent = isValidAgent;
const agent_object_1 = require("../../../types/agent-object");
/**
 * Convert agents to Dock apps format
 * Used to sync agents from the registry to the Dock
 */
function agentsToDockApps(agents) {
    return agents.map((agent, index) => ({
        id: agent.id,
        name: agent.displayName,
        icon: agent.icon,
        iconType: 'emoji',
        isRunning: agent.status === agent_object_1.AgentStatus.RUNNING,
        isPinned: true,
        index,
    }));
}
/**
 * Validate an AgentObject - ensures all required fields are present
 */
function isValidAgent(agent) {
    if (typeof agent !== 'object' ||
        agent === null) {
        return false;
    }
    const obj = agent;
    return (typeof obj['id'] === 'string' &&
        typeof obj['name'] === 'string' &&
        typeof obj['displayName'] === 'string' &&
        typeof obj['status'] === 'string' &&
        typeof obj['icon'] === 'string' &&
        typeof obj['color'] === 'string' &&
        Array.isArray(obj['capabilities']) &&
        typeof obj['createdAt'] === 'number' &&
        typeof obj['lastActivatedAt'] === 'number');
}
/**
 * Agent registry error class
 */
class AgentRegistryError extends Error {
    constructor(message, code, agentId) {
        super(message);
        this.code = code;
        this.agentId = agentId;
        this.name = 'AgentRegistryError';
    }
}
exports.AgentRegistryError = AgentRegistryError;
/**
 * Common error codes
 */
exports.AgentErrorCodes = {
    AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
    INVALID_AGENT: 'INVALID_AGENT',
    INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
    DUPLICATE_AGENT: 'DUPLICATE_AGENT',
    REGISTRY_ERROR: 'REGISTRY_ERROR',
};
