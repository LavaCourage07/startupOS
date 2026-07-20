import { getIpcRenderer, isElectron } from './env';
import { IPC_CHANNELS } from './ipc-protocol';

export interface LocalAgentConfig {
  agentId: string;
  sessionId: string;
  projectId: string;
  workingDirectory: string;
  agentType?: 'persistent' | 'originos' | 'skill' | 'role-agent' | 'supervisor';
  systemPrompt?: string;
}

export interface LocalAgentEventEnvelope {
  agentId: string;
  sessionId: string;
  event: unknown;
}

export async function startLocalAgent(config: LocalAgentConfig): Promise<string> {
  if (!isElectron()) {
    throw new Error('Local agent runtime is only available in Electron');
  }
  return getIpcRenderer().invoke<string>(IPC_CHANNELS.AGENT_START, config);
}

export async function stopLocalAgent(agentId: string): Promise<void> {
  if (!isElectron()) {
    return;
  }
  await getIpcRenderer().invoke<void>(IPC_CHANNELS.AGENT_STOP, agentId);
}

export async function sendLocalAgentMessage(agentId: string, message: string): Promise<void> {
  if (!isElectron()) {
    throw new Error('Local agent runtime is only available in Electron');
  }
  await getIpcRenderer().invoke<void>(IPC_CHANNELS.AGENT_MESSAGE, { agentId, message });
}

export async function abortLocalAgent(agentId: string): Promise<void> {
  if (!isElectron()) {
    return;
  }
  await getIpcRenderer().invoke<void>(IPC_CHANNELS.AGENT_ABORT, agentId);
}

export function subscribeToLocalAgentEvents(
  listener: (payload: LocalAgentEventEnvelope) => void,
): () => void {
  if (!isElectron()) {
    return () => {};
  }

  return getIpcRenderer().on(IPC_CHANNELS.AGENT_EVENT, (payload: unknown) => {
    if (
      payload &&
      typeof payload === 'object' &&
      'agentId' in payload &&
      'sessionId' in payload &&
      'event' in payload
    ) {
      listener(payload as LocalAgentEventEnvelope);
    }
  });
}
