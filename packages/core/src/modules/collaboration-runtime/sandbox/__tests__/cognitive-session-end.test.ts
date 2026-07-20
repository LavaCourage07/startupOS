import { describe, expect, it, vi } from 'vitest';
import { flushCognitiveSessionEnd } from '../cognitive-session-end';

describe('flushCognitiveSessionEnd', () => {
  it('invokes on_session_end when the cognitive manager provides it', async () => {
    const onSessionEnd = vi.fn(async () => {});

    await flushCognitiveSessionEnd(
      { on_session_end: onSessionEnd },
      [{ role: 'assistant', content: [{ type: 'text', text: 'done' }] }],
      'OriginOS',
    );

    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    expect(onSessionEnd).toHaveBeenCalledWith([
      { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
    ]);
  });

  it('is a no-op when on_session_end is unavailable', async () => {
    await expect(
      flushCognitiveSessionEnd(
        { other: 'value' },
        [],
        'OriginOS',
      ),
    ).resolves.toBeUndefined();
  });
});
