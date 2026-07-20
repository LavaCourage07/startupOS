import { describe, expect, it, vi } from 'vitest';
import { AgentManager } from '../agent-manager';

describe('AgentManager cognitive sync', () => {
  it('records cached user and assistant messages separately on turn_end', async () => {
    const manager = new AgentManager();
    const subscribe = vi.fn((listener: (event: any) => void) => {
      listener({
        type: 'message_end',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'user request' }],
        },
      });
      listener({
        type: 'message_end',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'assistant reply' }],
        },
      });
      listener({
        type: 'turn_end',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'assistant reply' }],
        },
        toolResults: [],
      });
      return () => {};
    });

    const agent = { subscribe } as any;
    const on_turn_end = vi.fn().mockResolvedValue(undefined);

    (manager as any).subscribeInProcessCognitive(agent, { on_turn_end }, 'session-test');

    await Promise.resolve();

    expect(on_turn_end).toHaveBeenCalledTimes(1);
    expect(on_turn_end.mock.calls[0][0]).toMatchObject({
      userMessage: 'user request',
      assistantMessage: 'assistant reply',
    });
  });
});
