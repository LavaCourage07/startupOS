/**
 * OS.3: Agent Registry Helper Functions
 * Utilities for working with the agent registry and Dock integration
 */

import { AgentStatus, type AgentObject } from '../../../types/agent-object';
import type { DockApp } from '../../../types/os';

/**
 * Convert agents to Dock apps format
 * Used to sync agents from the registry to the Dock
 */
export function agentsToDockApps(agents: AgentObject[]): DockApp[] {
  return agents.map((agent, index) => ({
    id: agent.id,
    name: agent.displayName,
    icon: agent.icon,
    iconType: 'emoji' as const,
    isRunning: agent.status === AgentStatus.RUNNING,
    isPinned: true,
    index,
  }));
}

/**
 * Validate an AgentObject - ensures all required fields are present
 */
export function isValidAgent(agent: unknown): agent is AgentObject {
  if (
    typeof agent !== 'object' ||
    agent === null
  ) {
    return false;
  }

  const obj = agent as Record<string, unknown>;

  return (
    typeof obj['id'] === 'string' &&
    typeof obj['name'] === 'string' &&
    typeof obj['displayName'] === 'string' &&
    typeof obj['status'] === 'string' &&
    typeof obj['icon'] === 'string' &&
    typeof obj['color'] === 'string' &&
    Array.isArray(obj['capabilities']) &&
    typeof obj['createdAt'] === 'number' &&
    typeof obj['lastActivatedAt'] === 'number'
  );
}

/**
 * Agent registry error class
 */
export class AgentRegistryError extends Error {
  constructor(
    message: string,
    public code: string,
    public agentId?: string
  ) {
    super(message);
    this.name = 'AgentRegistryError';
  }
}

/**
 * Common error codes
 */
export const AgentErrorCodes = {
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  INVALID_AGENT: 'INVALID_AGENT',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  DUPLICATE_AGENT: 'DUPLICATE_AGENT',
  REGISTRY_ERROR: 'REGISTRY_ERROR',
} as const;
