"use strict";
/**
 * 工具模块入口
 * 导出工具注册功能和所有内置工具
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentToolsForScope = void 0;
exports.initializeBuiltInTools = initializeBuiltInTools;
exports.getToolSummary = getToolSummary;
__exportStar(require("./url-tools"), exports);
__exportStar(require("./registry"), exports);
__exportStar(require("./file-tools"), exports);
__exportStar(require("./ontology-tools"), exports);
__exportStar(require("./ontology-data-tools"), exports);
__exportStar(require("./system-tools"), exports);
__exportStar(require("./bash-tools"), exports);
__exportStar(require("./skill-tools"), exports);
__exportStar(require("./ask-user-question-tools"), exports);
__exportStar(require("./document-tools"), exports);
__exportStar(require("./schedule-tools"), exports);
__exportStar(require("./context"), exports);
const registry_1 = require("./registry");
const file_tools_1 = require("./file-tools");
const ontology_tools_1 = require("./ontology-tools");
const ontology_data_tools_1 = require("./ontology-data-tools");
const system_tools_1 = require("./system-tools");
const bash_tools_1 = require("./bash-tools");
const skill_tools_1 = require("./skill-tools");
const url_tools_1 = require("./url-tools");
const ask_user_question_tools_1 = require("./ask-user-question-tools");
const document_tools_1 = require("./document-tools");
const schedule_tools_1 = require("./schedule-tools");
// ============================================================================
// 初始化内置工具
// ============================================================================
/**
 * 注册所有内置工具
 *
 * @note 此函数需要在应用启动时显式调用
 * 不会在模块加载时自动执行，避免副作用
 */
let isInitialized = false;
function initializeBuiltInTools() {
    const t0 = Date.now();
    if (isInitialized) {
        console.error(`[ToolRegistry] initializeBuiltInTools skipped — already initialized (${Date.now() - t0}ms)`);
        return;
    }
    console.error(`[ToolRegistry] initializeBuiltInTools START`);
    const registry = (0, registry_1.getToolRegistry)();
    // 注册文件工具
    file_tools_1.fileTools.forEach(tool => (0, registry_1.registerTool)(tool));
    // 注册文档工具
    document_tools_1.documentTools.forEach(tool => (0, registry_1.registerTool)(tool));
    // 注册本体工具
    ontology_tools_1.ontologyTools.forEach(tool => (0, registry_1.registerTool)(tool));
    // 注册本体数据工具
    ontology_data_tools_1.ontologyDataTools.forEach(tool => (0, registry_1.registerTool)(tool));
    // 注册系统工具
    system_tools_1.systemTools.forEach(tool => (0, registry_1.registerTool)(tool));
    // 注册 Bash 工具
    bash_tools_1.bashTools.forEach(tool => (0, registry_1.registerTool)(tool));
    // 注册技能工具
    skill_tools_1.skillTools.forEach(tool => (0, registry_1.registerTool)(tool));
    // 注册 URL 工具
    url_tools_1.urlTools.forEach(tool => (0, registry_1.registerTool)(tool));
    // 注册 Ask User Question 工具
    ask_user_question_tools_1.askUserQuestionTools.forEach(tool => (0, registry_1.registerTool)(tool));
    // 注册定时任务工具
    schedule_tools_1.scheduleTools.forEach(tool => (0, registry_1.registerTool)(tool));
    const total = registry.getAll().length;
    const elapsed = Date.now() - t0;
    isInitialized = true;
    console.error(`[ToolRegistry] initializeBuiltInTools DONE — registered ${total} tools in ${elapsed}ms`);
}
/**
 * 获取工具列表摘要（用于日志或调试）
 */
function getToolSummary() {
    const registry = (0, registry_1.getToolRegistry)();
    return registry.getAll().map(tool => ({
        name: tool.name,
        category: tool.category,
        enabled: tool.enabled,
    }));
}
var registry_2 = require("./registry");
Object.defineProperty(exports, "getAgentToolsForScope", { enumerable: true, get: function () { return registry_2.getAgentToolsForScope; } });
