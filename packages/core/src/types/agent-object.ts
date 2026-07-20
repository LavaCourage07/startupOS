/**
 * OS.3: Agent Object Types - Agent 对象定义 (Story OS.3)
 *
 * Types for managed Agent objects that appear in Desktop/Dock
 *
 * NOTE: Core types (AgentType, AgentStatus, AgentObject, etc.) are defined in agent.ts
 * This file only contains hook return types and utility types
 */

import type { AgentObject, AgentTypeInfo } from './agent';
import { AgentType, AgentStatus } from './agent';

// Re-export core types for backward compatibility
export { AgentType, AgentStatus };
export type { AgentObject, AgentTypeInfo } from './agent';

// ============================================================================
// Agent Hook Return Types
// ============================================================================

/**
 * Return type for useAgentRegistry hook
 */
export interface UseAgentRegistryReturn {
  // Queries
  agents: AgentObject[];
  agentMap: Record<string, AgentObject>;
  activeAgent: AgentObject | null;

  // Registry
  registerAgent: (agent: AgentObject) => void;
  unregisterAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<AgentObject>) => void;

  // State management
  setAgentStatus: (id: string, status: AgentStatus) => void;
  setActiveAgent: (id: string | null) => void;

  // Queries
  searchAgents: (query: string) => AgentObject[];
  getAgentsByType: (type: AgentType) => AgentObject[];
  getAgentsByStatus: (status: AgentStatus) => AgentObject[];
}

/**
 * Return type for useAgent hook
 */
export interface UseAgentReturn {
  agent: AgentObject | null;
  status: AgentStatus;
  typeInfo: AgentTypeInfo;
  isRunning: boolean;
  isIdle: boolean;
  isError: boolean;
  isPaused: boolean;
  setStatus: (status: AgentStatus) => void;
  activate: () => void;
  deactivate: () => void;
}

/**
 * Return type for useAgentType hook
 */
export interface UseAgentTypeReturn {
  typeInfo: AgentTypeInfo;
  agents: AgentObject[];
  getAgentIcon: () => string;
  getStatusIcon: () => string;
  getColor: () => string;
}

/**
 * Return type for useAgentSearch hook
 */
export interface UseAgentSearchReturn {
  query: string;
  results: AgentObject[];
  setQuery: (query: string) => void;
  hasResults: boolean;
  resultCount: number;
}
