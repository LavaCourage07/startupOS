"use strict";
/**
 * Launcher Registry
 *
 * 按 entryType 路由到对应的 Launcher 实现。
 * 提供 launch(), getLauncher(), listEntryTypes() 方法。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEntryTypes = exports.getLauncher = exports.launch = exports.launcherRegistry = void 0;
const role_agent_1 = require("./role-agent");
const agent_1 = require("./agent");
const project_1 = require("./project");
const skill_1 = require("./skill");
/**
 * 维护 entryType → Launcher 的映射
 */
class LauncherRegistry {
    constructor() {
        this.launchers = new Map();
        this.register(new role_agent_1.RoleAgentLauncher());
        this.register(new agent_1.AgentLauncher());
        this.register(new project_1.ProjectLauncher());
        this.register(new skill_1.SkillLauncher());
    }
    /**
     * 注册一个 Launcher
     */
    register(launcher) {
        this.launchers.set(launcher.entryType, launcher);
    }
    /**
     * 按类型获取 Launcher
     */
    getLauncher(type) {
        return this.launchers.get(type);
    }
    /**
     * 列出所有已注册的入口类型
     */
    listEntryTypes() {
        return Array.from(this.launchers.keys());
    }
    /**
     * 启动入口：自动路由到对应 Launcher
     */
    async launch(ctx) {
        const launcher = this.getLauncher(ctx.entryType);
        if (!launcher) {
            return {
                success: false,
                sessionId: '',
                systemPrompt: '',
                agentType: '',
                baseDir: '',
                error: `Unknown entry type: ${ctx.entryType}. Available: ${this.listEntryTypes().join(', ')}`,
            };
        }
        return launcher.launch(ctx);
    }
}
/**
 * 全局单例
 */
exports.launcherRegistry = new LauncherRegistry();
// 便捷导出
const launch = (ctx) => exports.launcherRegistry.launch(ctx);
exports.launch = launch;
const getLauncher = (type) => exports.launcherRegistry.getLauncher(type);
exports.getLauncher = getLauncher;
const listEntryTypes = () => exports.launcherRegistry.listEntryTypes();
exports.listEntryTypes = listEntryTypes;
