/**
 * Launcher 模块
 *
 * 后台服务启动分离 - 4 种入口类型的统一启动协议：
 * - Project: 带本体知识图谱的知识来源
 * - Agent (Assistant): 消化本体后内化为指令的智能体
 * - Role Agent: 具有专业角色背景和生命周期的智能体
 * - Skill: 符合 Anthropic Agent Skills 标准的可复用工作流
 */

export {
  Launcher,
  type EntryType,
  type LaunchContext,
  type LaunchResult,
} from './base';

export { RoleAgentLauncher } from './role-agent';
export { AgentLauncher } from './agent';
export { ProjectLauncher } from './project';
export { SkillLauncher } from './skill';

export {
  launcherRegistry,
  launch,
  getLauncher,
  listEntryTypes,
} from './registry';
