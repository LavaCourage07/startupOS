/**
 * OS.7: Agent Lifecycle Hook
 */

import { useState, useEffect } from 'react';
import { AgentStatus } from '@originos/core/types';
import { usePiAgentStore } from '@originos/core/lib/integrations/pi-agent/store';
import { normalizeRuntimeLLMConfig } from '@originos/core/lib/integrations/pi-agent';
import { useSettingsStore } from '@/store/settingsStore';

interface ProjectContext {
  projectPath: string;
  files?: string[];
}

export function useAgentLifecycle(agentId: string) {
  const [status, setStatus] = useState<AgentStatus>(AgentStatus.IDLE);
  const piAgentStore = usePiAgentStore();
  const getEffectiveConfig = useSettingsStore((s) => s.getEffectiveConfig);

  const start = async (projectContext: ProjectContext) => {
    setStatus(AgentStatus.INITIALIZING);
    try {
      const llmConfig = normalizeRuntimeLLMConfig(getEffectiveConfig());
      await piAgentStore.initialize(agentId, projectContext as any, {}, llmConfig);
      setStatus(AgentStatus.RUNNING);
    } catch (error) {
      setStatus(AgentStatus.ERROR);
      throw error;
    }
  };

  const stop = async () => {
    setStatus(AgentStatus.PAUSED);
    try {
      piAgentStore.abort();
      setStatus(AgentStatus.UNREGISTERED);
    } catch (error) {
      setStatus(AgentStatus.ERROR);
      throw error;
    }
  };

  useEffect(() => {
    return () => {
      piAgentStore.destroy();
    };
  }, []);

  return { status, start, stop };
}
