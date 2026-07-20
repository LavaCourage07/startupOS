"use strict";
/**
 * 认知系统模块（Epic C）统一导出
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUpdateBlockTask = exports.createPatternTask = exports.createKnowledgeTask = exports.createConsolidateTask = exports.SleepComputeScheduler = exports.DEFAULT_BLOCKS = exports.RuleEngine = exports.UnifiedOntology = exports.PatternProvider = exports.KnowledgeIngest = exports.KnowledgeProvider = exports.PracticeLogger = exports.CognitiveManager = void 0;
var manager_1 = require("./manager");
Object.defineProperty(exports, "CognitiveManager", { enumerable: true, get: function () { return manager_1.CognitiveManager; } });
var practice_logger_1 = require("./practice-logger");
Object.defineProperty(exports, "PracticeLogger", { enumerable: true, get: function () { return practice_logger_1.PracticeLogger; } });
var knowledge_provider_1 = require("./knowledge-provider");
Object.defineProperty(exports, "KnowledgeProvider", { enumerable: true, get: function () { return knowledge_provider_1.KnowledgeProvider; } });
var knowledge_ingest_1 = require("./knowledge-ingest");
Object.defineProperty(exports, "KnowledgeIngest", { enumerable: true, get: function () { return knowledge_ingest_1.KnowledgeIngest; } });
var index_1 = require("./pattern/index");
Object.defineProperty(exports, "PatternProvider", { enumerable: true, get: function () { return index_1.PatternProvider; } });
var unified_ontology_1 = require("./unified-ontology");
Object.defineProperty(exports, "UnifiedOntology", { enumerable: true, get: function () { return unified_ontology_1.UnifiedOntology; } });
var rule_engine_1 = require("./rule-engine");
Object.defineProperty(exports, "RuleEngine", { enumerable: true, get: function () { return rule_engine_1.RuleEngine; } });
var types_1 = require("./types");
Object.defineProperty(exports, "DEFAULT_BLOCKS", { enumerable: true, get: function () { return types_1.DEFAULT_BLOCKS; } });
var sleep_compute_1 = require("./sleep-compute");
Object.defineProperty(exports, "SleepComputeScheduler", { enumerable: true, get: function () { return sleep_compute_1.SleepComputeScheduler; } });
Object.defineProperty(exports, "createConsolidateTask", { enumerable: true, get: function () { return sleep_compute_1.createConsolidateTask; } });
Object.defineProperty(exports, "createKnowledgeTask", { enumerable: true, get: function () { return sleep_compute_1.createKnowledgeTask; } });
Object.defineProperty(exports, "createPatternTask", { enumerable: true, get: function () { return sleep_compute_1.createPatternTask; } });
Object.defineProperty(exports, "createUpdateBlockTask", { enumerable: true, get: function () { return sleep_compute_1.createUpdateBlockTask; } });
