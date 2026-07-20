/**
 * OS.3: Agent Registry Store (Zustand)
 * Agent registry state management for Story OS.3
 */

import { create } from 'zustand';
import type {
  AgentObject,
  AgentStatus,
  AgentRegistryState,
} from '@originos/core/types';

/**
 * Agent Registry Zustand Store
 *
 * Manages the central registry of all agents in the system.
 * Agents are stored as Record<id, AgentObject> for O(1) lookups.
 */
export const useAgentRegistryStore = create<AgentRegistryState>((set, _get) => ({
  // Initial state
  agents: {},
  activeAgentId: null,
  isLoading: false,

  // Actions

  /**
   * Set or replace an agent in the registry
   */
  setAgent: (id: string, agent: AgentObject) =>
    set((state) => ({
      agents: { ...state.agents, [id]: agent },
    })),

  /**
   * Remove an agent from the registry
   */
  removeAgent: (id: string) =>
    set((state) => {
      const { [id]: removed, ...rest } = state.agents;
      return { agents: rest };
    }),

  /**
   * Update partial properties of an agent
   */
  updateAgent: (id: string, updates: Partial<AgentObject>) =>
    set((state: AgentRegistryState) => ({
      agents: {
        ...state.agents,
        [id]: state.agents[id] ? { ...state.agents[id]!, ...updates } : undefined,
      } as Record<string, AgentObject>,
    }) as Partial<AgentRegistryState>),

  /**
   * Set the currently active agent
   */
  setActiveAgent: (id: string | null) => set({ activeAgentId: id }),

  /**
   * Set agent status and update lastActivatedAt timestamp
   */
  setAgentStatus: (id: string, status: AgentStatus) =>
    set((state: AgentRegistryState) => ({
      agents: {
        ...state.agents,
        [id]: state.agents[id]
          ? { ...state.agents[id]!, status, lastActivatedAt: Date.now() }
          : undefined,
      } as Record<string, AgentObject>,
    }) as Partial<AgentRegistryState>),

  /**
   * Bulk load agents (for initialization)
   */
  bulkSetAgents: (agents: AgentObject[]) =>
    set(() => ({
      agents: agents.reduce(
        (acc, agent) => ({ ...acc, [agent.id]: agent }),
        {}
      ),
    })),

  /**
   * Clear all agents from registry
   */
  clearAll: () => set({ agents: {}, activeAgentId: null }),
}));

// ============ Selector Functions ============

/**
 * Select all agents as an array
 */
export const selectAgents = (state: AgentRegistryState): AgentObject[] => {
  return Object.values(state.agents);
};

/**
 * Select a single agent by ID
 */
export const selectAgent = (id: string) => (state: AgentRegistryState): AgentObject | null => {
  return state.agents[id] || null;
};

/**
 * Select agents by status
 */
export const selectAgentsByStatus = (status: AgentStatus) => (state: AgentRegistryState): AgentObject[] => {
  return Object.values(state.agents).filter(agent => agent.status === status);
};

/**
 * Select agents by type
 */
export const selectAgentsByType = (type: string) => (state: AgentRegistryState): AgentObject[] => {
  return Object.values(state.agents).filter(agent => agent.type === type);
};
