"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressRecentTrace = compressRecentTrace;
const DEFAULT_MAX_HISTORY = 20;
const DEFAULT_KEEP_RECENT = 10;
const DEFAULT_PRESERVE_TRACE_COUNT = 6;
function isTraceMessage(message) {
    const role = String(message.role ?? '');
    return role === 'toolResult' || role === 'tool';
}
function isAssistantMessage(message) {
    return String(message.role ?? '') === 'assistant';
}
function isUserMessage(message) {
    return String(message.role ?? '') === 'user';
}
function compressRecentTrace(messages, options) {
    const maxHistory = options?.maxHistory ?? DEFAULT_MAX_HISTORY;
    const keepRecent = options?.keepRecent ?? DEFAULT_KEEP_RECENT;
    const preserveTraceCount = options?.preserveTraceCount ?? DEFAULT_PRESERVE_TRACE_COUNT;
    if (messages.length <= maxHistory) {
        return {
            messages,
            compressed: false,
            preservedTraceCount: 0,
        };
    }
    const preservedIndexes = new Set();
    const recentIndexes = new Set();
    // First preserve the most recent complete conversational turns.
    for (let i = messages.length - 1; i >= 0 && recentIndexes.size < keepRecent; i -= 1) {
        recentIndexes.add(i);
        if (isUserMessage(messages[i])) {
            continue;
        }
        const prev = i - 1;
        if (prev >= 0 && recentIndexes.size < keepRecent) {
            recentIndexes.add(prev);
        }
    }
    [...recentIndexes].sort((a, b) => a - b).forEach((index) => preservedIndexes.add(index));
    // Then preserve the most recent tool trace adjacent to those turns.
    const traceCandidateIndexes = messages
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => isTraceMessage(entry) || isAssistantMessage(entry));
    for (const candidate of traceCandidateIndexes.slice(-preserveTraceCount)) {
        preservedIndexes.add(candidate.index);
        const prev = candidate.index - 1;
        if (prev >= 0 && isUserMessage(messages[prev])) {
            preservedIndexes.add(prev);
        }
    }
    // Finally ensure we keep chronological order and cap by selecting preserved indexes only.
    const compressedMessages = messages.filter((_entry, index) => preservedIndexes.has(index));
    return {
        messages: compressedMessages,
        compressed: true,
        preservedTraceCount: Math.min(traceCandidateIndexes.length, preserveTraceCount),
    };
}
