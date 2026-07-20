/**
 * 共享 Runtime Agent 注册表
 * start/route.ts 和 messages/route.ts 共用此模块
 * 使用 globalThis 避免 Next.js HMR 创建多个模块实例
 */

import { AgentProcess } from '@originos/core/modules/collaboration-runtime/sandbox/agent-spawner';

export interface ProjectRuntimeAgent {
  process: AgentProcess;
  projectId: string;
}

// 挂载到 globalThis 避免 HMR 实例隔离
declare global {
  // eslint-disable-next-line no-var
  var __runtimeAgents: Map<string, ProjectRuntimeAgent> | undefined;
}

const runtimeAgents = globalThis.__runtimeAgents ?? new Map<string, ProjectRuntimeAgent>();
globalThis.__runtimeAgents = runtimeAgents;

export function getRuntimeAgent(projectId: string): ProjectRuntimeAgent | undefined {
  return runtimeAgents.get(projectId);
}

export function setRuntimeAgent(projectId: string, entry: ProjectRuntimeAgent): void {
  runtimeAgents.set(projectId, entry);
}

export function removeRuntimeAgent(projectId: string): void {
  runtimeAgents.delete(projectId);
}

export function listRuntimeAgents(): string[] {
  return Array.from(runtimeAgents.keys());
}
