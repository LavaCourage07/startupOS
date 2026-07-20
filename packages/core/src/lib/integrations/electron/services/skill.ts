import { getIpcRenderer, isElectron } from '../env';
import {
  IPC_CHANNELS,
  type IpcResponse,
  type SkillContentRequest,
  type SkillContentResponse,
  type SkillExecutionCompleteRequest,
  type SkillExecutionCompleteResponse,
  type SkillExecutionMessageRequest,
  type SkillExecutionMessageResponse,
  type SkillExecutionStartRequest,
  type SkillExecutionStartResponse,
  type SkillExecutionStreamEvent,
  type SkillExecutionStreamRequest,
  type SkillExecutionTimelineRequest,
  type SkillExecutionTimelineResponse,
  type SkillEvolutionRequest,
  type SkillEvolutionResult,
  type SkillListRequest,
  type SkillListResponse,
  type SkillSessionsRequest,
  type SkillSessionsResponse,
} from '../ipc-protocol';

export interface SkillExecutionStreamHandlers {
  onEvent?: (event: SkillExecutionStreamEvent) => void;
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

function generateStreamId(executionId: string): string {
  return `${executionId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSkillExecutionStreamEvent(payload: unknown): SkillExecutionStreamEvent | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const event = payload as Partial<SkillExecutionStreamEvent>;
  if (
    typeof event.executionId === 'string'
    && typeof event.type === 'string'
    && 'data' in event
  ) {
    return event as SkillExecutionStreamEvent;
  }

  return null;
}

async function readWebSkillExecutionStream(
  response: Response,
  handlers: SkillExecutionStreamHandlers
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error(response.statusText || 'Failed to start skill execution stream');
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

        const event = parseSkillExecutionStreamEvent(JSON.parse(raw));
        if (!event) continue;

        handlers.onEvent?.(event);
        if (event.type === 'error') {
          const message = typeof event.data === 'object'
            && event.data !== null
            && 'message' in event.data
            && typeof (event.data as { message?: unknown }).message === 'string'
            ? (event.data as { message: string }).message
            : 'Skill execution stream failed';
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

export async function runSkillEvolution(
  request: SkillEvolutionRequest
): Promise<IpcResponse<SkillEvolutionResult>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SkillEvolutionResult>>(
      IPC_CHANNELS.SKILL_EVOLUTION_RUN,
      request
    );
  }

  const response = await fetch('/api/agent/skill-evolution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return readJsonResponse<IpcResponse<SkillEvolutionResult>>(response);
}

function toQueryString(params: Record<string, string | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function listAvailableSkills(
  request: SkillListRequest = {}
): Promise<IpcResponse<SkillListResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SkillListResponse>>(
      IPC_CHANNELS.SKILL_LIST,
      request
    );
  }

  const response = await fetch(`/api/skills${toQueryString({
    source: request.source,
    includeInvisible: request.includeInvisible,
    includeDiagnostics: request.includeDiagnostics,
  })}`);
  return readJsonResponse<IpcResponse<SkillListResponse>>(response);
}

export async function refreshAvailableSkills(): Promise<IpcResponse<SkillListResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SkillListResponse>>(IPC_CHANNELS.SKILL_REFRESH);
  }

  const response = await fetch('/api/skills/refresh', { method: 'POST' });
  return readJsonResponse<IpcResponse<SkillListResponse>>(response);
}

export async function getAvailableSkillContent(
  request: SkillContentRequest
): Promise<IpcResponse<SkillContentResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SkillContentResponse>>(
      IPC_CHANNELS.SKILL_CONTENT,
      request
    );
  }

  const response = await fetch(
    `/api/skills/${encodeURIComponent(request.name)}/content${toQueryString({
      format: 'json',
      includeFrontmatter: request.includeFrontmatter,
    })}`
  );
  return readJsonResponse<IpcResponse<SkillContentResponse>>(response);
}

export async function listAvailableSkillSessions(
  request: SkillSessionsRequest
): Promise<IpcResponse<SkillSessionsResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SkillSessionsResponse>>(
      IPC_CHANNELS.SKILL_SESSION_LIST,
      request
    );
  }

  const response = await fetch(`/api/skill-sessions${toQueryString({
    skillName: request.skillName,
  })}`);
  return readJsonResponse<IpcResponse<SkillSessionsResponse>>(response);
}

export async function startSkillExecution(
  request: SkillExecutionStartRequest
): Promise<IpcResponse<SkillExecutionStartResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SkillExecutionStartResponse>>(
      IPC_CHANNELS.SKILL_EXECUTION_START,
      request
    );
  }

  const response = await fetch('/api/skills/executions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJsonResponse<IpcResponse<SkillExecutionStartResponse>>(response);
}

export async function completeSkillExecution(
  request: SkillExecutionCompleteRequest
): Promise<IpcResponse<SkillExecutionCompleteResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SkillExecutionCompleteResponse>>(
      IPC_CHANNELS.SKILL_EXECUTION_COMPLETE,
      request
    );
  }

  const response = await fetch(`/api/skills/executions/${encodeURIComponent(request.executionId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: request.sessionId,
      cancelled: request.cancelled,
    }),
  });
  return readJsonResponse<IpcResponse<SkillExecutionCompleteResponse>>(response);
}

