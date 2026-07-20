"use strict";
/**
 * Core Memory Tools — Agent 编辑核心记忆的标准 API。
 *
 * Story M.5: core_memory_append, core_memory_replace, insert_memory_block, read_memory_block
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreMemoryTools = void 0;
const block_1 = require("../core/block");
class CoreMemoryTools {
    constructor(memory) {
        this.memory = memory;
    }
    async core_memory_append(label, content) {
        const block = this.memory.getBlock(label);
        if (!block)
            return `Error: Block '${label}' does not exist.`;
        if (block.readOnly)
            return `Error: Block '${label}' is read-only.`;
        const newValue = block.value + (block.value ? '\n' : '') + content;
        if (newValue.length > block.limit) {
            return `Error: Content exceeds block limit (${block.limit} chars). Current: ${block.value.length}, New: ${newValue.length}`;
        }
        this.memory.setBlock(label, newValue);
        return `Block '${label}' appended successfully.`;
    }
    async core_memory_replace(label, oldContent, newContent) {
        const block = this.memory.getBlock(label);
        if (!block)
            return `Error: Block '${label}' does not exist.`;
        if (block.readOnly)
            return `Error: Block '${label}' is read-only.`;
        if (!block.value.includes(oldContent)) {
            return `Error: Old content not found in block '${label}'.`;
        }
        const newValue = block.value.replace(oldContent, newContent);
        if (newValue.length > block.limit) {
            return `Error: Content exceeds block limit (${block.limit} chars).`;
        }
        this.memory.setBlock(label, newValue);
        return `Block '${label}' replaced successfully.`;
    }
    async insert_memory_block(label, value, description, limit) {
        if (this.memory.getBlock(label)) {
            return `Error: Block '${label}' already exists.`;
        }
        const def = {
            label,
            description: description ?? 'Agent-created block',
            limit: limit ?? 2000,
        };
        (0, block_1.createBlock)(def); // validate
        this.memory.createBlock(def, value);
        return `Block '${label}' created successfully.`;
    }
    async read_memory_block(label) {
        const block = this.memory.getBlock(label);
        if (!block)
            return `Error: Block '${label}' does not exist.`;
        return block.value;
    }
}
exports.CoreMemoryTools = CoreMemoryTools;
