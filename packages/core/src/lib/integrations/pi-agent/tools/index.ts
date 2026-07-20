/**
 * 工具模块入口
 * 导出工具注册功能和所有内置工具
 */

export * from "./url-tools";
export * from "./registry";
export * from "./file-tools";
export * from "./ontology-tools";
export * from "./ontology-data-tools";
export * from "./system-tools";
export * from "./bash-tools";
export * from "./skill-tools";
export * from "./ask-user-question-tools";
export * from "./document-tools";
export * from "./schedule-tools";
export * from "./context";

import {registerTool, getToolRegistry} from "./registry";
import {fileTools} from "./file-tools";
import {ontologyTools} from "./ontology-tools";
import {ontologyDataTools} from "./ontology-data-tools";
import {systemTools} from "./system-tools";
import {bashTools} from "./bash-tools";
import {skillTools} from "./skill-tools";
import {urlTools} from "./url-tools";
import {askUserQuestionTools} from "./ask-user-question-tools";
import {documentTools} from "./document-tools";
import {scheduleTools} from "./schedule-tools";

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

export function initializeBuiltInTools(): void {
	const t0 = Date.now();

	if (isInitialized) {
		console.error(`[ToolRegistry] initializeBuiltInTools skipped — already initialized (${Date.now() - t0}ms)`);
		return;
	}

	console.error(`[ToolRegistry] initializeBuiltInTools START`);
	const registry = getToolRegistry();

	// 注册文件工具
	fileTools.forEach(tool => registerTool(tool));

	// 注册文档工具
	documentTools.forEach(tool => registerTool(tool));

	// 注册本体工具
	ontologyTools.forEach(tool => registerTool(tool));

	// 注册本体数据工具
	ontologyDataTools.forEach(tool => registerTool(tool));

	// 注册系统工具
	systemTools.forEach(tool => registerTool(tool));

	// 注册 Bash 工具
	bashTools.forEach(tool => registerTool(tool));

	// 注册技能工具
	skillTools.forEach(tool => registerTool(tool));

	// 注册 URL 工具
	urlTools.forEach(tool => registerTool(tool));

	// 注册 Ask User Question 工具
	askUserQuestionTools.forEach(tool => registerTool(tool));

	// 注册定时任务工具
	scheduleTools.forEach(tool => registerTool(tool));

	const total = registry.getAll().length;
	const elapsed = Date.now() - t0;
	isInitialized = true;
	console.error(`[ToolRegistry] initializeBuiltInTools DONE — registered ${total} tools in ${elapsed}ms`);
}

/**
 * 获取工具列表摘要（用于日志或调试）
 */
export function getToolSummary(): Array<{
	name: string;
	category: string;
	enabled: boolean;
}> {
	const registry = getToolRegistry();
	return registry.getAll().map(tool => ({
		name: tool.name,
		category: tool.category,
		enabled: tool.enabled,
	}));
}

export { getAgentToolsForScope } from "./registry";
