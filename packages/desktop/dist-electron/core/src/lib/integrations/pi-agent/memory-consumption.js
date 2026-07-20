"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPromptMemorySections = buildPromptMemorySections;
exports.toStableMemoryExcerpt = toStableMemoryExcerpt;
exports.renderMemoryBlocksXML = renderMemoryBlocksXML;
function buildPromptMemorySections(options) {
    const coreMemorySection = options.memoryBlocks && options.memoryBlocks.length > 0
        ? `\n### Core Memory\n\n<memory_blocks>\nThe following memory blocks are currently engaged in your core memory unit:\n\n${renderMemoryBlocksXML(options.memoryBlocks)}\n</memory_blocks>`
        : '';
    const stableMemorySection = (!options.memoryBlocks || options.memoryBlocks.length === 0) && options.memoryMd
        ? `\n### ${options.stableMemoryHeading ?? 'Long-term Stable Memory'}\n\n${toStableMemoryExcerpt(options.memoryMd, options.maxStableMemoryChars ?? 4000)}`
        : '';
    const knowledgeSection = options.knowledgeMd
        ? `\n### ${options.knowledgeHeading ?? 'Knowledge Base Snapshot'}\n\n${options.knowledgeMd}`
        : '';
    const patternsSection = options.patternsMd
        ? `\n### ${options.patternsHeading ?? 'Experience Patterns Snapshot'}\n\n${options.patternsMd}`
        : '';
    return {
        coreMemorySection,
        stableMemorySection,
        knowledgeSection,
        patternsSection,
    };
}
function toStableMemoryExcerpt(memoryMd, maxChars) {
    const normalized = memoryMd.trim();
    if (!normalized)
        return '';
    const sections = normalized
        .split(/\n(?=##\s+)/)
        .map((section) => section.trim())
        .filter(Boolean);
    const preferredSection = sections.find((section) => section.startsWith('## 更新记忆'))
        ?? sections.find((section) => section.startsWith('## '))
        ?? normalized;
    if (preferredSection.length <= maxChars) {
        return preferredSection;
    }
    return `${preferredSection.slice(0, maxChars).trim()}\n\n[长期记忆摘要已截断，更多内容请通过 memory / read_file 按需读取]`;
}
function renderMemoryBlocksXML(blocks) {
    const lines = [];
    blocks.forEach((block, idx) => {
        const label = block.label || 'block';
        const value = block.value || '';
        const desc = block.description || '';
        const charsCurrent = value.length;
        const limit = block.limit || 0;
        lines.push(`<${label}>`);
        lines.push('<description>');
        lines.push(desc);
        lines.push('</description>');
        lines.push('<metadata>');
        if (block.readOnly)
            lines.push('- read_only=true');
        lines.push(`- chars_current=${charsCurrent}`);
        lines.push(`- chars_limit=${limit}`);
        lines.push('</metadata>');
        lines.push('<value>');
        lines.push(value);
        lines.push('</value>');
        lines.push(`</${label}>`);
        if (idx !== blocks.length - 1)
            lines.push('');
    });
    return lines.join('\n');
}
