/**
 * OS.7: Agent Host Store
 */

import { create } from 'zustand';
import type { AgentObject, AgentMessage } from '@originos/core/types';

interface AgentHostState {
  agents: AgentObject[];
  dialogStates: Record<string, boolean>;
  messageCache: Record<string, AgentMessage[]>;
  activeAgentId: string | null;

  openDialog: (agentId: string) => void;
  closeDialog: (agentId: string) => void;
  setActiveAgent: (agentId: string | null) => void;
  addMessageToCache: (agentId: string, message: AgentMessage) => void;
  setAgents: (agents: AgentObject[]) => void;
}

export const useAgentHostStore = create<AgentHostState>((set) => ({
  agents: [],
  dialogStates: {},
  messageCache: {},
  activeAgentId: null,

  openDialog: (agentId) =>
    set((state) => ({
      dialogStates: { ...state.dialogStates, [agentId]: true },
      activeAgentId: agentId,
    })),

  closeDialog: (agentId) =>
    set((state) => ({
      dialogStates: { ...state.dialogStates, [agentId]: false },
    })),

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),

  addMessageToCache: (agentId, message) =>
    set((state) => ({
      messageCache: {
        ...state.messageCache,
        [agentId]: [...(state.messageCache[agentId] || []), message],
      },
    })),

  setAgents: (agents) => set({ agents }),
}));
