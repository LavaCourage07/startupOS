"use strict";
/**
 * Archival Memory Tools — Agent 写入/搜索长期记忆。
 *
 * Story M.5: archival_memory_insert, archival_memory_search
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchivalMemoryTools = void 0;
class ArchivalMemoryTools {
    constructor(archival) {
        this.archival = archival;
    }
    async archival_memory_insert(text, tags) {
        const id = await this.archival.insert(text, tags);
        return `Archival memory saved (id: ${id}).`;
    }
    async archival_memory_search(query, limit = 5, options) {
        const results = await this.archival.search(query, { limit, ...options });
        if (results.length === 0)
            return 'No relevant memories found.';
        const lines = [`Found ${results.length} relevant memories:`];
        for (const r of results) {
            lines.push(`- [score: ${r.score.toFixed(2)}] ${r.text}`);
        }
        return lines.join('\n');
    }
}
exports.ArchivalMemoryTools = ArchivalMemoryTools;
