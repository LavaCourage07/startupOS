/**
 * OS.3: Agent Hooks - React hooks for agent management (Story OS.3)
 */

import { useMemo, useCallback } from 'react';
import { useAgentRegistryStore } from '@/store/agentRegistry';
import {
  AgentType,
  AgentStatus,
  AgentObject,
  AGENT_TYPE_INFO,
  AGENT_STATUS_ICON,
  type UseAgentRegistryReturn,
  type UseAgentReturn,
  type UseAgentTypeReturn,
  type UseAgentSearchReturn,
} from '@originos/core/types';

// ============================================================================
// useAgentRegistry Hook
// ============================================================================

/**
 * Main agent registry hook - provides query and mutation access to agents
 */
export function useAgentRegistry(): UseAgentRegistryReturn {
  const { agents, activeAgentId, setAgent, removeAgent, updateAgent, setActiveAgent, setAgentStatus } =
    useAgentRegistryStore();

  // Convert agents object to array
  const agentsArray = useMemo(() => Object.values(agents), [agents]);

  // Get active agent
  const activeAgent = useMemo(
    () => (activeAgentId ? agents[activeAgentId] ?? null : null),
    [activeAgentId, agents]
  );

  // Register an agent
  const registerAgent = useCallback(
    (agent: AgentObject) => {
      setAgent(agent.id, agent);
    },
    [setAgent]
  );

  // Unregister an agent
  const unregisterAgent = useCallback(
    (id: string) => {
      removeAgent(id);
    },
    [removeAgent]
  );

  // Search agents by name or capability
  const searchAgents = useCallback(
    (query: string): AgentObject[] => {
      if (!query) return agentsArray;
      const lowerQuery = query.toLowerCase();
      return agentsArray.filter(
        (agent) =>
          agent.name.toLowerCase().includes(lowerQuery) ||
          agent.displayName.toLowerCase().includes(lowerQuery) ||
          agent.capabilities.some((cap) => cap.toLowerCase().includes(lowerQuery))
      );
    },
    [agentsArray]
  );

  // Get agents by type
  const getAgentsByType = useCallback(
    (type: AgentType): AgentObject[] => {
      return agentsArray.filter((agent) => agent.type === type);
    },
    [agentsArray]
  );

  // Get agents by status
  const getAgentsByStatus = useCallback(
    (status: AgentStatus): AgentObject[] => {
      return agentsArray.filter((agent) => agent.status === status);
    },
    [agentsArray]
  );

  return {
    agents: agentsArray,
    agentMap: agents,
    activeAgent,
    registerAgent,
    unregisterAgent,
    updateAgent,
    setActiveAgent,
    setAgentStatus,
    searchAgents,
    getAgentsByType,
    getAgentsByStatus,
  };
}

// ============================================================================
// useAgent Hook
// ============================================================================

/**
 * Get a single agent by ID with convenient state helpers
 */
export function useAgent(id: string): UseAgentReturn {
  const { agentMap, setAgentStatus, setActiveAgent } = useAgentRegistry();

  const agent = useMemo(() => agentMap[id] ?? null, [id, agentMap]);
  const status = useMemo(() => agent?.status ?? AgentStatus.UNREGISTERED, [agent]);
  const typeInfo = useMemo(
    () => (agent ? AGENT_TYPE_INFO[agent.type] : AGENT_TYPE_INFO[AgentType.DEVELOPER]),
    [agent]
  );

  const isRunning = status === AgentStatus.RUNNING;
  const isIdle = status === AgentStatus.IDLE;
  const isError = status === AgentStatus.ERROR;
  const isPaused = status === AgentStatus.PAUSED;

  const setStatus = useCallback(
    (newStatus: AgentStatus) => {
      if (agent) {
        setAgentStatus(agent.id, newStatus);
      }
    },
    [agent, setAgentStatus]
  );

  const activate = useCallback(() => {
    if (agent) {
      setAgentStatus(agent.id, AgentStatus.RUNNING);
      setActiveAgent(agent.id);
    }
  }, [agent, setAgentStatus, setActiveAgent]);

  const deactivate = useCallback(() => {
    if (agent) {
      setAgentStatus(agent.id, AgentStatus.IDLE);
    }
  }, [agent, setAgentStatus]);

  return {
    agent,
    status,
    typeInfo,
    isRunning,
    isIdle,
    isError,
    isPaused,
    setStatus,
    activate,
    deactivate,
  };
}

// ============================================================================
// useAgentType Hook
// ============================================================================

/**
 * Get info about an agent type and list all agents of that type
 */
export function useAgentType(type: AgentType): UseAgentTypeReturn {
  const { getAgentsByType } = useAgentRegistry();

  const typeInfo = useMemo(() => AGENT_TYPE_INFO[type], [type]);
  const agentsByType = useMemo(() => getAgentsByType(type), [type, getAgentsByType]);

  const getAgentIcon = useCallback(() => typeInfo.icon, [typeInfo]);
  const getStatusIcon = useCallback(() => AGENT_STATUS_ICON[AgentStatus.IDLE], []);
  const getColor = useCallback(() => typeInfo.color, [typeInfo]);

  return {
    typeInfo,
    agents: agentsByType,
    getAgentIcon,
    getStatusIcon,
    getColor,
  };
}

// ============================================================================
// useAgentSearch Hook (simple managed state)
// ============================================================================

import { useState } from 'react';

/**
 * Managed agent search hook with local state
 */
export function useAgentSearch(): UseAgentSearchReturn {
  const [query, setQuery] = useState('');
  const { searchAgents } = useAgentRegistry();

  const results = useMemo(() => searchAgents(query), [query, searchAgents]);

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
