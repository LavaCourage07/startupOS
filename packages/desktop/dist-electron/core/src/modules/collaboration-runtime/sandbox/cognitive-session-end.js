"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flushCognitiveSessionEnd = flushCognitiveSessionEnd;
async function flushCognitiveSessionEnd(cognitiveManager, messages, label) {
    if (!cognitiveManager || typeof cognitiveManager.on_session_end !== 'function') {
        return;
    }
    try {
        await cognitiveManager.on_session_end(messages);
    }
    catch (err) {
        console.error(`[AgentWorker] ${label} cognitive on_session_end error:`, err);
    }
}
