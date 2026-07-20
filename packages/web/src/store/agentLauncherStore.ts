/**
 * OS.7: Agent Launcher Store
 * Zustand store for managing open Agent dialog windows
 * This replaces the React hook useAgentLauncher for global state accessibility
 */

import { create } from 'zustand';

/**
 * Agent Launcher State
 */
interface AgentLauncherState {
  // State
  openAgentIds: string[];

  // Actions
  openAgent: (agentId: string) => void;
  closeAgent: (agentId: string) => void;
  toggleAgent: (agentId: string) => void;
  closeAllAgents: () => void;
  setAgentRunning: (agentId: string, isRunning: boolean) => void;
}

/**
 * Agent Launcher Store
 */
export const useAgentLauncherStore = create<AgentLauncherState>((set, get) => ({
  openAgentIds: [],

  openAgent: (agentId: string) => {
    set((state) => {
      // Already open, no change needed
      if (state.openAgentIds.includes(agentId)) {
        return state;
      }
      return { openAgentIds: [...state.openAgentIds, agentId] };
    });
  },

  closeAgent: (agentId: string) => {
    set((state) => ({
      openAgentIds: state.openAgentIds.filter((id) => id !== agentId),
    }));
  },

  toggleAgent: (agentId: string) => {
    const currentIds = get().openAgentIds;
    if (currentIds.includes(agentId)) {
      get().closeAgent(agentId);
    } else {
      get().openAgent(agentId);
    }
  },

  closeAllAgents: () => {
    set({ openAgentIds: [] });
  },

  setAgentRunning: (_agentId: string, _isRunning: boolean) => {
    // This is a placeholder - actual status is managed by agentRegistryStore
    // This method exists for API compatibility
  },
}));
