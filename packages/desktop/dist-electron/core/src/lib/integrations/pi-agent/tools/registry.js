"use strict";
/**
 * 工具注册表
 * 管理所有可用的工具，提供工具的注册、查询和执行功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
exports.getToolRegistry = getToolRegistry;
exports.registerTool = registerTool;
exports.getAgentTools = getAgentTools;
exports.getAgentToolsForScope = getAgentToolsForScope;
exports.getEnabledToolsByCategory = getEnabledToolsByCategory;
/**
 * 工具注册表类
 */
class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }
    /**
     * 注册工具
     */
    register(registration) {
        const { name } = registration;
        if (this.tools.has(name)) {
            console.warn(`工具 "${name}" 已存在，将被覆盖`);
        }
        this.tools.set(name, registration);
    }
    /**
     * 批量注册工具
     */
    registerBatch(registrations) {
        registrations.forEach((registration) => {
            this.register(registration);
        });
    }
    /**
     * 取消注册工具
     */
    unregister(name) {
        this.tools.delete(name);
    }
    /**
     * 获取工具
     */
    get(name) {
        return this.tools.get(name);
    }
    /**
     * 检查工具是否存在
     */
    has(name) {
        return this.tools.has(name);
    }
    /**
     * 获取所有工具
     */
    getAll() {
        return Array.from(this.tools.values());
    }
    /**
     * 获取启用的工具
     */
    getEnabled() {
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
    getEnabledForScope(agentType) {
        if (!agentType) {
            return this.getEnabled();
        }
        return this.getEnabled().filter((t) => {
            if (!t.scopes || t.scopes.length === 0)
                return true;
            return t.scopes.includes(agentType);
        });
    }
    /**
     * 获取指定分类的工具
     */
    getByCategory(category) {
        return this.getAll().filter((t) => t.category === category);
    }
    /**
     * 启用工具
     */
    enable(name) {
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
    disable(name) {
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
    clear() {
        this.tools.clear();
    }
    /**
     * 按 category 分组获取启用的工具。
     *
     * @param agentType agent 类型（如 'assistant', 'role-agent', 'skill'）
     * @returns 按 category 分组的工具列表
     */
    getEnabledToolsByCategory(agentType) {
        const tools = this.getEnabledForScope(agentType);
        const grouped = {};
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
    toAgentTools() {
        return this.getEnabled().map((tool) => ({
            name: tool.name,
            label: tool.label,
            description: tool.description,
            parameters: tool.parameters,
            execute: tool.execute,
        }));
    }
    /**
     * 按 agent 类型过滤后转换为 AgentTool 格式
     */
    toAgentToolsForScope(agentType) {
        return this.getEnabledForScope(agentType).map((tool) => ({
            name: tool.name,
            label: tool.label,
            description: tool.description,
            parameters: tool.parameters,
            execute: tool.execute,
        }));
    }
}
exports.ToolRegistry = ToolRegistry;
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
function getToolRegistry() {
    return globalRegistry;
}
/**
 * 注册工具到全局注册表
 */
function registerTool(registration) {
    globalRegistry.register(registration);
}
/**
 * 从全局注册表获取工具的 AgentTool 格式
 */
function getAgentTools() {
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
function getAgentToolsForScope(agentType) {
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
function getEnabledToolsByCategory(agentType) {
    return globalRegistry.getEnabledToolsByCategory(agentType);
}
