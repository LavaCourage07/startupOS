/**
 * 工具注册表
 * 管理所有可用的工具，提供工具的注册、查询和执行功能
 */

import type { TSchema } from "@sinclair/typebox";
import type { AgentTool } from "@originos/pi-agent-adapter";
import type { ToolRegistration } from "../types";

// ============================================================================
// 工具注册
// ============================================================================

/**
 * 工具注册接口
 * @deprecated 请使用 ToolRegistration from "../types"
 * 此处保留仅为向后兼容，新代码应直接从 types.js 导入
 */
export type { ToolRegistration } from "../types";

/**
 * 工具注册表类
 */
export class ToolRegistry {
	private tools = new Map<string, ToolRegistration<any, any>>();

	/**
	 * 注册工具
	 */
	register(registration: ToolRegistration<any, any>): void {
		const { name } = registration;

		if (this.tools.has(name)) {
			console.warn(`工具 "${name}" 已存在，将被覆盖`);
		}

		this.tools.set(name, registration);
	}

	/**
	 * 批量注册工具
	 */
	registerBatch(registrations: ToolRegistration<any, any>[]): void {
		registrations.forEach((registration) => {
			this.register(registration);
		});
	}

	/**
	 * 取消注册工具
	 */
	unregister(name: string): void {
		this.tools.delete(name);
	}

	/**
	 * 获取工具
	 */
	get(name: string): ToolRegistration<any, any> | undefined {
		return this.tools.get(name);
	}

	/**
	 * 检查工具是否存在
	 */
	has(name: string): boolean {
		return this.tools.has(name);
	}

	/**
	 * 获取所有工具
	 */
	getAll(): ToolRegistration<any, any>[] {
		return Array.from(this.tools.values());
	}

	/**
	 * 获取启用的工具
	 */
	getEnabled(): ToolRegistration<any, any>[] {
		return this.getAll().filter((t) => t.enabled);
	}

	/**
	 * 按 agent 类型过滤后获取启用的工具
	 *
	 * @param agentType agent 类型（如 'assistant', 'role-agent', 'skill'）
	 * 不传则返回所有启用的工具
	 *
	 * 过滤规则：
	 * - 工具未声明 scopes → 所有类型通用，返回
	 * - 工具声明了 scopes 且包含 agentType → 返回
	 * - 工具声明了 scopes 但不包含 agentType → 过滤掉
	 */
	getEnabledForScope(agentType?: string): ToolRegistration<any, any>[] {
		if (!agentType) {
			return this.getEnabled();
		}
		return this.getEnabled().filter((t) => {
			if (!t.scopes || t.scopes.length === 0) return true;
			return t.scopes.includes(agentType);
		});
	}

	/**
	 * 获取指定分类的工具
	 */
	getByCategory(
		category: "file" | "ontology" | "graph" | "skill" | "system"
	): ToolRegistration<any, any>[] {
		return this.getAll().filter((t) => t.category === category);
	}

	/**
	 * 启用工具
	 */
	enable(name: string): boolean {
		const tool = this.tools.get(name);
		if (tool) {
			tool.enabled = true;
			return true;
		}
		return false;
	}

	/**
	 * 禁用工具
	 */
	disable(name: string): boolean {
		const tool = this.tools.get(name);
		if (tool) {
			tool.enabled = false;
			return true;
		}
		return false;
	}

	/**
	 * 清空所有工具
	 */
	clear(): void {
		this.tools.clear();
	}

	/**
	 * 按 category 分组获取启用的工具。
	 *
	 * @param agentType agent 类型（如 'assistant', 'role-agent', 'skill'）
	 * @returns 按 category 分组的工具列表
	 */
	getEnabledToolsByCategory(agentType?: string): Record<string, ToolRegistration<any, any>[]> {
		const tools = this.getEnabledForScope(agentType);
		const grouped: Record<string, ToolRegistration<any, any>[]> = {};

		for (const tool of tools) {
			const category = tool.category || "other";
			if (!grouped[category]) {
				grouped[category] = [];
			}
			grouped[category].push(tool);
		}

		return grouped;
	}

	/**
	 * 转换为 pi-agent-core AgentTool 格式
	 */
	toAgentTools(): AgentTool<TSchema>[] {
		return this.getEnabled().map((tool) => ({
			name: tool.name,
			label: tool.label,
			description: tool.description,
			parameters: tool.parameters,
			execute: tool.execute,
		})) as AgentTool<TSchema>[];
	}

	/**
	 * 按 agent 类型过滤后转换为 AgentTool 格式
	 */
	toAgentToolsForScope(agentType?: string): AgentTool<TSchema>[] {
		return this.getEnabledForScope(agentType).map((tool) => ({
			name: tool.name,
			label: tool.label,
			description: tool.description,
			parameters: tool.parameters,
			execute: tool.execute,
		})) as AgentTool<TSchema>[];
	}
}

// ============================================================================
// 单例实例
// ============================================================================

/**
 * 全局工具注册表实例
 */
const globalRegistry = new ToolRegistry();

/**
 * 获取全局工具注册表
 */
export function getToolRegistry(): ToolRegistry {
	return globalRegistry;
}

/**
 * 注册工具到全局注册表
 */
export function registerTool(registration: ToolRegistration<any, any>): void {
	globalRegistry.register(registration);
}

/**
 * 从全局注册表获取工具的 AgentTool 格式
 */
export function getAgentTools(): AgentTool<TSchema>[] {
	const count = globalRegistry.toAgentTools().length;
	console.error(`[ToolRegistry] getAgentTools called — registry has ${count} tool(s)`);
	if (count === 0) {
		console.warn(`[ToolRegistry] WARNING: getAgentTools returned 0 tools! initializeBuiltInTools may not have been called yet.`);
		console.trace('[ToolRegistry] Call stack for empty getAgentTools');
	}
	return globalRegistry.toAgentTools();
}

/**
 * 按 agent 类型获取工具的 AgentTool 格式
 *
 * 工具可通过声明 `scopes` 字段来限定适用的 agent 类型：
 * - 未声明 scopes → 所有类型通用
 * - 声明了 scopes → 仅当 agentType 在 scopes 中时才返回
 *
 * @param agentType agent 类型（如 'assistant', 'role-agent', 'skill'）
 */
export function getAgentToolsForScope(agentType?: string): AgentTool<TSchema>[] {
	const tools = globalRegistry.toAgentToolsForScope(agentType);
	if (agentType === "worker" || agentType === "skill") {
		return tools.filter((tool) => tool.name !== "ask_user_question");
	}
	return tools;
}

/**
 * 按 agent 类型 + category 分组获取启用的工具（含 description）。
 * 用于 system prompt 构建。
 *
 * @param agentType agent 类型
 * @returns 按 category 分组的工具注册表
 */
export function getEnabledToolsByCategory(agentType?: string): Record<string, ToolRegistration<any, any>[]> {
	return globalRegistry.getEnabledToolsByCategory(agentType);
}
