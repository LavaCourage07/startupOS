/**
 * OS.7: Agent Launcher Hook
 * Story OS.7: Agent 托管服务
 * 用于启动 Agent 对话窗口的 hook
 */

import { useState, useCallback } from 'react';
import { useAgentRegistryStore } from '@/store/agentRegistry';
import { AgentStatus } from '@originos/core/types';

/**
 * Open Agent Dialog 接口
 */
export interface OpenAgentDialogParams {
  agentId: string;
  projectContext?: Record<string, unknown>;
}

/**
 * Agent Launcher Hook 返回值
 */
export interface UseAgentLauncherReturn {
  // 状态
  openAgentIds: string[];
  isAnyAgentOpen: boolean;
  isAgentOpen: (agentId: string) => boolean;

  // 操作
  openAgent: (params: OpenAgentDialogParams) => void;
  closeAgent: (agentId: string) => void;
  toggleAgent: (agentId: string) => void;
  closeAllAgents: () => void;

  // Agent 状态
  setAgentRunning: (agentId: string, isRunning: boolean) => void;
}

/**
 * Agent Launcher Hook
 * 管理打开的 Agent 对话框
 */
export function useAgentLauncher(): UseAgentLauncherReturn {
  // 管理当前打开的 agent 对话框 ID
  const [openAgentIds, setOpenAgentIds] = useState<string[]>([]);

  // 是否有任一 agent 对话框打开
  const isAnyAgentOpen = openAgentIds.length > 0;

  // 检查特定 agent 是否打开
  const isAgentOpen = useCallback(
    (agentId: string) => openAgentIds.includes(agentId),
    [openAgentIds]
  );

  // 打开 Agent 对话框
  const openAgent = useCallback((params: OpenAgentDialogParams) => {
    const { agentId } = params;

    // 设置 agent 为活跃状态
    useAgentRegistryStore.getState().setActiveAgent(agentId);

    // 设置 agent 为运行状态
    useAgentRegistryStore.getState().setAgentStatus(agentId, AgentStatus.RUNNING);

    // 添加到打开列表（如果未打开）
    if (!openAgentIds.includes(agentId)) {
      setOpenAgentIds((prev) => [...prev, agentId]);
    }
  }, [openAgentIds]);

  // 关闭 Agent 对话框
  const closeAgent = useCallback(
    (agentId: string) => {
      // 设置 agent 为空闲状态
      useAgentRegistryStore.getState().setAgentStatus(agentId, AgentStatus.IDLE);

      // 设置不是活跃状态
      const activeAgentId = useAgentRegistryStore.getState().activeAgentId;
      if (activeAgentId === agentId) {
        useAgentRegistryStore.getState().setActiveAgent(null);
      }

      // 从打开列表中移除
      setOpenAgentIds((prev) => prev.filter((id) => id !== agentId));
    },
    []
  );

  // 切换 Agent 对话框状态
  const toggleAgent = useCallback(
    (agentId: string) => {
      if (isAgentOpen(agentId)) {
        closeAgent(agentId);
      } else {
        openAgent({ agentId });
      }
    },
    [isAgentOpen, openAgent, closeAgent]
  );

  // 关闭所有 Agent 对话框
  const closeAllAgents = useCallback(() => {
    openAgentIds.forEach((agentId) => {
      useAgentRegistryStore.getState().setAgentStatus(agentId, AgentStatus.IDLE);
    });
    useAgentRegistryStore.getState().setActiveAgent(null);
    setOpenAgentIds([]);
  }, [openAgentIds]);

  // 设置 Agent 运行状态（供外部调用）
  const setAgentRunning = useCallback((agentId: string, isRunning: boolean) => {
    useAgentRegistryStore.getState().setAgentStatus(
      agentId,
      isRunning ? AgentStatus.RUNNING : AgentStatus.IDLE
    );
  }, []);

  return {
    openAgentIds,
    isAnyAgentOpen,
    isAgentOpen,
    openAgent,
    closeAgent,
    toggleAgent,
    closeAllAgents,
    setAgentRunning,
  };
}

/**
 * Agent Dialog 状态管理 Hook（简化版单例）
 * 这是一个全局单例，用于管理所有打开的 agent 对话框
 */
let agentLauncherInstance: ReturnType<typeof useAgentLauncher> | null = null;

function getAgentLauncher() {
  if (!agentLauncherInstance) {
    agentLauncherInstance = useAgentLauncher();
  }
  return agentLauncherInstance;
}

/**
 * 全局打开 Agent 对话框（可在组件外部调用）
 */
export function openAgentDialog(agentId: string, project?: Record<string, unknown>) {
  const launcher = getAgentLauncher();
  launcher.openAgent({ agentId, projectContext: project });
}

/**
 * 全局关闭 Agent 对话框
 */
export function closeAgentDialog(agentId: string) {
  const launcher = getAgentLauncher();
  launcher.closeAgent(agentId);
}

/**
 * 全局关闭所有 Agent 对话框
 */
export function closeAllAgentDialogs() {
  const launcher = getAgentLauncher();
  launcher.closeAllAgents();
}
