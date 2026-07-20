"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDisplayContent = extractDisplayContent;
function joinBlockTexts(content, type) {
    const text = content
        .filter((block) => !!block &&
        typeof block === 'object' &&
        block.type === type)
        .map((block) => {
        if (type === 'text') {
            return typeof block.text === 'string' ? block.text : '';
        }
        return typeof block.thinking === 'string' ? block.thinking : '';
    })
        .filter(Boolean)
        .join('');
    return type === 'text' ? stripThinkingMarkup(text) : text;
}
function stripThinkingMarkup(text) {
    return text
        .replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, '')
        .trim();
}
function extractDisplayContent(content, options = {}) {
    if (typeof content === 'string') {
        return stripThinkingMarkup(content);
    }
    if (!Array.isArray(content)) {
        return '';
    }
    const text = joinBlockTexts(content, 'text');
    if (text) {
        return text;
    }
    if (!options.allowThinkingFallback) {
        return '';
    }
    const thinkingBlocks = content.filter((block) => !!block &&
        typeof block === 'object' &&
        block.type === 'thinking');
    if (thinkingBlocks.length !== 1) {
        return '';
    }
    const thinkingBlock = thinkingBlocks[0];
    if (!thinkingBlock) {
        return '';
    }
    return typeof thinkingBlock.thinking === 'string'
        ? thinkingBlock.thinking
        : '';
}
