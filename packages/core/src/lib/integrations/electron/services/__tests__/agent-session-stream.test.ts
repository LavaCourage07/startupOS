import { describe, expect, it } from 'vitest';
import { coalesceAgentEventBatch } from '../agent-session';

describe('coalesceAgentEventBatch', () => {
  it('coalesces consecutive text deltas', () => {
    expect(
      coalesceAgentEventBatch([
        { type: 'text_delta', data: { delta: 'a' } },
        { type: 'text_delta', data: { delta: '你' } },
        { type: 'text_delta', data: { delta: '好' } },
      ])
    ).toEqual([{ type: 'text_delta', data: { delta: 'a你好' } }]);
  });

  it('preserves tool event ordering and only merges adjacent text', () => {
    expect(
      coalesceAgentEventBatch([
        { type: 'text_delta', data: { delta: 'before' } },
        { type: 'tool_start', data: { toolName: 'read_file' } },
        { type: 'text_delta', data: { delta: 'after' } },
        { type: 'text_delta', data: { delta: '!' } },
      ])
    ).toEqual([
      { type: 'text_delta', data: { delta: 'before' } },
      { type: 'tool_start', data: { toolName: 'read_file' } },
      { type: 'text_delta', data: { delta: 'after!' } },
    ]);
  });

  it('does not mutate the input events', () => {
    const events = [
      { type: 'text_delta', data: { delta: 'a' } },
      { type: 'text_delta', data: { delta: 'b' } },
    ];

    coalesceAgentEventBatch(events);

    expect(events).toEqual([
      { type: 'text_delta', data: { delta: 'a' } },
      { type: 'text_delta', data: { delta: 'b' } },
    ]);
  });
});
