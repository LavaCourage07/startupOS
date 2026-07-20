import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectContext } from '../types';

const listeners = new Set<(payload: unknown) => void>();
const unsubscribeMock = vi.fn();
const createAgentSessionMock = vi.fn();
const sendAgentMessageStreamMock = vi.fn();
const abortAgentSessionMock = vi.fn();

vi.mock('../../electron/env', () => ({
  isElectron: () => true,
}));

vi.mock('../../electron/services/agent-session', () => ({
  createAgentSession: (...args: unknown[]) => createAgentSessionMock(...args),
  sendAgentMessage: vi.fn(),
  sendAgentMessageStream: (...args: unknown[]) => sendAgentMessageStreamMock(...args),
  abortAgentSession: (...args: unknown[]) => abortAgentSessionMock(...args),
  subscribeAgentEvents: (listener: (event: { type: string; data: unknown }) => void, sessionId?: string) => {
    const wrapped = (payload: unknown) => {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) as { sessionId?: string } : payload as { sessionId?: string };
      if (sessionId) {
        if (typeof parsed?.sessionId !== 'string' || parsed.sessionId !== sessionId) {
          return;
        }
      }
      listener(parsed as { type: string; data: unknown });
    };
    listeners.add(wrapped);
    return () => {
      listeners.delete(wrapped);
      unsubscribeMock();
    };
  },
}));

import { usePiAgent } from '../client-hooks';

const projectContext: ProjectContext = {
  projectId: 'project-1',
  ontologyId: 'ontology-1',
  projectName: 'Isolation Test',
  currentPath: '/tmp/project-1',
};

function emitAgentEvent(payload: Record<string, unknown>): void {
  const serialized = JSON.stringify(payload);
  listeners.forEach((listener) => listener(serialized));
}

