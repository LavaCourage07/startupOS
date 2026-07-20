/**
 * OS.7: Agent Host Types
 */

export type AgentStatus = 'idle' | 'initializing' | 'running' | 'stopping' | 'stopped' | 'error';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Agent {
  id: string;
  name: string;
  icon: string;
  description?: string;
}
