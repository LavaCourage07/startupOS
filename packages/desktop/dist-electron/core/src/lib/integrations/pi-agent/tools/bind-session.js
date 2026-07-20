"use strict";
/**
 * Session-bound tool wrapping utility.
 *
 * Tools read execution context (workingDirectory, ...) from a
 * global ToolContextManager. The manager keeps both per-session contexts and a
 * shared `defaultContext` — and because tool.execute has no sessionId in its
 * signature, every tool implementation reads from `defaultContext`.
 *
 * Multiple agent runtimes (AgentManager, PersistentAgentManager, ...) share
 * the same global manager, so the last writer to `defaultContext` wins. To
 * keep concurrent sessions isolated, we wrap each tool's execute closure to
 * refresh `defaultContext` from the session-specific context immediately
 * before delegating to the underlying implementation.
 *
 * This is the single source of truth for that wrapping behaviour — both
 * AgentManager and PersistentAgent must use it before calling agent.setTools().
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindToolsToSession = bindToolsToSession;
const context_1 = require("./context");
function bindToolsToSession(tools, sessionId) {
    return tools.map((tool) => ({
        ...tool,
        execute: (toolCallId, params, signal, onUpdate) => {
            const ctx = (0, context_1.getToolContext)(sessionId);
            (0, context_1.getToolContextManager)().setDefaultContext(ctx);
            return tool.execute(toolCallId, params, signal, onUpdate);
        },
    }));
}
