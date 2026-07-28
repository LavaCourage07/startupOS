import { describe, expect, it } from 'vitest';
import { applyAssistantMessageEnd } from '../assistant-stream-state';

describe('applyAssistantMessageEnd', () => {
  it('sends the first assistant completion once', () => {
    const next = applyAssistantMessageEnd(
      { content: 'streamed', sent: false },
      { content: 'streamed response' }
    );

    expect(next).toEqual({
      content: 'streamed response',
      sent: true,
      shouldSend: true,
    });
  });

  it('does not resend ordinary recovery planning text after the first completion', () => {
    const next = applyAssistantMessageEnd(
      { content: 'initial plan', sent: true },
      { content: 'another plan' }
    );

    expect(next.content).toBe('another plan');
    expect(next.shouldSend).toBe(false);
  });

  it('overrides an earlier plan with a marked completion failure report', () => {
    const next = applyAssistantMessageEnd(
      { content: 'initial plan', sent: true },
      {
        content: '任务未能自动完成：命令不可用',
        completionFailure: true,
      }
    );

    expect(next).toEqual({
      content: '任务未能自动完成：命令不可用',
      sent: true,
      shouldSend: true,
    });
  });
});
