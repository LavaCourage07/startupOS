'use client';

/**
 * React Hook for project initialization
 * Client-side only - contains React hooks and component imports
 */

import { useState, useCallback } from 'react';
import { useAppWindowManager } from '@/hooks/useAppWindowManager';
import AgentDialogContent from '@/components/os/agent-dialog/AgentDialogContent';
import type { AgentSession } from '@originos/core/types';

/**
 * Hook for project initialization
 */
export function useProjectInitialization() {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openWindow } = useAppWindowManager();

  const startInitialization = useCallback(async (projectName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Import and initialize skill dynamically (works in both client and server)
      const { projectInitializationSkill } = await import('@originos/core/lib/features/skills/project-initialization');
      const agentSession = await projectInitializationSkill.initialize({
        projectName,
      });

      setSession(agentSession);

      // Open Agent dialog window
      openWindow({
        id: `window-${agentSession.sessionId}`,
        type: 'agent',
        title: `初始化项目: ${projectName}`,
        content: {
          type: 'component',
          component: AgentDialogContent,
          props: {
            agentType: 'project-initialization',
            sessionId: agentSession.sessionId,
            title: `初始化项目: ${projectName}`,
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize project');
    } finally {
      setIsLoading(false);
    }
  }, [openWindow]);

  const sendMessage = useCallback(async (message: string) => {
    if (!session) {
      setError('No active session');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { projectInitializationSkill } = await import('@originos/core/lib/features/skills/project-initialization');
      const response = await projectInitializationSkill.processMessage(
        session.sessionId,
        message
      );

      if (response.complete) {
        // Project completed
        const { projectInitializationSkill: skill } = await import('@originos/core/lib/features/skills/project-initialization');
        await skill.completeInterview(session.sessionId);
      }

      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const cancelInterview = useCallback(async () => {
    if (!session) return;

    try {
      const { projectInitializationSkill } = await import('@originos/core/lib/features/skills/project-initialization');
      await projectInitializationSkill.cancelInterview(session.sessionId);
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel interview');
    }
  }, [session]);

  return {
    session,
    isLoading,
    error,
    startInitialization,
    sendMessage,
    cancelInterview,
  };
}