describe('usePiAgent stream isolation', () => {
  beforeEach(() => {
    listeners.clear();
    unsubscribeMock.mockReset();
    createAgentSessionMock.mockReset();
    sendAgentMessageStreamMock.mockReset();
    abortAgentSessionMock.mockReset();

    createAgentSessionMock.mockImplementation(async (request: { sessionId: string }) => ({
      success: true,
      data: { sessionId: request.sessionId },
      timestamp: new Date().toISOString(),
    }));

    sendAgentMessageStreamMock.mockResolvedValue({
      success: true,
      data: { started: true },
      timestamp: new Date().toISOString(),
    });
    abortAgentSessionMock.mockResolvedValue({
      success: true,
      data: { aborted: true },
      timestamp: new Date().toISOString(),
    });
  });

  afterEach(() => {
    listeners.clear();
  });

  it('does not deliver project-level AGENT_EVENT payloads into another session stream', async () => {
    const { result: skillHook } = renderHook(() => usePiAgent());
    const { result: projectHook } = renderHook(() => usePiAgent());

    await act(async () => {
      await skillHook.current.initialize('skill-session-1', projectContext, {});
      await projectHook.current.initialize('project-session-1', projectContext, {});
    });

    await act(async () => {
      void projectHook.current.sendMessageStream('project message');
      void skillHook.current.sendMessageStream('skill message');
    });

    await waitFor(() => {
      expect(sendAgentMessageStreamMock).toHaveBeenCalledTimes(2);
      expect(listeners.size).toBe(2);
    });

    const projectStreamId = (sendAgentMessageStreamMock.mock.calls[0]?.[0] as { streamId?: string }).streamId;
    const skillStreamId = (sendAgentMessageStreamMock.mock.calls[1]?.[0] as { streamId?: string }).streamId;
    expect(projectStreamId).toBeTruthy();
    expect(skillStreamId).toBeTruthy();

    await act(async () => {
      emitAgentEvent({
        projectId: 'project-1',
        type: 'text_delta',
        data: { delta: 'project-only-delta' },
      });

      emitAgentEvent({
        sessionId: 'project-session-1',
        streamId: projectStreamId,
        type: 'text_delta',
        data: { delta: 'project-session-delta' },
      });

      emitAgentEvent({
        sessionId: 'project-session-1',
        streamId: projectStreamId,
        type: 'assistant_message',
        data: { content: 'project assistant message' },
      });

      emitAgentEvent({
        sessionId: 'project-session-1',
        streamId: projectStreamId,
        type: 'done',
        data: {},
      });

      emitAgentEvent({
        sessionId: 'skill-session-1',
        streamId: skillStreamId,
        type: 'text_delta',
        data: { delta: 'skill-session-delta' },
      });

      emitAgentEvent({
        sessionId: 'skill-session-1',
        streamId: skillStreamId,
        type: 'assistant_message',
        data: { content: 'skill assistant message' },
      });

      emitAgentEvent({
        sessionId: 'skill-session-1',
        streamId: skillStreamId,
        type: 'done',
        data: {},
      });
    });

    await waitFor(() => {
      const skillMessages = skillHook.current.messages ?? [];
      const projectMessages = projectHook.current.messages ?? [];

      expect(skillMessages.some((message) => message.content.includes('project-only-delta'))).toBe(false);
      expect(skillMessages.some((message) => message.content.includes('project-session-delta'))).toBe(false);
      expect(skillMessages.some((message) => message.content.includes('project assistant message'))).toBe(false);
      expect(skillMessages.some((message) => message.content.includes('skill assistant message'))).toBe(true);

      expect(projectMessages.some((message) => message.content.includes('project assistant message'))).toBe(true);
      expect(projectMessages.some((message) => message.content.includes('skill assistant message'))).toBe(false);
    });
  });

  it('ignores late events from an aborted stream after a new stream starts on the same session', async () => {
    const { result } = renderHook(() => usePiAgent());

    await act(async () => {
      await result.current.initialize('session-1', projectContext, {});
    });

    await act(async () => {
      void result.current.sendMessageStream('first message');
    });

    await waitFor(() => {
      expect(sendAgentMessageStreamMock).toHaveBeenCalledTimes(1);
    });

    const firstStreamId = (sendAgentMessageStreamMock.mock.calls[0]?.[0] as { streamId?: string }).streamId;
    expect(firstStreamId).toBeTruthy();

    await act(async () => {
      emitAgentEvent({
        sessionId: 'session-1',
        streamId: firstStreamId,
        type: 'text_delta',
        data: { delta: 'first partial' },
      });
    });

    await waitFor(() => {
      expect(result.current.messages.some((message) => message.content.includes('first partial'))).toBe(true);
    });

    await act(async () => {
      result.current.abort();
    });

    await act(async () => {
      void result.current.sendMessageStream('second message');
    });

    await waitFor(() => {
      expect(sendAgentMessageStreamMock).toHaveBeenCalledTimes(2);
    });

    const secondStreamId = (sendAgentMessageStreamMock.mock.calls[1]?.[0] as { streamId?: string }).streamId;
    expect(secondStreamId).toBeTruthy();
    expect(secondStreamId).not.toBe(firstStreamId);

    await act(async () => {
      emitAgentEvent({
        sessionId: 'session-1',
        streamId: firstStreamId,
        type: 'text_delta',
        data: { delta: ' stale old delta' },
      });
      emitAgentEvent({
        sessionId: 'session-1',
        streamId: firstStreamId,
        type: 'assistant_message',
        data: { content: 'stale old final' },
      });
      emitAgentEvent({
        sessionId: 'session-1',
        streamId: secondStreamId,
        type: 'text_delta',
        data: { delta: 'second partial' },
      });
      emitAgentEvent({
        sessionId: 'session-1',
        streamId: secondStreamId,
        type: 'assistant_message',
        data: { content: 'second final' },
      });
      emitAgentEvent({
        sessionId: 'session-1',
        streamId: secondStreamId,
        type: 'done',
        data: {},
      });
    });

    await waitFor(() => {
      const contents = result.current.messages.map((message) => message.content).join('\n');
      expect(contents).toContain('first partial');
      expect(contents).toContain('second final');
      expect(contents).not.toContain('stale old delta');
      expect(contents).not.toContain('stale old final');
    });
  });
});
