import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@mariozechner/agent';
import { compressRecentTrace } from '../recent-trace-compression';

function textMessage(role: string, text: string): AgentMessage {
  return {
    role,
    content: [{ type: 'text', text }],
  } as AgentMessage;
}

describe('compressRecentTrace', () => {
  it('does not compress short histories', () => {
    const messages = Array.from({ length: 6 }, (_, index) =>
      textMessage(index % 2 === 0 ? 'user' : 'assistant', `message-${index}`),
    );

    const result = compressRecentTrace(messages, { maxHistory: 10 });

    expect(result.compressed).toBe(false);
    expect(result.messages).toEqual(messages);
    expect(result.preservedTraceCount).toBe(0);
  });

  it('preserves recent assistant and tool trace when compressing long histories', () => {
    const messages: AgentMessage[] = [];
    for (let i = 0; i < 15; i++) {
      messages.push(textMessage('user', `user-${i}`));
    }
    messages.push(textMessage('assistant', 'plan-before-tool'));
    messages.push({
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'call-1', name: 'read_file', arguments: { path: 'Memory.md' } }],
    } as AgentMessage);
    messages.push({
      role: 'toolResult',
      content: [{ type: 'text', text: 'Memory contents' }],
      toolName: 'read_file',
      toolCallId: 'call-1',
    } as AgentMessage);
    messages.push(textMessage('assistant', 'tool failed, do not repeat'));
    messages.push(textMessage('user', 'continue with a different approach'));
    messages.push(textMessage('assistant', 'switching strategy'));

    const result = compressRecentTrace(messages, {
      maxHistory: 10,
      keepRecent: 6,
      preserveTraceCount: 4,
    });

    expect(result.compressed).toBe(true);
    expect(result.messages.length).toBeGreaterThanOrEqual(6);
    expect(result.preservedTraceCount).toBe(4);
    expect(result.messages.some((message) => JSON.stringify(message.content).includes('plan-before-tool'))).toBe(true);
    expect(result.messages.some((message) => JSON.stringify(message.content).includes('read_file'))).toBe(true);
    expect(result.messages.some((message) => JSON.stringify(message.content).includes('Memory contents'))).toBe(true);
    expect(result.messages.some((message) => JSON.stringify(message.content).includes('do not repeat'))).toBe(true);
    expect(result.messages.some((message) => JSON.stringify(message.content).includes('continue with a different approach'))).toBe(true);
    expect(result.messages.at(-1)?.role).toBe('assistant');
  });

  it('preserves recent user-assistant turn pairs instead of assistant-only tails', () => {
    const messages: AgentMessage[] = [];
    for (let i = 0; i < 14; i++) {
      messages.push(textMessage('user', `user-${i}`));
      messages.push(textMessage('assistant', `assistant-${i}`));
    }

    const result = compressRecentTrace(messages, {
      maxHistory: 10,
      keepRecent: 4,
      preserveTraceCount: 2,
    });

    expect(result.compressed).toBe(true);
    expect(result.messages.some((message) => JSON.stringify(message.content).includes('user-13'))).toBe(true);
    expect(result.messages.some((message) => JSON.stringify(message.content).includes('assistant-13'))).toBe(true);
    expect(result.messages.some((message) => JSON.stringify(message.content).includes('user-12'))).toBe(true);
    expect(result.messages.some((message) => JSON.stringify(message.content).includes('assistant-12'))).toBe(true);
  });
});
