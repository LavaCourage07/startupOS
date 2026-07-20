import { describe, expect, it, vi, beforeEach } from 'vitest';

const onMock = vi.fn();
const isElectronMock = vi.fn(() => true);
const getIpcRendererMock = vi.fn(() => ({
  on: onMock,
}));

vi.mock('../../env', () => ({
  isElectron: () => isElectronMock(),
  getIpcRenderer: () => getIpcRendererMock(),
}));

describe('subscribeAgentEvents', () => {
  beforeEach(() => {
    onMock.mockReset();
    isElectronMock.mockReturnValue(true);
  });

  it('ignores AGENT_EVENT payloads without matching sessionId when a session filter is provided', async () => {
    const { subscribeAgentEvents } = await import('../agent-session');
    const listener = vi.fn();

    subscribeAgentEvents(listener, 'skill-session-1');

    expect(onMock).toHaveBeenCalledTimes(1);
    const handler = onMock.mock.calls[0]?.[1] as (payload: unknown) => void;

    handler(JSON.stringify({ projectId: 'project-1', type: 'text_delta', data: { delta: 'hello' } }));
    handler(JSON.stringify({ sessionId: 'other-session', type: 'text_delta', data: { delta: 'wrong' } }));
    handler(JSON.stringify({ sessionId: 'skill-session-1', type: 'text_delta', data: { delta: 'right' } }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      sessionId: 'skill-session-1',
      type: 'text_delta',
      data: { delta: 'right' },
    });
  });
});
