"use strict";
/**
 * Memory Core — 统一导出。
 *
 * Epic M: Memory Core 记忆核心
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryAdapter = exports.migratePatternsToArchival = exports.ingestReflectionToArchival = exports.ingestPatternToArchival = exports.extractPrincipleFromToolResults = exports.EnhancedPatternProvider = exports.MemoryProvider = exports.ArchivalMemoryTools = exports.CoreMemoryTools = exports.HistoryStore = exports.RecallMemory = exports.HNSWIndex = exports.zeros = exports.normalizeVector = exports.dequantizeFloat32 = exports.quantizeInt8 = exports.cosineSimilarity = exports.embeddingEngine = exports.ArchivalMemory = exports.MemoryConsolidator = exports.MemoryCore = exports.Memory = exports.deserializeBlock = exports.serializeBlock = exports.fromLegacyBlock = exports.toLegacyBlock = exports.validateBlock = exports.createBlock = exports.DEFAULT_BLOCKS = void 0;
var block_1 = require("./core/block");
Object.defineProperty(exports, "DEFAULT_BLOCKS", { enumerable: true, get: function () { return block_1.DEFAULT_BLOCKS; } });
Object.defineProperty(exports, "createBlock", { enumerable: true, get: function () { return block_1.createBlock; } });
Object.defineProperty(exports, "validateBlock", { enumerable: true, get: function () { return block_1.validateBlock; } });
Object.defineProperty(exports, "toLegacyBlock", { enumerable: true, get: function () { return block_1.toLegacyBlock; } });
Object.defineProperty(exports, "fromLegacyBlock", { enumerable: true, get: function () { return block_1.fromLegacyBlock; } });
Object.defineProperty(exports, "serializeBlock", { enumerable: true, get: function () { return block_1.serializeBlock; } });
Object.defineProperty(exports, "deserializeBlock", { enumerable: true, get: function () { return block_1.deserializeBlock; } });
var memory_1 = require("./core/memory");
Object.defineProperty(exports, "Memory", { enumerable: true, get: function () { return memory_1.Memory; } });
var memory_core_1 = require("./core/memory-core");
Object.defineProperty(exports, "MemoryCore", { enumerable: true, get: function () { return memory_core_1.MemoryCore; } });
var consolidator_1 = require("./core/consolidator");
Object.defineProperty(exports, "MemoryConsolidator", { enumerable: true, get: function () { return consolidator_1.MemoryConsolidator; } });
// Archival
var archival_memory_1 = require("./archival/archival-memory");
Object.defineProperty(exports, "ArchivalMemory", { enumerable: true, get: function () { return archival_memory_1.ArchivalMemory; } });
var embedding_1 = require("./archival/embedding");
Object.defineProperty(exports, "embeddingEngine", { enumerable: true, get: function () { return embedding_1.embeddingEngine; } });
Object.defineProperty(exports, "cosineSimilarity", { enumerable: true, get: function () { return embedding_1.cosineSimilarity; } });
Object.defineProperty(exports, "quantizeInt8", { enumerable: true, get: function () { return embedding_1.quantizeInt8; } });
Object.defineProperty(exports, "dequantizeFloat32", { enumerable: true, get: function () { return embedding_1.dequantizeFloat32; } });
Object.defineProperty(exports, "normalizeVector", { enumerable: true, get: function () { return embedding_1.normalizeVector; } });
Object.defineProperty(exports, "zeros", { enumerable: true, get: function () { return embedding_1.zeros; } });
var hnsw_index_1 = require("./archival/hnsw-index");
Object.defineProperty(exports, "HNSWIndex", { enumerable: true, get: function () { return hnsw_index_1.HNSWIndex; } });
// Recall
var recall_memory_1 = require("./recall/recall-memory");
Object.defineProperty(exports, "RecallMemory", { enumerable: true, get: function () { return recall_memory_1.RecallMemory; } });
var history_store_1 = require("./recall/history-store");
Object.defineProperty(exports, "HistoryStore", { enumerable: true, get: function () { return history_store_1.HistoryStore; } });
// Tools
var core_memory_tools_1 = require("./tools/core-memory-tools");
Object.defineProperty(exports, "CoreMemoryTools", { enumerable: true, get: function () { return core_memory_tools_1.CoreMemoryTools; } });
var archival_memory_tools_1 = require("./tools/archival-memory-tools");
Object.defineProperty(exports, "ArchivalMemoryTools", { enumerable: true, get: function () { return archival_memory_tools_1.ArchivalMemoryTools; } });
// Session / Provider
var memory_provider_1 = require("./session/memory-provider");
Object.defineProperty(exports, "MemoryProvider", { enumerable: true, get: function () { return memory_provider_1.MemoryProvider; } });
var enhanced_pattern_provider_1 = require("./session/enhanced-pattern-provider");
Object.defineProperty(exports, "EnhancedPatternProvider", { enumerable: true, get: function () { return enhanced_pattern_provider_1.EnhancedPatternProvider; } });
// Pattern Ingest (M.7)
var pattern_ingest_1 = require("./archival/pattern-ingest");
Object.defineProperty(exports, "extractPrincipleFromToolResults", { enumerable: true, get: function () { return pattern_ingest_1.extractPrincipleFromToolResults; } });
Object.defineProperty(exports, "ingestPatternToArchival", { enumerable: true, get: function () { return pattern_ingest_1.ingestPatternToArchival; } });
Object.defineProperty(exports, "ingestReflectionToArchival", { enumerable: true, get: function () { return pattern_ingest_1.ingestReflectionToArchival; } });
Object.defineProperty(exports, "migratePatternsToArchival", { enumerable: true, get: function () { return pattern_ingest_1.migratePatternsToArchival; } });
// Adapter
var adapter_1 = require("./adapter");
Object.defineProperty(exports, "MemoryAdapter", { enumerable: true, get: function () { return adapter_1.MemoryAdapter; } });
