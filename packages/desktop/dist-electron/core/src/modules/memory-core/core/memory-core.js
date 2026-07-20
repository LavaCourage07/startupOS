"use strict";
/**
 * MemoryCore — 三层记忆统一门面。
 *
 * Story M.6: 一个类管理 Core + Archival + Recall 三层记忆。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryCore = void 0;
const memory_1 = require("../core/memory");
const archival_memory_1 = require("../archival/archival-memory");
const recall_memory_1 = require("../recall/recall-memory");
const core_memory_tools_1 = require("../tools/core-memory-tools");
const archival_memory_tools_1 = require("../tools/archival-memory-tools");
class MemoryCore {
    constructor(agentDir, sessionId = 'default', definitions) {
        this.agentDir = agentDir;
        this.memory = new memory_1.Memory(agentDir, definitions);
        this.archival = new archival_memory_1.ArchivalMemory(agentDir);
        this.recall = new recall_memory_1.RecallMemory(agentDir, sessionId);
        this.coreTools = new core_memory_tools_1.CoreMemoryTools(this.memory);
        this.archivalTools = new archival_memory_tools_1.ArchivalMemoryTools(this.archival);
    }
    async initialize() {
        // Archival and Recall already load in constructor
    }
    async shutdown() {
        await Promise.all([
            this.memory.save(),
            this.archival.persist(),
        ]);
    }
}
exports.MemoryCore = MemoryCore;
