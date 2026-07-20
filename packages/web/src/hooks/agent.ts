/**
 * OS.3: Agent Hooks
 * Hooks for agent registry and individual agent management
 */

import { useMemo, useCallback, useState } from 'react';
import { useAgentRegistryStore, selectAgents, selectAgent, selectAgentsByStatus } from '@/store/agentRegistry';
import type { AgentObject, AgentTypeInfo } from '@originos/core/types';
import type { AgentStatus, AgentType } from '@originos/core/types';
import { AGENT_TYPE_INFO, AGENT_STATUS_ICON, AGENT_STATUS_COLOR } from '@originos/core/types';

// ============ useAgentRegistry Hook ============

export interface UseAgentRegistryReturn {
  agents: AgentObject[];
  agentMap: Record<string, AgentObject>;
  activeAgentId: string | null;
  activeAgent: AgentObject | null;
  
  // Actions
  setAgent: (id: string, agent: AgentObject) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<AgentObject>) => void;
  setAgentStatus: (id: string, status: AgentStatus) => void;
  setActiveAgent: (id: string | null) => void;
  bulkSetAgents: (agents: AgentObject[]) => void;
  clearAll: () => void;

  // Query helpers
  getAgentsByType: (type: AgentType) => AgentObject[];
  getAgentsByStatus: (status: AgentStatus) => AgentObject[];
  searchAgents: (query: string) => AgentObject[];
}

export function useAgentRegistry(): UseAgentRegistryReturn {
  const state = useAgentRegistryStore();
  const agents = useMemo(() => selectAgents(state), [state]);
  const activeAgent = useMemo(() => selectAgent(state.activeAgentId || '')(state), [state]);

  const getAgentsByType = useCallback((type: AgentType) => {
    return agents.filter(agent => agent.type === type);
  }, [agents]);

  const getAgentsByStatus = useCallback((status: AgentStatus) => {
    return selectAgentsByStatus(status)(state);
  }, [state]);

  const searchAgents = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return agents.filter(agent =>
      agent.displayName.toLowerCase().includes(lowerQuery) ||
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
    );
  }, [agents]);

  return {
    agents,
    agentMap: state.agents,
    activeAgentId: state.activeAgentId,
    activeAgent,
    setAgent: state.setAgent,
    removeAgent: state.removeAgent,
    updateAgent: state.updateAgent,
    setAgentStatus: state.setAgentStatus,
    setActiveAgent: state.setActiveAgent,
    bulkSetAgents: state.bulkSetAgents,
    clearAll: state.clearAll,
    getAgentsByType,
    getAgentsByStatus,
    searchAgents,
  };
}

// ============ useAgent Hook ============

export interface UseAgentReturn {
  agent: AgentObject | null;
  status: AgentStatus;
  typeInfo: AgentTypeInfo;
  isRunning: boolean;
  isIdle: boolean;
  isError: boolean;
  isPaused: boolean;
  isUnregistered: boolean;
  statusIcon: string;
  statusColor: string;
  setStatus: (status: AgentStatus) => void;
}

export function useAgent(id: string | null): UseAgentReturn {
  const agent = useAgentRegistryStore(state => state.agents[id || ''] || null);
  const setAgentStatus = useAgentRegistryStore(state => state.setAgentStatus);

  const typeInfo = useMemo(() =>
    agent ? AGENT_TYPE_INFO[agent.type] : {} as AgentTypeInfo,
    [agent]
  );

  const statusIcon = useMemo(() => 
    agent ? AGENT_STATUS_ICON[agent.status] : '',
    [agent]
  );

  const statusColor = useMemo(() => 
    agent ? AGENT_STATUS_COLOR[agent.status] : '#9CA3AF',
    [agent]
  );

  const setStatus = useCallback((status: AgentStatus) => {
    if (agent) {
      setAgentStatus(agent.id, status);
    }
  }, [agent, setAgentStatus]);

  return {
    agent,
    status: agent?.status || ('unregistered' as AgentStatus),
    typeInfo,
    isRunning: agent?.status === ('running' as AgentStatus) || false,
    isIdle: agent?.status === ('idle' as AgentStatus) || false,
    isError: agent?.status === ('error' as AgentStatus) || false,
    isPaused: agent?.status === ('paused' as AgentStatus) || false,
    isUnregistered: agent?.status === ('unregistered' as AgentStatus) || false,
    statusIcon,
    statusColor,
    setStatus,
  };
}

// ============ useAgentType Hook ============

export interface UseAgentTypeReturn {
  typeInfo: AgentTypeInfo;
  agents: AgentObject[];
  getAgentIcon: () => string;
  getStatusIcon: (status: AgentStatus) => string;
  getColor: () => string;
  getCapabilities: () => string[];
}

export function useAgentType(type: AgentType): UseAgentTypeReturn {
  const agents = useAgentRegistry();
  
  const typeAgents = useMemo(() => 
    agents.getAgentsByType(type),
    [agents, type]
  );
  
  const typeInfo = AGENT_TYPE_INFO[type];

  const getAgentIcon = () => typeInfo.icon;
  const getStatusIcon = (status: AgentStatus) => AGENT_STATUS_ICON[status];
  const getColor = () => typeInfo.color;
  const getCapabilities = () => typeInfo.capabilities;

  return {
    typeInfo,
    agents: typeAgents,
    getAgentIcon,
    getStatusIcon,
    getColor,
    getCapabilities,
  };
}

// ============ useAgentSearch Hook ============

export interface UseAgentSearchReturn {
  query: string;
  results: AgentObject[];
  setQuery: (query: string) => void;
  hasResults: boolean;
  resultCount: number;
}

export function useAgentSearch(): UseAgentSearchReturn {
  const [query, setQuery] = useState('');
  const agents = useAgentRegistryStore(state => selectAgents(state));

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return agents.filter(agent =>
      agent.displayName.toLowerCase().includes(lowerQuery) ||
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
    );
  }, [query, agents]);

  const hasResults = results.length > 0;
  const resultCount = results.length;

  return {
    query,
    results,
    setQuery,
    hasResults,
    resultCount,
  };
}
