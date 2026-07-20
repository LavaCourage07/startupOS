/**
 * Launcher Registry
 *
 * 按 entryType 路由到对应的 Launcher 实现。
 * 提供 launch(), getLauncher(), listEntryTypes() 方法。
 */

import { Launcher, type LaunchContext, type LaunchResult, type EntryType } from './base';
import { RoleAgentLauncher } from './role-agent';
import { AgentLauncher } from './agent';
import { ProjectLauncher } from './project';
import { SkillLauncher } from './skill';

/**
 * 维护 entryType → Launcher 的映射
 */
class LauncherRegistry {
  private launchers = new Map<EntryType, Launcher>();

  constructor() {
    this.register(new RoleAgentLauncher());
    this.register(new AgentLauncher());
    this.register(new ProjectLauncher());
    this.register(new SkillLauncher());
  }

  /**
   * 注册一个 Launcher
   */
  register(launcher: Launcher): void {
    this.launchers.set(launcher.entryType, launcher);
  }

  /**
   * 按类型获取 Launcher
   */
  getLauncher(type: EntryType): Launcher | undefined {
    return this.launchers.get(type);
  }

  /**
   * 列出所有已注册的入口类型
   */
  listEntryTypes(): EntryType[] {
    return Array.from(this.launchers.keys());
  }

  /**
   * 启动入口：自动路由到对应 Launcher
   */
  async launch(ctx: LaunchContext): Promise<LaunchResult> {
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
export const launcherRegistry = new LauncherRegistry();

// 便捷导出
export const launch = (ctx: LaunchContext) => launcherRegistry.launch(ctx);
export const getLauncher = (type: EntryType) => launcherRegistry.getLauncher(type);
export const listEntryTypes = () => launcherRegistry.listEntryTypes();