export async function sendSkillExecutionMessage(
  request: SkillExecutionMessageRequest
): Promise<IpcResponse<SkillExecutionMessageResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SkillExecutionMessageResponse>>(
      IPC_CHANNELS.SKILL_EXECUTION_MESSAGE,
      request
    );
  }

  const response = await fetch(`/api/skills/executions/${encodeURIComponent(request.executionId)}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: request.sessionId,
      content: request.content,
      role: request.role,
      metadata: request.metadata,
    }),
  });
  return readJsonResponse<IpcResponse<SkillExecutionMessageResponse>>(response);
}

export async function streamSkillExecutionMessage(
  request: SkillExecutionMessageRequest,
  handlers: SkillExecutionStreamHandlers = {}
): Promise<IpcResponse<{ streamId: string }>> {
  const streamId = generateStreamId(request.executionId);

  if (isElectron()) {
    const ipc = getIpcRenderer();
    const unsubscribe = ipc.on(IPC_CHANNELS.SKILL_EXECUTION_EVENT, (payload) => {
      const event = parseSkillExecutionStreamEvent(payload);
      const streamPayload = payload as { streamId?: unknown };
      if (!event || streamPayload.streamId !== streamId) {
        return;
      }

      handlers.onEvent?.(event);
      if (event.type === 'error') {
        const message = typeof event.data === 'object'
          && event.data !== null
          && 'message' in event.data
          && typeof (event.data as { message?: unknown }).message === 'string'
          ? (event.data as { message: string }).message
          : 'Skill execution stream failed';
        handlers.onError?.(new Error(message));
      }
      if (event.type === 'done') {
        handlers.onDone?.();
      }
    });

    try {
      const streamRequest: SkillExecutionStreamRequest = {
        ...request,
        streamId,
      };
      const response = await ipc.invoke<IpcResponse<{ streamId: string }>>(
        IPC_CHANNELS.SKILL_EXECUTION_MESSAGE_STREAM,
        streamRequest
      );

      return response.success
        ? response
        : { ...response, data: { streamId } };
    } finally {
      unsubscribe();
    }
  }

  const response = await fetch(`/api/skills/executions/${encodeURIComponent(request.executionId)}/message`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: request.sessionId,
      content: request.content,
      role: request.role,
      metadata: request.metadata,
    }),
  });

  await readWebSkillExecutionStream(response, handlers);

  return {
    success: true,
    data: { streamId },
    timestamp: new Date().toISOString(),
  };
}

export async function getSkillExecutionTimeline(
  request: SkillExecutionTimelineRequest
): Promise<IpcResponse<SkillExecutionTimelineResponse>> {
  if (isElectron()) {
    return getIpcRenderer().invoke<IpcResponse<SkillExecutionTimelineResponse>>(
      IPC_CHANNELS.SKILL_EXECUTION_TIMELINE,
      request
    );
  }

  const response = await fetch(
    `/api/skills/executions/${encodeURIComponent(request.executionId)}/timeline${toQueryString({
      sessionId: request.sessionId,
    })}`
  );
  return readJsonResponse<IpcResponse<SkillExecutionTimelineResponse>>(response);
}

export type {
  SkillContentRequest,
  SkillContentResponse,
  SkillExecutionCompleteRequest,
  SkillExecutionCompleteResponse,
  SkillExecutionMessageRequest,
  SkillExecutionMessageResponse,
  SkillExecutionStartRequest,
  SkillExecutionStartResponse,
  SkillExecutionStreamEvent,
  SkillExecutionStreamRequest,
  SkillExecutionTimelineRequest,
  SkillExecutionTimelineResponse,
  SkillEvolutionRequest,
  SkillEvolutionResult,
  SkillListRequest,
  SkillListResponse,
  SkillSessionsRequest,
  SkillSessionsResponse,
};
