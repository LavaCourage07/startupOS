import { describe, expect, it, vi } from 'vitest';
import { StreamEventBatcher } from '../stream-event-batcher';

describe('StreamEventBatcher', () => {
  it('flushes the first text delta immediately and coalesces later deltas', () => {
    vi.useFakeTimers();
    const onFlush = vi.fn();
    const batcher = new StreamEventBatcher({ onFlush, maxDelayMs: 32 });

    batcher.push({ type: 'text_delta', data: { delta: '你' } });
    expect(onFlush).toHaveBeenNthCalledWith(1, [
      { type: 'text_delta', data: { delta: '你' } },
    ]);
    batcher.push({ type: 'text_delta', data: { delta: '好' } });
    batcher.push({ type: 'text_delta', data: { delta: '呀' } });
    expect(onFlush).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(32);
    expect(onFlush).toHaveBeenNthCalledWith(2, [
      { type: 'text_delta', data: { delta: '好呀' } },
    ]);
    vi.useRealTimers();
  });

  it('flushes immediately when the byte limit is reached', () => {
    const onFlush = vi.fn();
    const batcher = new StreamEventBatcher({ onFlush, maxBytes: 6 });

    batcher.push({ type: 'text_delta', data: { delta: '你好' } });

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0]?.[0]).toEqual([
      { type: 'text_delta', data: { delta: '你好' } },
    ]);
  });

  it('preserves non-text event order', () => {
    const onFlush = vi.fn();
    const batcher = new StreamEventBatcher({ onFlush });

    batcher.push({ type: 'text_delta', data: { delta: 'a' } });
    batcher.push({ type: 'tool_start', data: { toolName: 'read_file' } });
    batcher.push({ type: 'text_delta', data: { delta: 'b' } });
    batcher.flush();

    expect(onFlush).toHaveBeenNthCalledWith(1, [
      { type: 'text_delta', data: { delta: 'a' } },
    ]);
    expect(onFlush).toHaveBeenNthCalledWith(2, [
      { type: 'tool_start', data: { toolName: 'read_file' } },
      { type: 'text_delta', data: { delta: 'b' } },
    ]);
  });

  it('coalesces streaming skill assistant messages', () => {
    const onFlush = vi.fn();
    const batcher = new StreamEventBatcher({ onFlush });

    batcher.push({
      type: 'assistant_message',
      data: { content: 'long ', isStreaming: true },
    });
    expect(onFlush).toHaveBeenNthCalledWith(1, [
      {
        type: 'assistant_message',
        data: { content: 'long ', isStreaming: true },
      },
    ]);
    batcher.push({
      type: 'assistant_message',
      data: { content: 'answer', isStreaming: true },
    });
    batcher.flush();

    expect(onFlush).toHaveBeenNthCalledWith(2, [
      {
        type: 'assistant_message',
        data: { content: 'answer', isStreaming: true },
      },
    ]);
  });

  it('flushes pending content and ignores events after disposal', () => {
    const onFlush = vi.fn();
    const batcher = new StreamEventBatcher({ onFlush });

    batcher.push({ type: 'text_delta', data: { delta: 'before' } });
    batcher.dispose();
    batcher.push({ type: 'text_delta', data: { delta: 'after' } });

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0]?.[0]).toEqual([
      { type: 'text_delta', data: { delta: 'before' } },
    ]);
  });

  it('does not emit empty batches or duplicate timer flushes', () => {
    vi.useFakeTimers();
    const onFlush = vi.fn();
    const batcher = new StreamEventBatcher({ onFlush, maxDelayMs: 10 });

    batcher.flush();
    batcher.push({ type: 'text_delta', data: { delta: 'once' } });
    batcher.flush();
    vi.advanceTimersByTime(20);

    expect(onFlush).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('preserves a 500 KB one-character stream with bounded batch count', () => {
    const source = '长'.repeat(500_000);
    let output = '';
    let batchCount = 0;
    const batcher = new StreamEventBatcher({
      maxBytes: 16 * 1024,
      onFlush: (events) => {
        batchCount += 1;
        output += (events[0]?.data as { delta?: string })?.delta ?? '';
      },
    });

    for (const character of source) {
      batcher.push({ type: 'text_delta', data: { delta: character } });
    }
    batcher.dispose();

    expect(output).toBe(source);
    expect(batchCount).toBeGreaterThan(1);
    expect(batchCount).toBeLessThan(100);
  });
});
