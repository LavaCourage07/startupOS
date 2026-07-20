/**
 * OS.3: Agent Initializer Component
 * Initializes the default agents into the registry on app startup
 */

import { useEffect } from 'react';
import { useAgentRegistryStore } from '@/store/agentRegistry';
import { initializeDefaultAgents } from '@originos/core/lib/features/agent';

/**
 * AgentInitializer - Loads default agents into the registry
 * Place this component in the app root (e.g., layout.tsx or page.tsx)
 */
export function AgentInitializer() {
  const bulkSetAgents = useAgentRegistryStore((state) => state.bulkSetAgents);
  const agents = useAgentRegistryStore((state) => state.agents);

  useEffect(() => {
    // Only initialize if agents registry is empty
    if (Object.keys(agents).length === 0) {
      const defaultAgents = initializeDefaultAgents();
      bulkSetAgents(defaultAgents);
      console.log('Agent Registry initialized with', defaultAgents.length, 'default agents');
      console.log('Default agents:', defaultAgents.map(a => a.displayName));
    }
  }, [bulkSetAgents, agents]);

  // This component doesn't render anything
  return null;
}

export default AgentInitializer;
