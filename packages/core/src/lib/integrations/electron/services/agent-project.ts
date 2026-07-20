import { getIpcRenderer, isElectron } from '../env';
import {
  IPC_CHANNELS,
  type IpcResponse,
  type AgentProjectStartRequest,
  type AgentProjectStartResponse,
  type AgentProjectMessageRequest,
  type AgentProjectMessageResponse,
  type AgentProjectStopRequest,
  type AgentProjectStopResponse,
  type AgentProjectAbortRequest,
  type AgentProjectAbortResponse,
  type AgentProjectStreamEvent,
} from '../ipc-protocol';

export interface AgentProjectStreamHandlers {
  onEvent?: (event: AgentProjectStreamEvent) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T;
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? JSON.stringify((payload as { error: unknown }).error)
        : response.statusText;
    throw new Error(message);
  }
  return payload;
}

function parseAgentProjectStreamEvent(payload: unknown): AgentProjectStreamEvent | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const event = payload as Partial<AgentProjectStreamEvent>;
  if (
    typeof event.projectId === 'string'
    && typeof event.type === 'string'
    && 'data' in event
  ) {
    return event as AgentProjectStreamEvent;
  }

  return null;
}

async function readWebAgentProjectStream(
  response: Response,
  projectId: string,
  handlers: AgentProjectStreamHandlers
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error(response.statusText || 'Failed to start agent project stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const dataLine = frame
          .split('\n')
          .find((line) => line.startsWith('data:'));

        if (!dataLine) continue;

        const raw = dataLine.slice(5).trim();
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const event: AgentProjectStreamEvent = {
          projectId,
          type: parsed.type,
          data: parsed.data,
        };

        handlers.onEvent?.(event);
        if (event.type === 'error') {
          const message = typeof event.data === 'object'
            && event.data !== null
            && 'message' in event.data
            && typeof (event.data as { message?: unknown }).message === 'string'
            ? (event.data as { message: string }).message
            : 'Agent project stream failed';
          handlers.onError?.(new Error(message));
        }
        if (event.type === 'done') {
          handlers.onDone?.();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function initializeProjectAgent(projectId: string): Promise<IpcResponse<{ projectId: string; files: string[] }>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<{ projectId: string; files: string[] }>>(
      IPC_CHANNELS.PROJECT_INITIALIZE,
      { projectId }
    );
  }

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent/initialize`, {
    method: 'POST',
  });
  return readJsonResponse<IpcResponse<{ projectId: string; files: string[] }>>(response);
}

export async function startProjectAgent(
  request: AgentProjectStartRequest
): Promise<IpcResponse<AgentProjectStartResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<AgentProjectStartResponse>>(
      IPC_CHANNELS.AGENT_PROJECT_START,
      request
    );
  }

  const response = await fetch(`/api/agent/projects/${encodeURIComponent(request.projectId)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: request.sessionId,
      llmConfig: request.llmConfig,
    }),
  });
  return readJsonResponse<IpcResponse<AgentProjectStartResponse>>(response);
}

export async function stopProjectAgent(
  request: AgentProjectStopRequest
): Promise<IpcResponse<AgentProjectStopResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<AgentProjectStopResponse>>(
      IPC_CHANNELS.AGENT_PROJECT_STOP,
      request
    );
  }

  const response = await fetch(`/api/agent/projects/${encodeURIComponent(request.projectId)}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return readJsonResponse<IpcResponse<AgentProjectStopResponse>>(response);
}

export async function sendProjectAgentMessage(
  request: AgentProjectMessageRequest,
  handlers: AgentProjectStreamHandlers = {}
): Promise<IpcResponse<AgentProjectMessageResponse>> {
  if (isElectron()) {
    const ipc = getIpcRenderer();

    // Subscribe to streaming events BEFORE invoking the message handler.
    // The IPC handler broadcasts events via AGENT_EVENT with projectId in payload.
    // We keep the listener active until done/error, then unsubscribe.
    const streamPromise = new Promise<void>((resolve) => {
      const unsubscribe = ipc.on(IPC_CHANNELS.AGENT_EVENT, (payload: unknown) => {
        const raw = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const event = parseAgentProjectStreamEvent(raw);
        if (!event || event.projectId !== request.projectId) {
          return;
        }

        handlers.onEvent?.(event);
        if (event.type === 'error') {
          const message = typeof event.data === 'object'
            && event.data !== null
            && 'message' in event.data
            && typeof (event.data as { message?: unknown }).message === 'string'
            ? (event.data as { message: string }).message
            : 'Agent project stream failed';
          handlers.onError?.(new Error(message));
          unsubscribe();
          resolve();
        }
        if (event.type === 'done') {
          handlers.onDone?.();
          unsubscribe();
          resolve();
        }
      });
    });

    // Start the message processing (fire-and-forget on main process side)
    const response = await ipc.invoke<IpcResponse<AgentProjectMessageResponse>>(
      IPC_CHANNELS.AGENT_PROJECT_MESSAGE,
      request
    );

    if (!response.success) {
      return response;
    }

    // Wait for the stream to complete (done/error event)
    await streamPromise;

    return {
      success: true,
      data: { started: true },
      timestamp: new Date().toISOString(),
    };
  }

  const response = await fetch(`/api/agent/projects/${encodeURIComponent(request.projectId)}/messages`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: request.content,
      sessionId: request.sessionId,
      llmConfig: request.llmConfig,
    }),
  });

  await readWebAgentProjectStream(response, request.projectId, handlers);

  return {
    success: true,
    data: { started: true },
    timestamp: new Date().toISOString(),
  };
}

export async function abortProjectAgent(
  request: AgentProjectAbortRequest
): Promise<IpcResponse<AgentProjectAbortResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<AgentProjectAbortResponse>>(
      IPC_CHANNELS.AGENT_PROJECT_ABORT,
      request
    );
  }

  const response = await fetch('/api/agent/abort', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId: `project-${request.projectId}` }),
  });
  return readJsonResponse<IpcResponse<AgentProjectAbortResponse>>(response);
}

export type {
  AgentProjectStartRequest,
  AgentProjectStartResponse,
  AgentProjectMessageRequest,
  AgentProjectMessageResponse,
  AgentProjectStopRequest,
  AgentProjectStopResponse,
  AgentProjectAbortRequest,
  AgentProjectAbortResponse,
  AgentProjectStreamEvent,
};
